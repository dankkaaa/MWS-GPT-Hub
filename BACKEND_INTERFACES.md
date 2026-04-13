# Backend Interfaces

Этот файл фиксирует Python interface для memory / storage / ingestion / retrieval backend.

## Где лежит реализация

- `llm_core/storage_backend.py` - `sqlite` storage
- `llm_core/backend_services.py` - ingestion, retrieval, memory API, tool backend
- `llm_core/memory_policy.py` - подключение backend в memory hook
- `llm_core/tools.py` - подключение backend в tool hook

По умолчанию база лежит в `.mts_memory/memory.db`.
Можно переопределить через `MTS_MEMORY_DB_PATH`.

## Основной entrypoint

```python
from llm_core.backend_services import BackendServices

backend = BackendServices(db_path="data/memory.db")
```

Есть и shared singleton:

```python
from llm_core.backend_services import get_backend_services

backend = get_backend_services()
```

## Storage entities

Хранятся таблицы:

- `chats`
- `messages`
- `user_facts`
- `preferences`
- `chat_summaries`
- `ongoing_tasks`
- `files`
- `parsed_links`
- `document_chunks`

## Memory API

### `fetch_memory_context`

```python
packet = backend.memory.fetch_memory_context(
    user_id="u1",
    chat_id="c1",
    message="Продолжи прошлую задачу по retrieval",
    task_type="text_chat",
    attachments=[],
)
```

Обязательные поля:

- `user_id`
- `chat_id`
- `message`

Опциональные поля:

- `task_type`
- `attachments`

Response:

```json
{
  "chat_summary": "Недавний контекст: ...",
  "user_facts": [
    "Мы строим AI workspace на базе OpenWebUI."
  ],
  "preferences": [
    "Мне важен стабильный контракт ответа."
  ],
  "relevant_docs": [
    "[file-123:chunk-1] spec.txt: ...",
    "[url-abc:chunk-2] Product page: ..."
  ],
  "ongoing_tasks": [
    "Реализовать storage для memory и retrieval."
  ]
}
```

### `write_memory`

```python
result = backend.memory.write_memory(
    user_id="u1",
    chat_id="c1",
    message="Реализовать storage для memory",
    answer="Собрал backend слой.",
    task_type="text_chat",
    attachments=[],
)
```

Обязательные поля:

- `user_id`
- `chat_id`
- `message`
- `answer`

Опциональные поля:

- `task_type`
- `attachments`

Response:

```json
{
  "stored": true,
  "chat_summary": "Недавний контекст: ...",
  "user_facts_written": [],
  "preferences_written": [],
  "ongoing_tasks_written": [
    "Реализовать storage для memory"
  ]
}
```

## Ingestion

### File upload -> parse -> chunk -> index

```python
result = backend.ingestion.ingest_file(
    user_id="u1",
    chat_id="c1",
    file_path="/absolute/path/spec.txt",
    file_id="file-123",
    mime_type="text/plain",
    metadata={"uploaded_by": "ui"},
)
```

Обязательные поля:

- `user_id`
- `chat_id`
- `file_path`

Опциональные поля:

- `file_id`
- `mime_type`
- `metadata`

Response:

```json
{
  "status": "indexed",
  "file_id": "file-123",
  "file_name": "spec.txt",
  "mime_type": "text/plain",
  "chunk_ids": [
    "file-123:chunk-1",
    "file-123:chunk-2"
  ],
  "metadata": {
    "parser": "plain_text",
    "chunk_count": 2,
    "text_length": 1840
  }
}
```

Поддержаны:

- plain text / md / code / json / csv
- html
- docx
- xlsx
- pdf через `pdftotext` или fallback на `strings`, если доступно

### URL -> parse -> clean -> chunk -> index

```python
result = backend.ingestion.ingest_url(
    user_id="u1",
    chat_id="c1",
    url="https://example.com",
    metadata={"source": "chat"},
)
```

