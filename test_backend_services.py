from pathlib import Path

from llm_core.backend_services import BackendServices
from llm_core.memory_policy import MemoryPolicy
from llm_core.schemas import Attachment, ChatRequest
from llm_core.tools import ToolExecutor


class FakeResponse:
    def __init__(self, text: str, content_type: str = "text/html", status_code: int = 200) -> None:
        self.text = text
        self.headers = {"content-type": content_type}
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def test_memory_roundtrip_and_file_retrieval(tmp_path: Path) -> None:
    db_path = tmp_path / "memory.db"
    backend = BackendServices(db_path=db_path)
    source_file = tmp_path / "memory_notes.txt"
    source_file.write_text(
        (
            "OpenWebUI memory backend should keep storage, retrieval and clean context. "
            "Document chunks must mention file metadata and stable source references."
        ),
        encoding="utf-8",
    )

    ingest_result = backend.ingestion.ingest_file(
        user_id="u1",
        chat_id="c1",
        file_path=str(source_file),
        file_id="file-123",
    )
    assert ingest_result["status"] == "indexed"
    assert ingest_result["file_id"] == "file-123"

    write_result = backend.memory.write_memory(
        user_id="u1",
        chat_id="c1",
        message=(
            "Мы строим AI workspace на базе OpenWebUI. "
            "Мне важен стабильный контракт ответа. "
            "Реализовать storage для memory и retrieval."
        ),
        answer="Собрал backend для memory, storage и retrieval.",
        task_type="text_chat",
        attachments=[Attachment(type="file", file_id="file-123")],
    )
    assert write_result["stored"] is True
    assert "Недавний контекст" in write_result["chat_summary"]

    memory_packet = backend.memory.fetch_memory_context(
        user_id="u1",
        chat_id="c1",
        message="Продолжи retrieval для memory storage и файла",
        task_type="file_qa",
        attachments=[Attachment(type="file", file_id="file-123")],
    )
    assert any("стабильный контракт" in item.lower() for item in memory_packet["preferences"])
    assert any("storage" in item.lower() or "retrieval" in item.lower() for item in memory_packet["ongoing_tasks"])
    assert memory_packet["relevant_docs"]
    assert "file-123:chunk-" in memory_packet["relevant_docs"][0]

    tool_result = backend.tools.retrieve_doc_context(
        ChatRequest(
            user_id="u1",
            chat_id="c1",
            message="Что сказано про source references?",
            attachments=[Attachment(type="file", file_id="file-123")],
            task_type="file_qa",
        )
    )
    assert tool_result.name == "retrieve_doc_context"
    assert "[Source: file-123:chunk-" in tool_result.content
    assert tool_result.metadata["sources"]


def test_short_followup_does_not_pull_unrelated_memory_fields(tmp_path: Path) -> None:
    backend = BackendServices(db_path=tmp_path / "memory.db")
    backend.memory.write_memory(
        user_id="u1",
        chat_id="c1",
        message="Мне важен стабильный контракт ответа. Реализовать storage и retrieval для backend памяти.",
        answer="Ок, соберу backend.",
        task_type="text_chat",
    )

    packet = backend.memory.fetch_memory_context(
        user_id="u1",
        chat_id="c1",
        message="да",
        task_type="text_chat",
    )

    assert packet["chat_summary"]
    assert packet["preferences"] == []
    assert packet["ongoing_tasks"] == []
    assert packet["relevant_docs"] == []


def test_questions_do_not_become_user_facts_or_tasks(tmp_path: Path) -> None:
    backend = BackendServices(db_path=tmp_path / "memory.db")
    backend.memory.write_memory(
        user_id="u1",
        chat_id="c1",
        message="Как у тебя дела и какая погода в Москве?",
        answer="Нормально, а по погоде лучше сходить в поиск.",
        task_type="text_chat",
    )

    packet = backend.memory.fetch_memory_context(
        user_id="u1",
        chat_id="c1",
        message="ок",
        task_type="text_chat",
    )

    assert packet["user_facts"] == []
    assert packet["ongoing_tasks"] == []


def test_parse_url_web_search_and_wrapper_integration(tmp_path: Path, monkeypatch) -> None:
    db_path = tmp_path / "memory.db"

    def fake_get(url: str, *args, **kwargs):  # type: ignore[no-untyped-def]
        if url == "https://example.com":
            return FakeResponse(
                """
                <html>
                  <head><title>Example Page</title></head>
                  <body>
                    <main>
                      <h1>Memory backend</h1>
                      <p>File upload, parse, chunk and index are implemented.</p>
                    </main>
                  </body>
                </html>
                """
            )
        if "duckduckgo" in url:
            return FakeResponse(
                """
                <html>
                  <div class="result">
                    <a class="result__a" href="https://docs.example.com/memory">Memory Docs</a>
                    <a class="result__snippet">Stable memory packet and retrieval API.</a>
                  </div>
                </html>
                """
            )
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr("llm_core.backend_services.requests.get", fake_get)

    backend = BackendServices(db_path=db_path)
    request = ChatRequest(
        user_id="u1",
        chat_id="c1",
        message="Сделай summary страницы https://example.com",
        task_type="url_summary",
    )

    parsed = backend.tools.parse_url(request)
    assert parsed.name == "parse_url"
    assert parsed.metadata["title"] == "Example Page"
    assert parsed.metadata["url"] == "https://example.com"
    assert "Memory backend" in parsed.content
    assert parsed.metadata["sources"]

    search_result = backend.tools.web_search(
        ChatRequest(
            user_id="u1",
            chat_id="c1",
            message="Найди stable memory packet",
            task_type="web_search",
        )
    )
    assert search_result.name == "web_search"
    assert "Memory Docs" in search_result.content
    assert search_result.metadata["sources"] == ["https://docs.example.com/memory"]

    policy = MemoryPolicy(db_path=str(db_path))
    executor = ToolExecutor(db_path=str(db_path))

    policy_request = ChatRequest(
        user_id="u1",
        chat_id="c1",
        message="Мне важен clean context по страницам",
        task_type="url_summary",
    )
    policy.build_writeback(policy_request, "Ок, контекст будет коротким.")
    packet = policy.fetch(policy_request)
    assert any("clean context" in item.lower() for item in packet.preferences)

    tool_via_executor = executor.run("parse_url", request)
    assert tool_via_executor.metadata["url"] == "https://example.com"
