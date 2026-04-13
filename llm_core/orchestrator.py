from dataclasses import asdict

from llm_core.classifier import TaskClassifier
from llm_core.memory_policy import MemoryPolicy
from llm_core.mws_client import MWSClient
from llm_core.prompts import build_context_prompt, build_system_prompt, build_user_prompt
from llm_core.router import Router
from llm_core.schemas import ChatRequest, ChatResponse
from llm_core.tools import ToolExecutor


class Orchestrator:
    def __init__(self) -> None:
        self.classifier = TaskClassifier()
        self.router = Router()
        self.memory_policy = MemoryPolicy()
        self.tools = ToolExecutor()
        self.client = MWSClient()

    def handle(self, request: ChatRequest) -> ChatResponse:
        task_type = self.classifier.classify(request)
        request.task_type = task_type
        decision = self.router.route(request, task_type)
        recent_history = (
            self.memory_policy.fetch_recent_history(request)
            if decision.use_memory and hasattr(self.memory_policy, "fetch_recent_history")
            else []
        )

        memory = self.memory_policy.fetch(request) if decision.use_memory else self.memory_policy.fetch(
            ChatRequest(
                user_id=request.user_id,
                chat_id=request.chat_id,
                message="",
                attachments=[],
                mode=request.mode,
                selected_model=request.selected_model,
                task_type=task_type,
            )
        )

        tool_results = [self.tools.run(tool_name, request) for tool_name in decision.tool_calls]
        sources = self._collect_sources(tool_results)
        tool_payloads = [
            {
                "name": result.name,
                "content": result.content,
                "metadata": result.metadata,
            }
            for result in tool_results
        ]

        if task_type in {"audio_transcription", "image_generation"}:
            answer = self._execute_non_chat(request, decision)
        else:
            system_prompt = build_system_prompt(task_type)
            if hasattr(self.client, "chat_completion_with_history"):
                context_prompt = build_context_prompt(request, memory, tool_results)
                answer = self.client.chat_completion_with_history(
                    model=decision.model,
                    system_prompt=system_prompt,
                    conversation_history=recent_history,
                    user_message=request.message,
                    context_prompt=context_prompt,
                )
            else:
                user_prompt = build_user_prompt(request, memory, tool_results, recent_history=recent_history)
                answer = self.client.chat_completion(
                    model=decision.model,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                )

        response_metadata = {
            "reason": decision.reason,
            "model_used": decision.model,
            "endpoint_kind": decision.endpoint_kind,
            "tools_used": decision.tool_calls,
            "sources": sources,
            "tool_outputs": tool_payloads,
            "memory_packet": asdict(memory),
            "recent_history_len": len(recent_history),
            "context_used": bool(
                recent_history
                or memory.chat_summary
                or memory.user_facts
                or memory.preferences
                or memory.relevant_docs
                or memory.ongoing_tasks
            ),
        }

        if self.memory_policy.should_store(request, answer):
            if hasattr(self.memory_policy, "write"):
                _writeback_payload = self.memory_policy.write(
                    request,
                    answer,
                    answer_metadata=response_metadata,
                )
            else:
                _writeback_payload = self.memory_policy.build_writeback(request, answer)

        return ChatResponse(
            answer=answer,
            task_type=decision.task_type,
            model_used=decision.model,
            tools_used=decision.tool_calls,
            memory_used=decision.use_memory,
            sources=sources,
            metadata=response_metadata,
        )

    def _execute_non_chat(self, request: ChatRequest, decision) -> str:
        if decision.endpoint_kind == "image_generation":
            return self.client.generate_image(
                model=decision.model,
                prompt=request.message,
            )

        if decision.endpoint_kind == "audio_transcription":
            attachment = next((item for item in request.attachments if item.type in {"audio", "voice_note"}), None)
            if attachment is None:
                return "Не найдено аудио-вложение для расшифровки."
            file_path = str(attachment.metadata.get("file_path", "")).strip()
            if not file_path:
                return "Для расшифровки аудио нужен file_path в metadata вложения."
            return self.client.transcribe_audio(
                model=decision.model,
                file_path=file_path,
                prompt=request.message,
            )

        return (
            f"Для task_type='{decision.task_type}' выбран endpoint_kind='{decision.endpoint_kind}', "
            "но обработчик не реализован."
        )

    def _collect_sources(self, tool_results: list) -> list[str]:
        ordered_sources: list[str] = []
        seen: set[str] = set()
        for result in tool_results:
            for source in result.metadata.get("sources", []):
                if not source or source in seen:
                    continue
                seen.add(source)
                ordered_sources.append(source)
        return ordered_sources
