from llm_core.backend_services import build_memory_packet, get_backend_services
from llm_core.schemas import ChatRequest, MemoryPacket


class MemoryPolicy:
    def __init__(self, db_path: str | None = None) -> None:
        self.backend = get_backend_services(db_path)

    def should_fetch(self, task_type: str) -> bool:
        return task_type not in {"audio_transcription", "image_generation"}

    def should_store(self, request: ChatRequest, answer: str) -> bool:
        if not request.message.strip():
            return False
        if len(answer.strip()) == 0:
            return False
        return True

    def fetch(self, request: ChatRequest) -> MemoryPacket:
        packet = self.backend.memory.fetch_memory_context(
            user_id=request.user_id,
            chat_id=request.chat_id,
            message=request.message,
            task_type=request.task_type or "text_chat",
            attachments=request.attachments,
        )
        return build_memory_packet(packet)

    def fetch_recent_history(self, request: ChatRequest, limit: int = 8) -> list[dict[str, str]]:
        messages = self.backend.storage.list_recent_messages(request.chat_id, limit=limit)
        history: list[dict[str, str]] = []
        for item in messages:
            role = item.get("role", "")
            if role not in {"user", "assistant"}:
                continue
            history.append({"role": role, "content": item.get("content", "")})
        return history

    def write(
        self,
        request: ChatRequest,
        answer: str,
        answer_metadata: dict[str, object] | None = None,
    ) -> dict[str, object]:
        return self.backend.memory.write_memory(
            user_id=request.user_id,
            chat_id=request.chat_id,
            message=request.message,
            answer=answer,
            task_type=request.task_type or "text_chat",
            attachments=request.attachments,
            answer_metadata=answer_metadata,
        )

    def build_writeback(
        self,
        request: ChatRequest,
        answer: str,
        answer_metadata: dict[str, object] | None = None,
    ) -> dict[str, object]:
        return self.write(request, answer, answer_metadata=answer_metadata)
