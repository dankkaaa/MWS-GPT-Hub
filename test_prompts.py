from llm_core.prompts import build_system_prompt, build_user_prompt
from llm_core.schemas import ChatRequest, MemoryPacket


def test_short_correction_prompt_adds_repair_signal() -> None:
    prompt = build_user_prompt(
        request=ChatRequest(
            user_id="u1",
            chat_id="c1",
            message="нет",
        ),
        memory=MemoryPacket(
            chat_summary="Пользователь спросил про Mellstroy, ассистент ответил не по теме.",
            user_facts=[],
            preferences=[],
            relevant_docs=[],
            ongoing_tasks=[],
        ),
        tool_results=[],
        recent_history=[
            {"role": "user", "content": "кто такой mellstroy"},
            {"role": "assistant", "content": "Неверный ответ не по теме."},
        ],
    )
    assert "СИГНАЛ ДИАЛОГА:" in prompt
    assert "Это продолжение текущего диалога" in prompt
    assert "не делай recap" in prompt
    assert "НЕДАВНЯЯ ИСТОРИЯ ЧАТА:" in prompt


def test_regular_prompt_does_not_add_correction_signal() -> None:
    prompt = build_user_prompt(
        request=ChatRequest(
            user_id="u1",
            chat_id="c1",
            message="Расскажи кто такой Mellstroy",
        ),
        memory=MemoryPacket(),
        tool_results=[],
        recent_history=[{"role": "user", "content": "Привет"}],
    )
    assert "СИГНАЛ ДИАЛОГА:" not in prompt
    assert "НЕДАВНЯЯ ИСТОРИЯ ЧАТА:" in prompt
    assert prompt.rstrip().endswith("Расскажи кто такой Mellstroy")


def test_brief_followup_prompt_asks_model_to_continue_substantively() -> None:
    prompt = build_user_prompt(
        request=ChatRequest(
            user_id="u1",
            chat_id="c1",
            message="да хочу",
        ),
        memory=MemoryPacket(),
        tool_results=[],
        recent_history=[
            {"role": "user", "content": "кто такой газан"},
            {"role": "assistant", "content": "Уточни, о ком именно идет речь."},
        ],
    )
    assert "СИГНАЛ ДИАЛОГА:" in prompt
    assert "подтверждает или продолжает предыдущий запрос" in prompt
    assert "Не отвечай фразами вроде 'если хочешь, я готов помочь'" in prompt


def test_acknowledgement_prompt_asks_for_minimal_reply() -> None:
    prompt = build_user_prompt(
        request=ChatRequest(
            user_id="u1",
            chat_id="c1",
            message="ясно",
        ),
        memory=MemoryPacket(),
        tool_results=[],
        recent_history=[
            {"role": "user", "content": "расскажи про газан"},
            {"role": "assistant", "content": "Длинный ответ про газан."},
        ],
    )
    assert "Пользователь просто подтвердил" in prompt
    assert "отвечай минимально" in prompt


def test_new_standalone_question_discourages_dragging_old_topic() -> None:
    prompt = build_user_prompt(
        request=ChatRequest(
            user_id="u1",
            chat_id="c1",
            message="как дела у тебя?",
        ),
        memory=MemoryPacket(chat_summary="Недавно обсуждали газан."),
        tool_results=[],
        recent_history=[
            {"role": "user", "content": "расскажи про газан"},
            {"role": "assistant", "content": "Ответ про газан."},
        ],
    )
    assert "новый самостоятельный вопрос" in prompt
    assert "не тащи старую тему без причины" in prompt


def test_system_prompt_mentions_short_corrections() -> None:
    system_prompt = build_system_prompt("text_chat")
    assert "короткая коррекция" in system_prompt
    assert "не делай длинный recap" in system_prompt
    assert "Не придумывай факты" in system_prompt
