from llm_core.schemas import ChatRequest, MemoryPacket, ToolResult


def _is_short_correction(message: str) -> bool:
    normalized = " ".join(message.lower().strip().split())
    if not normalized:
        return False
    correction_markers = {
        "нет",
        "неа",
        "не",
        "не так",
        "неверно",
        "неправильно",
        "не совсем",
        "мимо",
        "ошибка",
        "это не так",
        "no",
        "nope",
        "wrong",
        "not really",
    }
    if normalized in correction_markers:
        return True
    if len(normalized.split()) <= 4 and any(marker in normalized for marker in correction_markers):
        return True
    return False


def _is_brief_followup(message: str) -> bool:
    normalized = " ".join(message.lower().strip().split())
    if not normalized:
        return False
    followup_markers = {
        "да",
        "ага",
        "угу",
        "ок",
        "окей",
        "да хочу",
        "хочу",
        "именно",
        "верно",
        "продолжай",
        "ну да",
    }
    if normalized in followup_markers:
        return True
    if len(normalized.split()) <= 4 and any(marker in normalized for marker in followup_markers):
        return True
    return False


def _is_acknowledgement(message: str) -> bool:
    normalized = " ".join(message.lower().strip().split())
    acknowledgements = {
        "ясно",
        "понятно",
        "ок",
        "окей",
        "хорошо",
        "ладно",
        "принято",
        "спасибо",
        "ясненько",
    }
    if normalized in acknowledgements:
        return True
    return False


def _is_new_standalone_question(message: str) -> bool:
    normalized = " ".join(message.lower().strip().split())
    if not normalized:
        return False
    if not ("?" in normalized or normalized.startswith(("как ", "какая ", "какой ", "какие ", "кто ", "что ", "где ", "когда "))):
        return False
    context_dependent_markers = (
        "это",
        "этот",
        "эта",
        "эти",
        "там",
        "тут",
        "по нему",
        "по ней",
        "по этому",
        "про него",
        "про нее",
        "продолжи",
        "еще",
    )


def _looks_like_code_request(message: str) -> bool:
    normalized = (message or "").lower()
    markers = (
        "код", "code", "python", "javascript", "typescript", "react", "html", "css",
        "sql", "bash", "скрипт", "bug", "debug", "ошиб", "program", "algorithm",
    )
    return any(marker in normalized for marker in markers)


def _dialogue_signals(message: str) -> dict[str, bool]:
    return {
        "is_short_correction": _is_short_correction(message),
        "is_brief_followup": _is_brief_followup(message),
        "is_acknowledgement": _is_acknowledgement(message),
        "is_new_standalone_question": _is_new_standalone_question(message),
    }
    return not any(marker in normalized for marker in context_dependent_markers)


def build_system_prompt(task_type: str) -> str:
    base_prompt = (
        "Ты являешься основным ассистентом внутри корпоративного AI workspace.\n"
        f"Текущий тип задачи: {task_type}.\n"
        "Твоя задача — отвечать точно, ясно и аккуратно работать с контекстом.\n"
        "Всегда отвечай на языке пользователя, если пользователь явно не попросил другой язык.\n"
        "Используй память и результаты инструментов только тогда, когда они реально относятся к текущему запросу.\n"
        "Не придумывай факты, которых нет в сообщении пользователя, памяти или результатах инструментов.\n"
        "Если контекста недостаточно или он слабый, скажи об этом прямо и отвечай осторожно.\n"
        "Предпочитай короткие и структурированные ответы вместо длинных общих рассуждений.\n"
        "Если пишешь код, по умолчанию используй английские имена переменных, функций, классов и комментарии в коде, если пользователь явно не попросил русский код.\n"
        "Если текущее сообщение пользователя выглядит как короткая коррекция или несогласие, "
        "считай это сигналом, что прошлый ответ мог быть неверным.\n"
        "В таком случае не пересказывай память и не делай длинный recap; кратко признай возможную ошибку "
        "и уточни, что именно нужно исправить.\n"
    )

    task_instructions = {
        "text_chat": (
            "Сфокусируйся на полезном, прямом и контекстно-осознанном ответе.\n"
            "Если память релевантна, используй ее естественно, не раскрывая внутреннюю системную логику без необходимости."
        ),
        "file_qa": (
            "Используй контекст документа как основной источник истины.\n"
            "Если ответ зависит от переданного файла, опирайся именно на этот контекст.\n"
            "Если контекста файла недостаточно, явно скажи, чего не хватает."
        ),
        "url_summary": (
            "Точно суммируй распарсенную страницу.\n"
            "Выделяй главное, избегай воды и отмечай неопределенность, если контент страницы выглядит неполным."
        ),
        "web_search": (
            "Используй результаты поиска как внешние подтверждения.\n"
            "Отдавай приоритет фактическому ответу и отмечай, когда информации нужна дополнительная проверка."
        ),
        "image_understanding": (
            "Аккуратно используй визуальный контекст.\n"
            "Описывай только то, что действительно подтверждается предоставленным визуальным контекстом."
        ),
        "audio_transcription": (
            "Верни чистую и точную расшифровку аудио или коротко объясни ограничение, если расшифровка недоступна."
        ),
        "image_generation": (
            "Помоги преобразовать намерение пользователя в точный результат для генерации изображения."
        ),
    }

    return base_prompt + "\n" + task_instructions.get(
        task_type,
        "Дай полезный ответ, опираясь на доступный контекст.",
    )


