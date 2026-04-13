from llm_core.backend_services import get_backend_services
from llm_core.schemas import ChatRequest, ToolResult


class ToolExecutor:
    def __init__(self, db_path: str | None = None) -> None:
        self.backend = get_backend_services(db_path)

    def run(self, tool_name: str, request: ChatRequest) -> ToolResult:
        if tool_name == "retrieve_doc_context":
            return self.backend.tools.retrieve_doc_context(request)

        if tool_name == "parse_url":
            return self.backend.tools.parse_url(request)

        if tool_name == "web_search":
            return self.backend.tools.web_search(request)

        return ToolResult(
            name=tool_name,
            content="Unknown tool. No data returned.",
        )
