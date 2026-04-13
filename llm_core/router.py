from llm_core.model_registry import (
    ASR_MODEL,
    DEFAULT_CHAT_MODEL,
    IMAGE_GEN_MODEL,
    STRONG_CHAT_MODEL,
    VISION_MODEL,
)
from llm_core.schemas import ChatRequest, RoutingDecision


class Router:
    def route(self, request: ChatRequest, task_type: str) -> RoutingDecision:
        tool_calls = self._tool_calls_for_task(task_type)
        use_memory = self._use_memory_for_task(task_type)
        endpoint_kind = self._endpoint_kind_for_task(task_type)

        if request.mode == "manual" and request.selected_model:
            return RoutingDecision(
                task_type=task_type,
                model=request.selected_model,
                endpoint_kind=endpoint_kind,
                tool_calls=tool_calls,
                use_memory=use_memory,
                reason="Manual model override from the user interface.",
            )

        if task_type == "audio_transcription":
            return RoutingDecision(
                task_type=task_type,
                model=ASR_MODEL,
                endpoint_kind=endpoint_kind,
                tool_calls=tool_calls,
                use_memory=False,
                reason="Audio attachment detected, route to ASR model.",
            )

        if task_type == "image_understanding":
            return RoutingDecision(
                task_type=task_type,
                model=VISION_MODEL,
                endpoint_kind=endpoint_kind,
                tool_calls=tool_calls,
                use_memory=use_memory,
                reason="Image input detected, route to VLM.",
            )

        if task_type == "file_qa":
            return RoutingDecision(
                task_type=task_type,
                model=STRONG_CHAT_MODEL,
                endpoint_kind=endpoint_kind,
                tool_calls=tool_calls,
                use_memory=use_memory,
                reason="File attachment detected, retrieve document context before chat completion.",
            )

        if task_type == "url_summary":
            return RoutingDecision(
                task_type=task_type,
                model=STRONG_CHAT_MODEL,
                endpoint_kind=endpoint_kind,
                tool_calls=tool_calls,
                use_memory=use_memory,
                reason="URL detected, parse page content before final answer.",
            )

        if task_type == "web_search":
            return RoutingDecision(
                task_type=task_type,
                model=STRONG_CHAT_MODEL,
                endpoint_kind=endpoint_kind,
                tool_calls=tool_calls,
                use_memory=use_memory,
                reason="Fresh factual request detected, run web search first.",
            )

        if task_type == "image_generation":
            return RoutingDecision(
                task_type=task_type,
                model=IMAGE_GEN_MODEL,
                endpoint_kind=endpoint_kind,
                tool_calls=tool_calls,
                use_memory=False,
                reason="Image generation request detected.",
            )

        return RoutingDecision(
            task_type=task_type,
            model=DEFAULT_CHAT_MODEL,
            endpoint_kind=endpoint_kind,
            tool_calls=tool_calls,
            use_memory=use_memory,
            reason="Fallback route for regular text chat.",
        )

    def _tool_calls_for_task(self, task_type: str) -> list[str]:
        task_tools = {
            "file_qa": ["retrieve_doc_context"],
            "url_summary": ["parse_url"],
            "web_search": ["web_search"],
        }
        return task_tools.get(task_type, [])

    def _use_memory_for_task(self, task_type: str) -> bool:
        return task_type not in {"audio_transcription", "image_generation"}

    def _endpoint_kind_for_task(self, task_type: str) -> str:
        endpoint_map = {
            "text_chat": "chat",
            "file_qa": "chat",
            "url_summary": "chat",
            "web_search": "chat",
            "image_understanding": "chat",
            "audio_transcription": "audio_transcription",
            "image_generation": "image_generation",
        }
        return endpoint_map.get(task_type, "chat")