def build_user_prompt(
    request: ChatRequest,
    memory: MemoryPacket,
    tool_results: list[ToolResult],
    recent_history: list[dict[str, str]] | None = None,
) -> str:
    sections: list[str] = []
    signals = _dialogue_signals(request.message)
    is_short_correction = signals["is_short_correction"]
    is_brief_followup = signals["is_brief_followup"]
    is_acknowledgement = signals["is_acknowledgement"]
    is_new_standalone_question = signals["is_new_standalone_question"]
    recent_history = recent_history or []
    code_request = _looks_like_code_request(request.message)

    if recent_history:
        history_lines: list[str] = []
        for item in recent_history[-8:]:
            role_label = "Пользователь" if item.get("role") == "user" else "Ассистент"
            content = item.get("content", "").strip()
            if not content:
                continue
            if len(content) > 220:
                content = content[:219].rstrip() + "…"
            history_lines.append(f"{role_label}: {content}")
        if history_lines:
            sections.append("НЕДАВНЯЯ ИСТОРИЯ ЧАТА:")
            sections.append("\n".join(history_lines))

    if is_short_correction:
        sections.append("СИГНАЛ ДИАЛОГА:")
        sections.append(
            "Пользователь кратко исправляет или уточняет предыдущий ответ. "
            "Это продолжение текущего диалога, а не новый независимый запрос."
        )
    elif is_acknowledgement:
        sections.append("СИГНАЛ ДИАЛОГА:")
        sections.append(
            "Пользователь просто подтвердил, что понял, или завершил мысль. "
            "Не нужно продолжать старую тему длинным сообщением без явного запроса."
        )
    elif is_brief_followup:
        sections.append("СИГНАЛ ДИАЛОГА:")
        sections.append(
            "Пользователь кратко подтверждает или продолжает предыдущий запрос. "
            "Если из недавней истории понятен незавершенный вопрос, отвечай по существу, а не мета-фразой."
        )
    elif is_new_standalone_question:
        sections.append("СИГНАЛ ДИАЛОГА:")
        sections.append(
            "Похоже, пользователь задал новый самостоятельный вопрос. "
            "Не притягивай прошлую тему разговора, если текущий вопрос не ссылается на нее явно."
        )

    if code_request:
        sections.append("ПРАВИЛО ДЛЯ КОДА:")
        sections.append(
            "Если в ответе есть код, используй английские имена переменных, функций, классов, файлов и комментарии внутри кода, "
            "если пользователь явно не попросил русский язык именно для кода."
        )

    if request.attachments:
        attachment_lines = []
        for attachment in request.attachments:
            parts = [f"type={attachment.type}"]
            if attachment.file_id:
                parts.append(f"file_id={attachment.file_id}")
            if attachment.url:
                parts.append(f"url={attachment.url}")
            if attachment.mime_type:
                parts.append(f"mime_type={attachment.mime_type}")
            attachment_lines.append("- " + ", ".join(parts))
        sections.append("АКТИВНЫЕ ВЛОЖЕНИЯ ИЛИ ИСТОЧНИКИ:")
        sections.append("\n".join(attachment_lines))

    if memory.chat_summary:
        sections.append("ФОНОВАЯ ПАМЯТЬ О ЧАТЕ:")
        sections.append(
            memory.chat_summary
            + "\nИспользуй это только как фон. Если недавняя история чата или текущее сообщение точнее, они важнее summary."
        )

    if memory.user_facts:
        sections.append("ДОЛГОСРОЧНЫЕ ФАКТЫ О ПОЛЬЗОВАТЕЛЕ:")
        sections.append("\n".join(f"- {fact}" for fact in memory.user_facts))

    if memory.preferences:
        sections.append("ПРЕДПОЧТЕНИЯ ПОЛЬЗОВАТЕЛЯ:")
        sections.append("\n".join(f"- {item}" for item in memory.preferences))

    if memory.relevant_docs:
        sections.append("РЕЛЕВАНТНЫЕ ДОКУМЕНТЫ ИЗ ПАМЯТИ:")
        sections.append("\n".join(f"- {item}" for item in memory.relevant_docs))

    if memory.ongoing_tasks:
        sections.append("ТЕКУЩИЕ ЗАДАЧИ И КОНТЕКСТ:")
        sections.append("\n".join(f"- {item}" for item in memory.ongoing_tasks))

    for tool_result in tool_results:
        sections.append(f"РЕЗУЛЬТАТ ИНСТРУМЕНТА: {tool_result.name}")
        sections.append(tool_result.content)

        if tool_result.metadata:
            metadata_lines = [f"- {key}: {value}" for key, value in tool_result.metadata.items()]
            sections.append("МЕТАДАННЫЕ ИНСТРУМЕНТА:")
            sections.append("\n".join(metadata_lines))

    sections.append("ПРАВИЛА ОТВЕТА:")
    rules = [
        "- Для качества диалога сначала ориентируйся на недавнюю историю чата в рамках этого chat_id.",
        "- Используй доступный контекст только если он действительно релевантен.",
        "- Если память конфликтует с текущим сообщением пользователя, приоритет у текущего сообщения.",
        "- Если результаты инструментов неполные, кратко отметь ограничение.",
        "- Не упоминай скрытую маршрутизацию или внутреннюю оркестрацию, если пользователь сам об этом не спросил.",
        "- Если пользователь задал новый самостоятельный вопрос, отвечай на него напрямую и не тащи старую тему без причины.",
        "- Если имя, ник, бренд или сущность тебе не известны, не выдумывай. Лучше честно скажи, что не уверен, и при необходимости предложи поиск.",
    ]
    if is_short_correction:
        rules.append(
            "- Для короткой коррекции не делай recap и не пересказывай память. Коротко признай возможную ошибку и либо исправь ответ, либо задай один уточняющий вопрос."
        )
    elif is_acknowledgement:
        rules.append(
            "- Для краткого подтверждения отвечай минимально: коротко закрой ход или предложи новую тему одним предложением."
        )
    elif is_brief_followup:
        rules.append(
            "- Для краткого follow-up используй недавнюю историю и продолжай ответ по существу. Не отвечай фразами вроде 'если хочешь, я готов помочь', если намерение уже понятно."
        )
    sections.append("\n".join(rules))

    sections.append("ТЕКУЩЕЕ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ:")
    sections.append(request.message)

    return "\n\n".join(sections)


