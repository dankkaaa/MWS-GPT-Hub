from io import BytesIO

from llm_core.orchestrator import Orchestrator
from web_app import create_app
from llm_core.backend_services import BackendServices


class StubWebClient:
    def chat_completion(self, model: str, system_prompt: str, user_prompt: str) -> str:
        return f"WEB_STUB model={model} prompt={len(user_prompt)}"

    def chat_completion_with_history(
        self,
        model: str,
        system_prompt: str,
        conversation_history: list[dict[str, str]],
        user_message: str,
        context_prompt: str = "",
    ) -> str:
        return (
            f"WEB_STUB model={model} "
            f"history={len(conversation_history)} "
            f"message={user_message[:40]}"
        )


def build_test_app(tmp_path):
    db_path = tmp_path / "web-test.db"
    upload_dir = tmp_path / "uploads"
    backend = BackendServices(db_path=db_path)
    orchestrator = Orchestrator()
    orchestrator.memory_policy.backend = backend
    orchestrator.tools.backend = backend
    orchestrator.client = StubWebClient()
    return create_app(orchestrator=orchestrator, backend=backend, upload_dir=upload_dir)


def test_web_chat_flow(tmp_path):
    app = build_test_app(tmp_path)
    client = app.test_client()

    create_response = client.post("/api/chats", json={"user_id": "web-user"})
    assert create_response.status_code == 200
    chat = create_response.get_json()["chat"]
    chat_id = chat["chat_id"]

    upload_response = client.post(
        "/api/uploads",
        data={
            "user_id": "web-user",
            "chat_id": chat_id,
            "file": (BytesIO(b"alpha beta gamma"), "notes.txt"),
        },
        content_type="multipart/form-data",
    )
    assert upload_response.status_code == 200
    upload_payload = upload_response.get_json()
    assert upload_payload["attachment"]["type"] == "file"
    assert upload_payload["file"]["status"] == "indexed"
    assert any(message["message_kind"] == "file_upload" for message in upload_payload["messages"])

    send_response = client.post(
        f"/api/chats/{chat_id}/messages",
        json={
            "user_id": "web-user",
            "message": "Что в файле?",
            "attachments": [upload_payload["attachment"]],
            "mode": "auto",
        },
    )
    assert send_response.status_code == 200
    send_payload = send_response.get_json()
    assert send_payload["response"]["task_type"] == "file_qa"
    assert send_payload["response"]["tools_used"] == ["retrieve_doc_context"]
    assert send_payload["messages"][-1]["role"] == "assistant"
    assert send_payload["messages"][-1]["tool_outputs"]
    assert send_payload["messages"][-1]["sources"]

    memory_response = client.get(f"/api/chats/{chat_id}/memory?user_id=web-user")
    assert memory_response.status_code == 200
    assert "chat_summary" in memory_response.get_json()["memory"]
