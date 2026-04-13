from dataclasses import dataclass, field
from typing import Any


@dataclass
class Attachment:
    type: str
    file_id: str | None = None
    url: str | None = None
    mime_type: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ChatRequest:
    user_id: str
    chat_id: str
    message: str
    attachments: list[Attachment] = field(default_factory=list)
    mode: str = "auto"
    selected_model: str | None = None
    task_type: str | None = None


@dataclass
class RoutingDecision:
    task_type: str
    model: str
    endpoint_kind: str = "chat"
    tool_calls: list[str] = field(default_factory=list)
    use_memory: bool = True
    reason: str = ""


@dataclass
class MemoryPacket:
    chat_summary: str = ""
    user_facts: list[str] = field(default_factory=list)
    preferences: list[str] = field(default_factory=list)
    relevant_docs: list[str] = field(default_factory=list)
    ongoing_tasks: list[str] = field(default_factory=list)


@dataclass
class ToolResult:
    name: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ChatResponse:
    answer: str
    task_type: str
    model_used: str
    tools_used: list[str] = field(default_factory=list)
    memory_used: bool = False
    sources: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
