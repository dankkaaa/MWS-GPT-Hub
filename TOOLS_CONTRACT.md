# Контракт Инструментов v1

Этот документ описывает ожидаемый интерфейс между оркестратором и внешними инструментами или backend-адаптерами.

## Цель

Оркестратор выбирает tools на этапе routing.
Каждый tool должен возвращать чистый текстовый результат, который можно подмешать в prompt.

## Текущие инструменты

- `retrieve_doc_context`
- `parse_url`
- `web_search`

## Инструмент: retrieve_doc_context

Используется для:

- `file_qa`

### Input

```json
{
  "user_id": "u1",
  "chat_id": "c1",
  "message": "Что находится в этом файле?",
  "attachments": [
    {
      "type": "file",
      "file_id": "file-123"
    }
  ]
}
```

### Output

```json
{
  "name": "retrieve_doc_context",
  "content": "Топ релевантных чанков из файла...",
  "metadata": {
    "sources": [
      "file-123:chunk-1",
      "file-123:chunk-5"
    ]
  }
}
```

### Ожидание для MVP

- возвращать top relevant text chunks
- включать source references в metadata

## Инструмент: parse_url

Используется для:

- `url_summary`

### Input

```json
{
  "message": "Сделай summary этой страницы https://example.com",
  "url": "https://example.com"
}
```

### Output

```json
{
  "name": "parse_url",
  "content": "Очищенный текст страницы...",
  "metadata": {
    "title": "Example page",
    "url": "https://example.com"
  }
}
```

### Ожидание для MVP

- возвращать очищенный текст страницы
- включать title и URL, если они доступны

## Инструмент: web_search

Используется для:

- `web_search`

### Input

```json
{
  "message": "Найди актуальную информацию про ...",
  "query": "актуальная информация про ..."
}
```

### Output

```json
{
  "name": "web_search",
  "content": "Короткие сниппеты поисковой выдачи...",
  "metadata": {
    "sources": [
      "https://source-1.example",
      "https://source-2.example"
    ]
  }
}
```

### Ожидание для MVP

- возвращать короткие и полезные сниппеты
- включать URL источников в metadata
- не возвращать сырой HTML и шумный контент

## Правило инъекции в prompt

Оркестратор преобразует результат tool в prompt context в формате:

- `Tool result [tool_name]: ...`

Поэтому tool должен возвращать:

- короткий и понятный content
- без предположений о UI
- без жесткой привязки к визуальному формату

## Поведение при ошибке

Если tool падает, backend/tool adapter должен вернуть структурированную ошибку или пустой content.
Оркестратор при этом должен уметь продолжить работу через fallback-логику.

## Ответственность

- LLM engineer:
  - решает, когда вызываются tools
  - решает, как результат tools подмешивается в prompt
- Backend/tool engineer:
  - реализует parsing, retrieval и внешние интеграции
  - обеспечивает стабильный формат ответа
