import os
import re
import tempfile
from dataclasses import asdict
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from flask import Flask, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from llm_core.backend_services import attachment_from_dict, get_backend_services
from llm_core.config import settings
from llm_core.model_registry import MODEL_REGISTRY
from llm_core.orchestrator import Orchestrator
from llm_core.schemas import Attachment, ChatRequest


REPO_ROOT = Path(__file__).resolve().parent
DEFAULT_UPLOAD_DIR = REPO_ROOT / ".mts_memory" / "uploads"
APP_NAME = os.getenv("MTS_APP_NAME", "MWS GPT Hub")
FRONTEND_DIST_DIR = REPO_ROOT / "web" / "static" / "dist"
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_app(
    orchestrator: Orchestrator | None = None,
    backend=None,
    upload_dir: str | Path | None = None,
) -> Flask:
    app = Flask(
        __name__,
        static_folder=str(REPO_ROOT / "web" / "static"),
        template_folder=str(REPO_ROOT / "web" / "templates"),
    )
    app.config["JSON_AS_ASCII"] = False
    app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024
    app.config["APP_NAME"] = APP_NAME
    app.secret_key = os.getenv("MTS_SECRET_KEY") or "mts-dev-secret-change-me"
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = os.getenv("MTS_SESSION_SECURE", "0") == "1"
    app.permanent_session_lifetime = timedelta(days=30)

    resolved_orchestrator = orchestrator or Orchestrator()
    resolved_backend = backend or getattr(getattr(resolved_orchestrator, "memory_policy", None), "backend", None)
    if resolved_backend is None:
        resolved_backend = get_backend_services()

    if hasattr(resolved_orchestrator.memory_policy, "backend"):
        resolved_orchestrator.memory_policy.backend = resolved_backend
    if hasattr(resolved_orchestrator.tools, "backend"):
        resolved_orchestrator.tools.backend = resolved_backend

    upload_root = Path(upload_dir or DEFAULT_UPLOAD_DIR).resolve()
    upload_root.mkdir(parents=True, exist_ok=True)

    def json_error(message: str, status: int = 400):
        return jsonify({"error": message}), status

    def normalize_message_text(message: str, attachments: list[Attachment]) -> str:
        cleaned = (message or "").strip()
        if cleaned:
            return cleaned

        attachment_types = {item.type for item in attachments}
        if "file" in attachment_types:
            return "Проанализируй приложенный файл и дай короткий ответ."
        if "url" in attachment_types:
            return "Посмотри ссылку и коротко перескажи главное."
        if "audio" in attachment_types or "voice_note" in attachment_types:
            transcript = next(
                (
                    item.metadata.get("transcript", "").strip()
                    for item in attachments
                    if item.type in {"voice_note", "audio"}
                ),
                "",
            )
            if transcript:
                return transcript
            return "Распознай голосовой запрос и ответь по существу."
        return ""

    def normalize_email(email: str) -> str:
        return (email or "").strip().lower()

    def normalize_nickname(nickname: str) -> str:
        return " ".join((nickname or "").strip().split())

    def trim_label(text: str, limit: int = 42) -> str:
        text = " ".join((text or "").strip().split())
        if len(text) <= limit:
            return text
        return text[: max(0, limit - 1)].rstrip() + "…"

    def public_user_payload(user: dict | None) -> dict | None:
        if user is None:
            return None
        return {
            "user_id": user.get("user_id"),
            "email": user.get("email", ""),
            "nickname": user.get("nickname", ""),
            "created_at": user.get("created_at"),
        }

    def current_user(optional: bool = False) -> dict | None:
        user_id = str(session.get("auth_user_id") or "").strip()
        if not user_id:
            return None
        user = resolved_backend.storage.get_user_by_id(user_id)
        if user is None:
            session.clear()
            return None
        return user

    def require_user():
        user = current_user(optional=True)
        if user is None:
            return None, json_error("Требуется вход в аккаунт", status=401)
        return user, None

    def chat_title_for(chat_id: str, fallback: str = "Новый чат") -> str:
        chat = resolved_backend.storage.get_chat(chat_id)
        if chat is None:
            return fallback
        metadata = chat.get("metadata", {})
        title = metadata.get("title", "").strip()
        if title:
            return title

        for message in resolved_backend.storage.list_messages(chat_id, limit=40):
            if message.get("role") == "user" and message.get("content", "").strip():
                return trim_label(message["content"], limit=38)
        return fallback

    def update_chat_title_if_needed(user_id: str, chat_id: str, message: str) -> None:
        if not message.strip():
            return
        chat = resolved_backend.storage.get_chat(chat_id)
        current_title = ((chat or {}).get("metadata") or {}).get("title", "").strip()
        if current_title and current_title != "Новый чат":
            return
        resolved_backend.storage.update_chat_metadata(
            user_id=user_id,
            chat_id=chat_id,
            metadata={"title": trim_label(message, limit=38)},
        )

    def serialize_file_record(file_record: dict | None) -> dict | None:
        if file_record is None:
            return None
        return {
            "file_id": file_record.get("file_id"),
            "file_name": file_record.get("file_name"),
            "mime_type": file_record.get("mime_type"),
            "status": file_record.get("status"),
            "metadata": file_record.get("metadata", {}),
        }

    def normalize_image_payload(content: str, task_type: str = "") -> str:
        value = (content or "").strip()
        if not value:
            return value
        if task_type != "image_generation":
            return value
        if value.startswith("data:image/"):
            return value
        if value.startswith("http://") or value.startswith("https://"):
            return value
        compact = "".join(value.split())
        if compact and len(compact) > 128 and all(ch.isalnum() or ch in "+/=" for ch in compact):
            return f"data:image/png;base64,{compact}"
        return value

    def serialize_message(message: dict) -> dict:
        metadata = dict(message.get("metadata", {}))
        attachments = list(metadata.get("attachments", []))
        if metadata.get("attachment"):
            attachments = [metadata["attachment"], *attachments]
        return {
            "message_id": message.get("message_id"),
            "chat_id": message.get("chat_id"),
            "role": message.get("role"),
            "content": normalize_image_payload(message.get("content", ""), message.get("task_type", "")),
            "task_type": message.get("task_type", ""),
            "created_at": message.get("created_at"),
            "attachments": attachments,
            "tool_outputs": metadata.get("tool_outputs", []),
            "sources": metadata.get("sources", []),
            "context_used": bool(metadata.get("context_used")),
            "model_used": metadata.get("model_used", ""),
            "message_kind": metadata.get("message_kind", "chat"),
            "metadata": metadata,
        }

    def serialize_chat(chat: dict) -> dict:
        recent_messages = resolved_backend.storage.list_recent_messages(chat["chat_id"], limit=2)
        indexed_messages = resolved_backend.storage.list_messages(chat["chat_id"], limit=120)
        last_message = recent_messages[-1] if recent_messages else None
        metadata = chat.get("metadata", {})
        search_text = "\n".join(
            item.get("content", "").strip()
            for item in indexed_messages
            if item.get("content", "").strip()
        )
        return {
            "chat_id": chat["chat_id"],
            "user_id": chat["user_id"],
            "title": chat_title_for(chat["chat_id"]),
            "updated_at": chat.get("updated_at"),
            "created_at": chat.get("created_at"),
            "preview": trim_label((last_message or {}).get("content", "") or metadata.get("preview", ""), limit=52),
            "search_preview": trim_label((last_message or {}).get("content", "") or metadata.get("preview", ""), limit=120),
            "search_text": search_text[:8000],
            "last_role": (last_message or {}).get("role", ""),
            "message_count": resolved_backend.storage.count_messages(chat["chat_id"]),
            "metadata": metadata,
        }

    def serialize_response(response) -> dict:
        return {
            "answer": normalize_image_payload(response.answer, response.task_type),
            "task_type": response.task_type,
            "model_used": response.model_used,
            "tools_used": list(response.tools_used),
            "memory_used": response.memory_used,
            "sources": list(response.sources),
            "metadata": dict(response.metadata),
        }

    def ensure_chat_access(user_id: str, chat_id: str) -> dict | None:
        chat = resolved_backend.storage.get_chat(chat_id)
        if chat is None or chat.get("user_id") != user_id:
            return None
        return chat

    def frontend_asset_url(file_name: str) -> str | None:
        asset_path = FRONTEND_DIST_DIR / file_name
        if not asset_path.exists():
            return None
        return f"/static/dist/{file_name}"

    @app.get("/")
    def index():
        return render_template(
            "index.html",
            frontend_css=frontend_asset_url("app.css"),
            frontend_js=frontend_asset_url("app.js"),
            app_config={
                "appName": APP_NAME,
                "apiKeyPresent": bool(settings.mws_api_key),
                "authEnabled": True,
            },
        )

    @app.get("/api/health")
    def health():
        return jsonify(
            {
                "ok": True,
                "app_name": APP_NAME,
                "api_key_present": bool(settings.mws_api_key),
                "base_url": settings.mws_base_url,
                "auth_enabled": True,
            }
        )

    @app.get("/api/auth/session")
    def auth_session():
        user = current_user(optional=True)
        return jsonify({"authenticated": bool(user), "user": public_user_payload(user)})

    @app.post("/api/auth/register")
    def register():
        payload = request.get_json(force=True) or {}
        email = normalize_email(str(payload.get("email") or ""))
        nickname = normalize_nickname(str(payload.get("nickname") or ""))
        password = str(payload.get("password") or "")

        if not EMAIL_PATTERN.match(email):
            return json_error("Введите корректный email")
        if len(nickname) < 2:
            return json_error("Никнейм должен содержать минимум 2 символа")
        if len(password) < 8:
            return json_error("Пароль должен содержать минимум 8 символов")
        if resolved_backend.storage.get_user_by_email(email):
            return json_error("Пользователь с таким email уже существует", status=409)
        if resolved_backend.storage.get_user_by_nickname(nickname):
            return json_error("Этот никнейм уже занят", status=409)

        user = resolved_backend.storage.create_user(
            user_id=f"user-{uuid4().hex[:12]}",
            email=email,
            nickname=nickname,
            password_hash=generate_password_hash(password),
            metadata={"origin": "web"},
        )
        session.clear()
        session.permanent = True
        session["auth_user_id"] = user["user_id"]
        return jsonify({"authenticated": True, "user": public_user_payload(user)}), 201

    @app.post("/api/auth/login")
    def login():
        payload = request.get_json(force=True) or {}
        email = normalize_email(str(payload.get("email") or ""))
        password = str(payload.get("password") or "")
        user = resolved_backend.storage.get_user_by_email(email)
        if user is None or not check_password_hash(user.get("password_hash", ""), password):
            return json_error("Неверный email или пароль", status=401)
        session.clear()
        session.permanent = True
        session["auth_user_id"] = user["user_id"]
        return jsonify({"authenticated": True, "user": public_user_payload(user)})

    @app.post("/api/auth/logout")
    def logout():
        session.clear()
        return jsonify({"ok": True})

    @app.get("/api/models")
    def models():
        return jsonify(
            {
                "default_mode": "auto",
                "manual_models": [
                    {"id": MODEL_REGISTRY["default_chat"], "label": "MWS GPT Alpha", "kind": "Текст"},
                    {"id": MODEL_REGISTRY["strong_chat"], "label": "Qwen 72B", "kind": "Сильный чат"},
                    {"id": MODEL_REGISTRY["vision"], "label": "Qwen VL", "kind": "Изображения"},
                    {"id": MODEL_REGISTRY["asr"], "label": "Whisper Turbo", "kind": "Аудио"},
                    {"id": MODEL_REGISTRY["image_generation"], "label": "Qwen Image", "kind": "Генерация"},
                ],
            }
        )

    @app.get("/api/chats")
    def list_chats():
        user, error = require_user()
        if error:
            return error
        chats = [serialize_chat(item) for item in resolved_backend.storage.list_chats(user_id=user["user_id"], limit=80)]
        return jsonify({"chats": chats})

    @app.post("/api/chats")
    def create_chat():
        user, error = require_user()
        if error:
            return error
        payload = request.get_json(silent=True) or {}
        reusable_chat = resolved_backend.storage.find_empty_chat(user_id=user["user_id"])
        if reusable_chat is not None:
            return jsonify({"chat": serialize_chat(reusable_chat), "reused": True})

        chat_id = str(payload.get("chat_id") or f"chat-{uuid4().hex[:8]}")
        title = str(payload.get("title") or "Новый чат").strip() or "Новый чат"
        resolved_backend.storage.upsert_chat(
            user_id=user["user_id"],
            chat_id=chat_id,
            metadata={"title": title, "origin": "web"},
        )
        chat = resolved_backend.storage.get_chat(chat_id)
        return jsonify({"chat": serialize_chat(chat), "reused": False})

    @app.get("/api/chats/<chat_id>")
    def get_chat(chat_id: str):
        user, error = require_user()
        if error:
            return error
        chat = ensure_chat_access(user["user_id"], chat_id)
        if chat is None:
            return json_error("chat not found", status=404)
        return jsonify({"chat": serialize_chat(chat)})

    @app.patch("/api/chats/<chat_id>")
    def update_chat(chat_id: str):
        user, error = require_user()
        if error:
            return error
        payload = request.get_json(force=True) or {}
        chat = ensure_chat_access(user["user_id"], chat_id)
        if chat is None:
            return json_error("chat not found", status=404)

        has_changes = False
        if "title" in payload:
            title = trim_label(str(payload.get("title") or "Новый чат"), limit=60)
            resolved_backend.storage.rename_chat(user_id=user["user_id"], chat_id=chat_id, title=title)
            has_changes = True

        if "pinned" in payload:
            resolved_backend.storage.set_chat_pinned(
                user_id=user["user_id"], chat_id=chat_id, pinned=bool(payload.get("pinned"))
            )
            has_changes = True

        if not has_changes:
            return json_error("no changes provided")

        refreshed_chat = resolved_backend.storage.get_chat(chat_id)
        return jsonify({"chat": serialize_chat(refreshed_chat)})

    @app.delete("/api/chats/<chat_id>")
    def delete_chat(chat_id: str):
        user, error = require_user()
        if error:
            return error
        chat = ensure_chat_access(user["user_id"], chat_id)
        if chat is None:
            return json_error("chat not found", status=404)

        resolved_backend.storage.delete_chat(user_id=user["user_id"], chat_id=chat_id)
        return jsonify({"ok": True, "chat_id": chat_id})

    @app.get("/api/chats/<chat_id>/messages")
    def get_messages(chat_id: str):
        user, error = require_user()
        if error:
            return error
        chat = ensure_chat_access(user["user_id"], chat_id)
        if chat is None:
            return json_error("chat not found", status=404)
        messages = [serialize_message(item) for item in resolved_backend.storage.list_messages(chat_id, limit=240)]
        return jsonify({"chat": serialize_chat(chat), "messages": messages})

    @app.get("/api/chats/<chat_id>/memory")
    def get_memory(chat_id: str):
        user, error = require_user()
        if error:
            return error
        chat = ensure_chat_access(user["user_id"], chat_id)
        if chat is None:
            return json_error("chat not found", status=404)

        packet = resolved_orchestrator.memory_policy.fetch(
            ChatRequest(
                user_id=user["user_id"],
                chat_id=chat_id,
                message="",
                attachments=[],
                mode="auto",
                selected_model=None,
                task_type="text_chat",
            )
        )
        return jsonify({"memory": asdict(packet)})

    @app.post("/api/chats/<chat_id>/messages")
    def send_message(chat_id: str):
        user, error = require_user()
        if error:
            return error
        payload = request.get_json(force=True) or {}
        chat = ensure_chat_access(user["user_id"], chat_id)
        if chat is None:
            resolved_backend.storage.upsert_chat(
                user_id=user["user_id"],
                chat_id=chat_id,
                metadata={"title": "Новый чат", "origin": "web"},
            )

        raw_attachments = payload.get("attachments", [])
        attachments = [attachment_from_dict(item) for item in raw_attachments]
        message = normalize_message_text(str(payload.get("message", "")), attachments)
        if not message and not attachments:
            return json_error("message or attachments are required")

        chat_request = ChatRequest(
            user_id=user["user_id"],
            chat_id=chat_id,
            message=message,
            attachments=attachments,
            mode=str(payload.get("mode", "auto")),
            selected_model=payload.get("selected_model"),
        )
        response = resolved_orchestrator.handle(chat_request)
        update_chat_title_if_needed(user_id=user["user_id"], chat_id=chat_id, message=message)

        refreshed_chat = resolved_backend.storage.get_chat(chat_id)
        messages = [serialize_message(item) for item in resolved_backend.storage.list_messages(chat_id, limit=240)]
        return jsonify(
            {
                "chat": serialize_chat(refreshed_chat),
                "messages": messages,
                "response": serialize_response(response),
            }
        )

    @app.delete("/api/chats/<chat_id>/messages/<message_id>")
    def delete_message(chat_id: str, message_id: str):
        user, error = require_user()
        if error:
            return error
        chat = ensure_chat_access(user["user_id"], chat_id)
        if chat is None:
            return json_error("chat not found", status=404)

        deleted = resolved_backend.storage.delete_turn(user_id=user["user_id"], chat_id=chat_id, message_id=message_id)
        if not deleted:
            return json_error("message not found", status=404)

        refreshed_chat = resolved_backend.storage.get_chat(chat_id)
        messages = [serialize_message(item) for item in resolved_backend.storage.list_messages(chat_id, limit=240)]
        return jsonify({"chat": serialize_chat(refreshed_chat), "messages": messages, "deleted": True})

    @app.post("/api/chats/<chat_id>/regenerate")
    def regenerate_last(chat_id: str):
        user, error = require_user()
        if error:
            return error
        chat = ensure_chat_access(user["user_id"], chat_id)
        if chat is None:
            return json_error("chat not found", status=404)

        payload = request.get_json(silent=True) or {}
        prepared = resolved_backend.storage.prepare_regeneration(user_id=user["user_id"], chat_id=chat_id)
        if prepared is None:
            return json_error("Нет пользовательского сообщения для повтора", status=400)

        attachments = [attachment_from_dict(item) for item in prepared.get("attachments", [])]
        chat_request = ChatRequest(
            user_id=user["user_id"],
            chat_id=chat_id,
            message=str(prepared.get("message", "")),
            attachments=attachments,
            mode=str(payload.get("mode", "auto")),
            selected_model=payload.get("selected_model"),
        )
        response = resolved_orchestrator.handle(chat_request)
        update_chat_title_if_needed(user_id=user["user_id"], chat_id=chat_id, message=prepared.get("message", ""))

        refreshed_chat = resolved_backend.storage.get_chat(chat_id)
        messages = [serialize_message(item) for item in resolved_backend.storage.list_messages(chat_id, limit=240)]
        return jsonify(
            {
                "chat": serialize_chat(refreshed_chat),
                "messages": messages,
                "response": serialize_response(response),
                "regenerated": True,
            }
        )

    @app.post("/api/uploads")
    def upload_file():
        user, error = require_user()
        if error:
            return error
        chat_id = (request.form.get("chat_id") or "").strip()
        if not chat_id:
            return json_error("chat_id is required")

        chat = ensure_chat_access(user["user_id"], chat_id)
        if chat is None:
            resolved_backend.storage.upsert_chat(
                user_id=user["user_id"],
                chat_id=chat_id,
                metadata={"title": "Новый чат", "origin": "web"},
            )

        uploaded = request.files.get("file")
        if uploaded is None or not uploaded.filename:
            return json_error("file is required")

        safe_name = secure_filename(uploaded.filename) or f"upload-{uuid4().hex[:8]}"
        target_dir = upload_root / user["user_id"] / chat_id
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / f"{uuid4().hex[:8]}-{safe_name}"
        uploaded.save(target_path)

        ingestion_result = resolved_backend.ingestion.ingest_file(
            user_id=user["user_id"],
            chat_id=chat_id,
            file_path=str(target_path),
        )
        mime_type = ingestion_result.get("mime_type") or ""
        attachment_type = "image" if mime_type.startswith("image/") else ("audio" if mime_type.startswith("audio/") else "file")
        attachment = {
            "type": attachment_type,
            "file_id": ingestion_result.get("file_id"),
            "mime_type": ingestion_result.get("mime_type"),
            "metadata": {
                "file_path": str(target_path),
                "file_name": ingestion_result.get("file_name", safe_name),
                "ingestion_status": ingestion_result.get("status", ""),
                **dict(ingestion_result.get("metadata", {})),
            },
        }

        refreshed_chat = resolved_backend.storage.get_chat(chat_id)
        file_record = resolved_backend.storage.get_file(ingestion_result.get("file_id", ""))
        latest_messages = resolved_backend.storage.list_messages(chat_id, limit=240)
        return jsonify(
            {
                "chat": serialize_chat(refreshed_chat),
                "attachment": attachment,
                "file": serialize_file_record(file_record),
                "messages": [serialize_message(item) for item in latest_messages],
            }
        )


    @app.post("/api/transcribe-audio")
    def transcribe_audio():
        user, error = require_user()
        if error:
            return error

        uploaded = request.files.get("file")
        if uploaded is None or not uploaded.filename:
            return json_error("file is required")

        safe_name = secure_filename(uploaded.filename) or f"voice-{uuid4().hex[:8]}.webm"
        suffix = Path(safe_name).suffix or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            uploaded.save(temp_file.name)
            temp_path = temp_file.name

        try:
            transcript = resolved_orchestrator.client.transcribe_audio(
                model=MODEL_REGISTRY["asr"],
                file_path=temp_path,
            )
            return jsonify({"transcript": transcript})
        finally:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except Exception:
                pass

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
