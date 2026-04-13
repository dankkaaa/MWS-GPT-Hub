import argparse
import json
import shlex
from dataclasses import asdict, dataclass, field
from pathlib import Path
from uuid import uuid4

from llm_core.config import settings
from llm_core.orchestrator import Orchestrator
from llm_core.schemas import Attachment, ChatRequest


HELP_TEXT = """
Команды:
  /help                      показать эту справку
  /exit                      выйти
  /status                    показать текущие user_id/chat_id и активные вложения
  /history                   показать недавнюю историю сообщений этого чата
  /memory                    показать текущий memory packet
  /new [chat_id]             начать новый чат
  /clear                     очистить активные вложения
  /file <path>               прикрепить файл ко всем следующим сообщениям
  /url <url>                 прикрепить URL ко всем следующим сообщениям
""".strip()


@dataclass
class ConsoleSession:
    user_id: str
    chat_id: str
    mode: str = "auto"
    selected_model: str | None = None
    active_attachments: list[Attachment] = field(default_factory=list)


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Console chat for the MTS MVP orchestrator.")
    parser.add_argument("--user-id", default="console-user", help="Stable user id for memory scope.")
    parser.add_argument("--chat-id", default="", help="Stable chat id. If omitted, a random id is generated.")
    parser.add_argument("--message", default="", help="Run a single request instead of interactive chat.")
    parser.add_argument(
        "--mode",
        default="auto",
        choices=["auto", "manual"],
        help="Routing mode. Use manual to force the selected model.",
    )
    parser.add_argument("--selected-model", default=None, help="Model id used when mode=manual.")
    parser.add_argument(
        "--show-memory",
        action="store_true",
        help="Print the current memory packet before sending a request.",
    )
    return parser


def build_request(session: ConsoleSession, message: str) -> ChatRequest:
    return ChatRequest(
        user_id=session.user_id,
        chat_id=session.chat_id,
        message=message,
        attachments=[clone_attachment(item) for item in session.active_attachments],
        mode=session.mode,
        selected_model=session.selected_model,
    )


def clone_attachment(attachment: Attachment) -> Attachment:
    return Attachment(
        type=attachment.type,
        file_id=attachment.file_id,
        url=attachment.url,
        mime_type=attachment.mime_type,
        metadata=dict(attachment.metadata),
    )


def print_response(response) -> None:
    print()
    print(f"Task type: {response.task_type}")
    print(f"Model used: {response.model_used}")
    print(f"Tools used: {response.tools_used}")
    print(f"Memory used: {response.memory_used}")
    print("Answer:")
    print(response.answer)


def print_memory(orchestrator: Orchestrator, session: ConsoleSession) -> None:
    packet = orchestrator.memory_policy.fetch(
        ChatRequest(
            user_id=session.user_id,
            chat_id=session.chat_id,
            message="Покажи текущее состояние памяти для этого чата",
            attachments=[clone_attachment(item) for item in session.active_attachments],
            mode=session.mode,
            selected_model=session.selected_model,
            task_type="text_chat",
        )
    )
    print(json.dumps(asdict(packet), ensure_ascii=False, indent=2))


def print_history(orchestrator: Orchestrator, session: ConsoleSession, limit: int = 8) -> None:
    history = orchestrator.memory_policy.fetch_recent_history(
        ChatRequest(
            user_id=session.user_id,
            chat_id=session.chat_id,
            message="",
            attachments=[],
            mode=session.mode,
            selected_model=session.selected_model,
            task_type="text_chat",
        ),
        limit=limit,
    )
    if not history:
        print("История чата пуста.")
        return

    for item in history:
        role_label = "User" if item["role"] == "user" else "Assistant"
        print(f"{role_label}: {item['content']}")


def describe_attachments(attachments: list[Attachment]) -> str:
    if not attachments:
        return "[]"

    parts: list[str] = []
    for index, attachment in enumerate(attachments, start=1):
        if attachment.type == "file":
            label = attachment.metadata.get("file_name") or attachment.file_id or "file"
            parts.append(f"{index}. file:{label}")
            continue
        if attachment.type == "url":
            parts.append(f"{index}. url:{attachment.url or attachment.metadata.get('url', '')}")
            continue
        parts.append(f"{index}. {attachment.type}")
    return "[" + "; ".join(parts) + "]"


