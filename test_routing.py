from dataclasses import dataclass

from llm_core.classifier import TaskClassifier
from llm_core.router import Router
from llm_core.schemas import Attachment, ChatRequest


@dataclass
class RoutingEvalCase:
    case_id: str
    description: str
    request: ChatRequest
    expected_task_type: str
    expected_model: str
    expected_tools: list[str]
    expected_memory: bool


def build_cases() -> list[RoutingEvalCase]:
    return [
        RoutingEvalCase(
            case_id="EC-01",
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
        RoutingEvalCase(
            case_id="EC-02",
            description="Follow-up с памятью",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Продолжи и скажи, зачем там нужен роутер моделей",
            ),
            expected_task_type="text_chat",
            expected_model="mws-gpt-alpha",
            expected_tools=[],
            expected_memory=True,
        ),
        RoutingEvalCase(
            case_id="EC-03",
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
        RoutingEvalCase(
            case_id="EC-04",
            description="Follow-up по файлу",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Какие 3 главные мысли в этом документе?",
                attachments=[Attachment(type="file", file_id="file-123")],
            ),
            expected_task_type="file_qa",
            expected_model="qwen2.5-72b-instruct",
            expected_tools=["retrieve_doc_context"],
            expected_memory=True,
        ),
        RoutingEvalCase(
            case_id="EC-05",
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
        RoutingEvalCase(
            case_id="EC-06",
            description="Web search для свежей информации",
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
        RoutingEvalCase(
            case_id="EC-06B",
            description="Погода уходит в web search",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Какая погода в Москве?",
            ),
            expected_task_type="web_search",
            expected_model="qwen2.5-72b-instruct",
            expected_tools=["web_search"],
            expected_memory=True,
        ),
        RoutingEvalCase(
            case_id="EC-06C",
            description="Запрос про сущность уходит в web search",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Расскажи про газана",
            ),
            expected_task_type="web_search",
            expected_model="qwen2.5-72b-instruct",
            expected_tools=["web_search"],
            expected_memory=True,
        ),
        RoutingEvalCase(
            case_id="EC-07",
            description="Анализ изображения",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Опиши, что изображено на картинке",
                attachments=[Attachment(type="image", file_id="img-001")],
            ),
            expected_task_type="image_understanding",
            expected_model="qwen2.5-vl",
            expected_tools=[],
            expected_memory=True,
        ),
        RoutingEvalCase(
            case_id="EC-08",
            description="Расшифровка аудио",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Расшифруй это аудио",
                attachments=[Attachment(type="audio", file_id="audio-001")],
            ),
            expected_task_type="audio_transcription",
            expected_model="whisper-turbo-local",
            expected_tools=[],
            expected_memory=False,
        ),
        RoutingEvalCase(
            case_id="EC-09",
            description="Генерация изображения",
            request=ChatRequest(
                user_id="u1",
                chat_id="c1",
                message="Сгенерируй изображение офисного AI-ассистента в минималистичном стиле",
            ),
            expected_task_type="image_generation",
            expected_model="qwen-image",
            expected_tools=[],
            expected_memory=False,
        ),
        RoutingEvalCase(
            case_id="EC-10",
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


def main() -> None:
    classifier = TaskClassifier()
    router = Router()
    cases = build_cases()

    passed = 0

    for case in cases:
        task_type = classifier.classify(case.request)
        decision = router.route(case.request, task_type)

        checks = {
            "task_type": task_type == case.expected_task_type,
            "model": decision.model == case.expected_model,
            "tools": decision.tool_calls == case.expected_tools,
            "memory": decision.use_memory == case.expected_memory,
        }
        case_passed = all(checks.values())
        passed += int(case_passed)

        status = "PASS" if case_passed else "FAIL"
        print(f"[{status}] {case.case_id} - {case.description}")
        print(f"  expected task_type: {case.expected_task_type}")
        print(f"  actual task_type:   {task_type}")
        print(f"  expected model:     {case.expected_model}")
        print(f"  actual model:       {decision.model}")
        print(f"  expected tools:     {case.expected_tools}")
        print(f"  actual tools:       {decision.tool_calls}")
        print(f"  expected memory:    {case.expected_memory}")
        print(f"  actual memory:      {decision.use_memory}")
        print()

    print(f"Итог: {passed}/{len(cases)} кейсов прошли успешно.")


if __name__ == "__main__":
    main()