Обязательные поля:

- `user_id`
- `chat_id`
- `url`

Опциональные поля:

- `metadata`

Response:

```json
{
  "status": "indexed",
  "link_id": "url-3d8f...",
  "url": "https://example.com",
  "title": "Example page",
  "chunk_ids": [
    "url-3d8f...:chunk-1"
  ],
  "metadata": {
    "content_type": "text/html; charset=utf-8",
    "chunk_count": 1,
    "text_length": 932
  }
}
```

## Tool outputs

### `retrieve_doc_context`

Python call:

```python
tool_result = backend.tools.retrieve_doc_context(chat_request)
```

Input ожидание:

- `request.user_id`
- `request.chat_id`
- `request.message`
- `request.attachments[*].type == "file"`
- `request.attachments[*].file_id`

Если файла еще нет в storage, можно передать путь в:

- `attachment.metadata["file_path"]`
- `attachment.metadata["path"]`
- `attachment.metadata["local_path"]`

Response:

```json
{
  "name": "retrieve_doc_context",
  "content": "[Source: file-123:chunk-1]\nТекст релевантного чанка...",
  "metadata": {
    "sources": [
      "file-123:chunk-1",
      "file-123:chunk-2"
    ],
    "file_ids": [
      "file-123"
    ]
  }
}
```

### `parse_url`

Python call:

```python
tool_result = backend.tools.parse_url(chat_request)
```

URL берется в таком порядке:

1. `attachment.url` для `type="url"`
2. `attachment.metadata["url"]`
3. первый URL из `request.message`

Response:

```json
{
  "name": "parse_url",
  "content": "[Source: url-abc:chunk-1]\nОчищенный текст страницы...",
  "metadata": {
    "title": "Example page",
    "url": "https://example.com",
    "sources": [
      "url-abc:chunk-1"
    ],
    "status": "indexed"
  }
}
```

### `web_search`

Python call:

```python
tool_result = backend.tools.web_search(chat_request)
```

Input ожидание:

- `request.message`

Опционально:

- можно прокинуть уже нормализованный query в `request.message`

Response:

```json
{
  "name": "web_search",
  "content": "Memory Docs: Stable memory packet and retrieval API.",
  "metadata": {
    "sources": [
      "https://docs.example.com/memory"
    ]
  }
}
```

Поведение:

- сначала пробует DuckDuckGo HTML search
- если внешний поиск недоступен, делает fallback по уже распарсенным ссылкам пользователя

## Как передавать `file_id / url / user_id / chat_id`

- `user_id`: обязателен всегда, это scope памяти и документов
- `chat_id`: обязателен всегда, это scope summary/messages/tasks и локальный контекст документов
- `file_id`: передается один и тот же на этапе ingestion и потом в `attachments`
- `url`: можно сразу передавать в сообщении или как `Attachment(type="url", url=...)`

Рекомендуемый flow для файла:

1. UI/backend upload сохраняет файл локально или в object storage
2. вызывается `ingest_file(..., file_id="file-123")`
3. в чатовом запросе идет `Attachment(type="file", file_id="file-123")`
4. tool `retrieve_doc_context` достает уже проиндексированные чанки

Рекомендуемый flow для URL:

1. в чат приходит URL
2. tool `parse_url` сам вызывает ingestion при первом обращении
3. дальше тот же URL уже берется из `parsed_links` и `document_chunks`

## Совместимость с текущим orchestration слоем

- `MemoryPolicy.fetch()` уже вызывает `fetch_memory_context`
- `MemoryPolicy.write()` уже вызывает `write_memory`
- `ToolExecutor.run()` уже вызывает реальные backend tool adapters
- `Orchestrator.handle()` уже пишет memory после ответа

## Что еще можно легко докрутить потом

- заменить scoring на embeddings/vector db
- добавить отдельный HTTP слой поверх этих Python interface
- добавить TTL/confidence для фактов и задач
- кешировать web search выдачу