def attach_file(orchestrator: Orchestrator, session: ConsoleSession, file_path: str) -> None:
    path = Path(file_path).expanduser().resolve()
    result = orchestrator.memory_policy.backend.ingestion.ingest_file(
        user_id=session.user_id,
        chat_id=session.chat_id,
        file_path=str(path),
    )
    attachment = Attachment(
        type="file",
        file_id=result.get("file_id"),
        mime_type=result.get("mime_type"),
        metadata={
            "file_path": str(path),
            "file_name": result.get("file_name", path.name),
            "ingestion_status": result.get("status", ""),
        },
    )
    session.active_attachments.append(attachment)
    print(f"Файл прикреплен: {path.name} ({result.get('file_id')}, status={result.get('status')})")


def attach_url(orchestrator: Orchestrator, session: ConsoleSession, url: str) -> None:
    result = orchestrator.memory_policy.backend.ingestion.ingest_url(
        user_id=session.user_id,
        chat_id=session.chat_id,
        url=url,
    )
    attachment = Attachment(
        type="url",
        url=url,
        metadata={
            "url": url,
            "link_id": result.get("link_id"),
            "title": result.get("title", ""),
            "ingestion_status": result.get("status", ""),
        },
    )
    session.active_attachments.append(attachment)
    print(f"URL прикреплен: {url} (status={result.get('status')})")


def run_single_message(orchestrator: Orchestrator, session: ConsoleSession, message: str, show_memory: bool) -> None:
    if show_memory:
        print("Memory packet before request:")
        print_memory(orchestrator, session)
        print()
    response = orchestrator.handle(build_request(session, message))
    print_response(response)


def handle_command(orchestrator: Orchestrator, session: ConsoleSession, raw_command: str) -> bool:
    try:
        tokens = shlex.split(raw_command)
    except ValueError as error:
        print(f"Не удалось разобрать команду: {error}")
        return True

    if not tokens:
        return True

    command = tokens[0].lower()
    args = tokens[1:]

    if command == "/help":
        print(HELP_TEXT)
        return True

    if command == "/exit":
        return False

    if command == "/status":
        print(f"user_id={session.user_id}")
        print(f"chat_id={session.chat_id}")
        print(f"mode={session.mode}")
        print(f"selected_model={session.selected_model}")
        print(f"attachments={describe_attachments(session.active_attachments)}")
        return True

    if command == "/memory":
        print_memory(orchestrator, session)
        return True

    if command == "/history":
        print_history(orchestrator, session)
        return True

    if command == "/new":
        session.chat_id = args[0] if args else f"chat-{uuid4().hex[:8]}"
        session.active_attachments.clear()
        print(f"Новый chat_id: {session.chat_id}")
        return True

    if command == "/clear":
        session.active_attachments.clear()
        print("Активные вложения очищены.")
        return True

    if command == "/file":
        if not args:
            print("Использование: /file /absolute/path/to/file")
            return True
        attach_file(orchestrator, session, " ".join(args))
        return True

    if command == "/url":
        if not args:
            print("Использование: /url https://example.com")
            return True
        attach_url(orchestrator, session, args[0])
        return True

    print(f"Неизвестная команда: {command}")
    print(HELP_TEXT)
    return True


def run_interactive_chat(orchestrator: Orchestrator, session: ConsoleSession, show_memory: bool) -> None:
    print("Console chat started.")
    print(f"user_id={session.user_id}")
    print(f"chat_id={session.chat_id}")
    print("Напиши сообщение или используй /help.")

    while True:
        try:
            raw_input_text = input("\nYou> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nВыход.")
            return

        if not raw_input_text:
            continue

        if raw_input_text.startswith("/"):
            if not handle_command(orchestrator, session, raw_input_text):
                print("Выход.")
                return
            continue

        run_single_message(orchestrator, session, raw_input_text, show_memory=show_memory)


def validate_settings() -> None:
    if settings.mws_api_key:
        return
    print("MWS_API_KEY не задан. Укажи ключ через export MWS_API_KEY='...'.")


def main() -> None:
    parser = make_parser()
    args = parser.parse_args()

    validate_settings()
    orchestrator = Orchestrator()
    session = ConsoleSession(
        user_id=args.user_id,
        chat_id=args.chat_id or f"chat-{uuid4().hex[:8]}",
        mode=args.mode,
        selected_model=args.selected_model,
    )

    if args.message:
        run_single_message(orchestrator, session, args.message, show_memory=args.show_memory)
        return

    run_interactive_chat(orchestrator, session, show_memory=args.show_memory)


if __name__ == "__main__":
    main()
