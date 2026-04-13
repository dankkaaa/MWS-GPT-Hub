# MTS MVP LLM Core

Минимальный orchestration MVP для AI workspace на базе MWS GPT.

## Что входит в проект

- `llm_core/schemas.py` - контракты request/response
- `llm_core/classifier.py` - определение типа входной задачи
- `llm_core/router.py` - правила маршрутизации моделей и инструментов
- `llm_core/memory_policy.py` - политика получения и записи памяти
- `llm_core/prompts.py` - сборка prompt-шаблонов
- `llm_core/mws_client.py` - легковесный клиент для MWS GPT
- `llm_core/orchestrator.py` - полный orchestration pipeline
- `llm_core/storage_backend.py` - `sqlite` storage для chats/messages/docs
- `llm_core/backend_services.py` - memory API, ingestion, retrieval, tool backend
- `app.py` - консольный чат для отладки
- `web_app.py` - Flask-сервер и web chat UI
- `web/` - шаблон и статика веб-интерфейса
- `BACKEND_INTERFACES.md` - python interface и примеры request/response

## Быстрый старт

Укажи API-ключ:

```bash
export MWS_API_KEY='your_api_key'
```

Опционально можно указать base URL:

```bash
export MWS_BASE_URL='https://api.gpt.mws.ru'
```

Если локальное Python-окружение падает из-за корпоративного или self-signed сертификата, для dev-режима можно временно отключить SSL-проверку:

```bash
export MWS_VERIFY_SSL=false
```

Запуск веб-чата:

```bash
python3 web_app.py
```

После этого открой:

```text
http://127.0.0.1:5000
```

## Запуск через Docker Compose

1. Заполни `.env`:

```env
MWS_API_KEY=your_api_key
MWS_BASE_URL=https://api.gpt.mws.ru
MWS_TIMEOUT_SECONDS=60
MWS_VERIFY_SSL=false
```

2. Собери и запусти контейнер:

```bash
docker compose up --build
```

3. Открой в браузере:

```text
http://127.0.0.1:5000
```

4. Остановить сервис:

```bash
docker compose down
```

5. Остановить сервис и удалить volume с локальной памятью:

```bash
docker compose down -v
```

### Что хранится в volume

- sqlite база памяти
- загруженные файлы
- артефакты ingestion

Volume монтируется в контейнер по пути `/app/.mts_memory`.

Запуск интерактивного консольного чата:

```bash
python3 app.py
```

One-shot запрос:

```bash
python3 app.py --message "Привет! Коротко опиши, что ты умеешь."
```

Полезные команды внутри консольного чата:

```text
/help
/status
/history
/memory
/new
/file /absolute/path/to/file
/url https://example.com
/clear
/exit
```

## Текущий scope MVP

- web chat UI в стиле ChatGPT / OpenWebUI-like layout
- история чатов в sidebar
- верхняя панель чата + новый чат
- нижний composer с attach / model picker / voice / send
- загрузка файлов с отображением карточки и статуса
- браузерный голосовой ввод через SpeechRecognition
- текстовый чат
- классификация задач по типам `file/url/image/audio`
- автоматический routing
- ручной выбор модели
- backend для памяти: storage, summaries, facts, preferences, tasks
- ingestion и retrieval для файлов и URL
- tool adapters для `retrieve_doc_context`, `parse_url`, `web_search`
- интеграция с MWS GPT для текстового чата
- временный интерактивный console chat для ручной проверки памяти и retrieval
- recent chat history используется как основной short-term context внутри чата

## Проверка

```bash
python3 -m pytest -q test_web_app.py test_backend_services.py test_prompts.py
python3 test_routing.py
python3 test_orchestrator.py
```

## Следующие шаги

1. Добавить streaming ответа в веб-чате
2. Подключить real adapters для audio/image generation
3. Вынести Flask demo в production backend или OpenWebUI integration
4. Добавить auth и multi-user session management
