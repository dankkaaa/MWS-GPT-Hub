from llm_core.schemas import ChatRequest


class TaskClassifier:
    def classify(self, request: ChatRequest) -> str:
        if request.attachments:
            attachment_types = {attachment.type for attachment in request.attachments}

            if "audio" in attachment_types:
                return "audio_transcription"
            if "image" in attachment_types:
                return "image_understanding"
            if "file" in attachment_types:
                return "file_qa"
            if "url" in attachment_types:
                return "url_summary"

        lowered = request.message.lower()

        if "http://" in lowered or "https://" in lowered:
            return "url_summary"
        if any(
            token in lowered
            for token in (
                "найди",
                "поиск",
                "search",
                "latest",
                "проверь в интернете",
                "в интернете",
                "в сети",
                "свежие данные",
                "актуальн",
                "погода",
                "температура",
                "прогноз",
                "новости",
                "сейчас в москве",
                "курс валют",
            )
        ):
            return "web_search"
        if any(
            pattern in lowered
            for pattern in (
                "кто такой ",
                "кто такая ",
                "кто такие ",
                "что за ",
                "расскажи про ",
                "расскажи что-то про ",
                "что ты знаешь про ",
            )
        ):
            return "web_search"
        if any(
            token in lowered
            for token in (
                "нарисуй",
                "сгенерируй ",
                "сгенерируй картинку",
                "сгенерируй изображение",
                "сгенерируй фото",
                "сгенерируй арт",
                "сгенерируй иллюстрацию",
                "generate image",
                "create image",
                "создай картинку",
                "создай изображение",
                "создай арт",
                "создай иллюстрацию",
                "image generation",
            )
        ):
            return "image_generation"

        return "text_chat"