def build_context_prompt(
    request: ChatRequest,
    memory: MemoryPacket,
    tool_results: list[ToolResult],
) -> str:
    sections: list[str] = []
    signals = _dialogue_signals(request.message)
    code_request = _looks_like_code_request(request.message)

    if signals["is_short_correction"]:
        sections.append("СИГНАЛ ДИАЛОГА:")
        sections.append(
            "Пользователь кратко исправляет или уточняет предыдущий ответ. "
            "Это продолжение текущего диалога, а не новый независимый запрос."
        )
    elif signals["is_acknowledgement"]:
        sections.append("СИГНАЛ ДИАЛОГА:")
        sections.append(
            "Пользователь просто подтвердил, что понял, или завершил мысль. "
            "Не нужно продолжать старую тему длинным сообщением без явного запроса."
        )
    elif signals["is_brief_followup"]:
        sections.append("СИГНАЛ ДИАЛОГА:")
        sections.append(
            "Пользователь кратко подтверждает или продолжает предыдущий запрос. "
            "Если из недавней истории понятен незавершенный вопрос, отвечай по существу, а не мета-фразой."
        )
    elif signals["is_new_standalone_question"]:
        sections.append("СИГНАЛ ДИАЛОГА:")
        sections.append(
            "Похоже, пользователь задал новый самостоятельный вопрос. "
            "Не притягивай прошлую тему разговора, если текущий вопрос не ссылается на нее явно."
        )

    if code_request:
        sections.append("ПРАВИЛО ДЛЯ КОДА:")
        sections.append(
            "Если в ответе есть код, используй английские имена переменных, функций, классов, файлов и комментарии внутри кода, "
            "если пользователь явно не попросил русский язык именно для кода."
        )

    if request.attachments:
        attachment_lines = []
        for attachment in request.attachments:
            parts = [f"type={attachment.type}"]
            if attachment.file_id:
                parts.append(f"file_id={attachment.file_id}")
            if attachment.url:
                parts.append(f"url={attachment.url}")
            if attachment.mime_type:
                parts.append(f"mime_type={attachment.mime_type}")
            attachment_lines.append("- " + ", ".join(parts))
        sections.append("АКТИВНЫЕ ВЛОЖЕНИЯ ИЛИ ИСТОЧНИКИ:")
        sections.append("\n".join(attachment_lines))

    if memory.chat_summary:
        sections.append("ФОНОВАЯ ПАМЯТЬ О ЧАТЕ:")
        sections.append(
            memory.chat_summary
            + "\nИспользуй это только как фон. Если живая история диалога точнее, она важнее summary."
        )

    if memory.user_facts:
        sections.append("ДОЛГОСРОЧНЫЕ ФАКТЫ О ПОЛЬЗОВАТЕЛЕ:")
        sections.append("\n".join(f"- {fact}" for fact in memory.user_facts))

    if memory.preferences:
        sections.append("ПРЕДПОЧТЕНИЯ ПОЛЬЗОВАТЕЛЯ:")
        sections.append("\n".join(f"- {item}" for item in memory.preferences))

    if memory.relevant_docs:
        sections.append("РЕЛЕВАНТНЫЕ ДОКУМЕНТЫ ИЗ ПАМЯТИ:")
        sections.append("\n".join(f"- {item}" for item in memory.relevant_docs))

    if memory.ongoing_tasks:
        sections.append("ТЕКУЩИЕ ЗАДАЧИ И КОНТЕКСТ:")
        sections.append("\n".join(f"- {item}" for item in memory.ongoing_tasks))

    for tool_result in tool_results:
        sections.append(f"РЕЗУЛЬТАТ ИНСТРУМЕНТА: {tool_result.name}")
        sections.append(tool_result.content)
        if tool_result.metadata:
            metadata_lines = [f"- {key}: {value}" for key, value in tool_result.metadata.items()]
            sections.append("МЕТАДАННЫЕ ИНСТРУМЕНТА:")
            sections.append("\n".join(metadata_lines))

    sections.append("ПРАВИЛА КОНТЕКСТА:")
    rules = [
        "- История чата уже будет передана отдельными сообщениями, считай ее главным контекстом диалога.",
        "- Используй память и tool results только если они реально помогают ответу.",
        "- Если пользователь задал новый самостоятельный вопрос, отвечай на него напрямую и не тащи старую тему без причины.",
        "- Если имя, ник, бренд или сущность тебе не известны, не выдумывай. Лучше честно скажи, что не уверен, и опирайся на web/tool context.",
    ]
    if signals["is_short_correction"]:
        rules.append(
            "- Для короткой коррекции не делай recap. Коротко признай ошибку и либо исправь ответ, либо задай один уточняющий вопрос."
        )
    elif signals["is_acknowledgement"]:
        rules.append(
            "- Для краткого подтверждения отвечай минимально и не продолжай старую тему без просьбы."
        )
    elif signals["is_brief_followup"]:
        rules.append(
            "- Для краткого follow-up продолжай по существу на основе живой истории. Не отвечай мета-фразами о готовности помочь."
        )
    sections.append("\n".join(rules))

    return "\n\n".join(sections)
