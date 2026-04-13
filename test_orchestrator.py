from dataclasses import dataclass

from llm_core.orchestrator import Orchestrator
from llm_core.schemas import Attachment, ChatRequest, MemoryPacket, ToolResult


class StubMemoryPolicy:
    def should_fetch(self, task_type: str) -> bool:
        return task_type not in {"audio_transcription", "image_generation"}

    def should_store(self, request: ChatRequest, answer: str) -> bool:
        return True

    def fetch(self, request: ChatRequest) -> MemoryPacket:
        return MemoryPacket(
            chat_summary="Пользователь делает MVP AI workspace.",
            user_facts=["Пользователь отвечает за LLM orchestration."],
            preferences=["Предпочитает короткие и практичные ответы."],
            relevant_docs=["OpenWebUI notes"],
            ongoing_tasks=["Согласовать memory и tools backend."],
        )

    def build_writeback(self, request: ChatRequest, answer: str) -> dict[str, str]:
        return {
            "user_id": request.user_id,
            "chat_id": request.chat_id,
            "summary_candidate": request.message[:200],
            "answer_preview": answer[:200],
        }


class StubToolExecutor:
    def run(self, tool_name: str, request: ChatRequest) -> ToolResult:
        content_by_tool = {
            "retrieve_doc_context": "Из документа извлечены 3 релевантных чанка по теме MVP и memory.",
            "parse_url": "На странице описаны ключевые функции продукта и единый AI-интерфейс.",
            "web_search": "Поиск вернул 2 свежих сниппета по теме запроса.",
        }
        return ToolResult(
            name=tool_name,
            content=content_by_tool.get(tool_name, "Нет данных."),
            metadata={"tool_name": tool_name},
        )


class StubMWSClient:
    def chat_completion(self, model: str, system_prompt: str, user_prompt: str) -> str:
        return (
            f"STUB_ANSWER model={model} "
            f"system_prompt_len={len(system_prompt)} "
            f"user_prompt_len={len(user_prompt)}"
        )


@dataclass
class OrchestratorEvalCase:
    case_id: str
    description: str
    request: ChatRequest
    expected_task_type: str
    expected_model: str
    expected_tools: list[str]
    expected_memory: bool


def build_cases() -> list[OrchestratorEvalCase]:
    return [
        OrchestratorEvalCase(
            case_id="ORCH-01",
            description="Обычный текстовый чат",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Привет! Коротко объясни, что такое RAG.",
            ),
            expected_task_type="text_chat",
            expected_model="mws-gpt-alpha",
            expected_tools=[],
            expected_memory=True,
        ),
        OrchestratorEvalCase(
            case_id="ORCH-02",
            description="Вопрос по файлу",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Сделай краткое summary файла",
                attachments=[Attachment(type="file", file_id="file-123")],
            ),
            expected_task_type="file_qa",
            expected_model="qwen2.5-72b-instruct",
            expected_tools=["retrieve_doc_context"],
            expected_memory=True,
        ),
        OrchestratorEvalCase(
            case_id="ORCH-03",
            description="Summary по ссылке",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Посмотри https://example.com и дай короткое summary",
            ),
            expected_task_type="url_summary",
            expected_model="qwen2.5-72b-instruct",
            expected_tools=["parse_url"],
            expected_memory=True,
        ),
        OrchestratorEvalCase(
            case_id="ORCH-04",
            description="Web search",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Проверь в интернете последние новости про OpenAI",
            ),
            expected_task_type="web_search",
            expected_model="qwen2.5-72b-instruct",
            expected_tools=["web_search"],
            expected_memory=True,
        ),
        OrchestratorEvalCase(
            case_id="ORCH-05",
            description="Ручной выбор модели",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Ответь этой моделью",
                mode="manual",
                selected_model="llama-3.3-70b-instruct",
            ),
            expected_task_type="text_chat",
            expected_model="llama-3.3-70b-instruct",
            expected_tools=[],
            expected_memory=True,
        ),
    ]


def build_test_orchestrator() -> Orchestrator:
    orchestrator = Orchestrator()
    orchestrator.memory_policy = StubMemoryPolicy()
    orchestrator.tools = StubToolExecutor()
    orchestrator.client = StubMWSClient()
    return orchestrator


def main() -> None:
    orchestrator = build_test_orchestrator()
    cases = build_cases()
    passed = 0

    for case in cases:
        response = orchestrator.handle(case.request)

        checks = {
            "task_type": response.task_type == case.expected_task_type,
            "model": response.model_used == case.expected_model,
            "tools": response.tools_used == case.expected_tools,
            "memory": response.memory_used == case.expected_memory,
            "answer": isinstance(response.answer, str) and len(response.answer) > 0,
        }
        case_passed = all(checks.values())
        passed += int(case_passed)

        status = "PASS" if case_passed else "FAIL"
        print(f"[{status}] {case.case_id} - {case.description}")
        print(f"  expected task_type: {case.expected_task_type}")
        print(f"  actual task_type:   {response.task_type}")
        print(f"  expected model:     {case.expected_model}")
        print(f"  actual model:       {response.model_used}")
        print(f"  expected tools:     {case.expected_tools}")
        print(f"  actual tools:       {response.tools_used}")
        print(f"  expected memory:    {case.expected_memory}")
        print(f"  actual memory:      {response.memory_used}")
        print(f"  answer preview:     {response.answer[:120]}")
        print()

    print(f"Итог: {passed}/{len(cases)} orchestration-кейсов прошли успешно.")


if __name__ == "__main__":
    main()
