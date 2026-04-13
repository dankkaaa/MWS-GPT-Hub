# Routing Table v1

Этот файл описывает минимальную routing policy для LLM-engineering MVP.

## Цели

- сделать routing простым и детерминированным
- поддержать основной demo flow без зависимости от дизайна
- разделить default chat и более тяжелые context-heavy сценарии
- подготовить чистый handoff для backend по memory/storage

## Роли моделей по умолчанию

- `mws-gpt-alpha` - базовая модель для обычного чата
- `qwen2.5-72b-instruct` - более сильная текстовая модель для задач с контекстом
- `qwen2.5-vl` - анализ изображений
- `whisper-turbo-local` - расшифровка аудио
- `bge-m3` - embeddings для памяти и retrieval
- `qwen-image-lightning` - генерация изображений

## Таблица маршрутизации

| Тип задачи | Триггер | Модель | Инструменты | Память | Fallback |
|---|---|---|---|---|---|
| `text_chat` | обычное текстовое сообщение | `mws-gpt-alpha` | нет | да | `qwen2.5-72b-instruct` |
| `file_qa` | файл во вложении или вопрос по файлу | `qwen2.5-72b-instruct` | `retrieve_doc_context` | да | `mws-gpt-alpha` |
| `url_summary` | ссылка во вложении или URL в сообщении | `qwen2.5-72b-instruct` | `parse_url` | да | `mws-gpt-alpha` |
| `web_search` | запрос на свежую/внешнюю информацию | `qwen2.5-72b-instruct` | `web_search` | да | `mws-gpt-alpha` |
| `image_understanding` | изображение во вложении | `qwen2.5-vl` | нет | да | базовая текстовая модель после vision preprocessing |
| `audio_transcription` | аудио во вложении | `whisper-turbo-local` | нет | нет | нет |
| `image_generation` | явный запрос на генерацию картинки | `qwen-image-lightning` | нет | нет | нет |

## Правила работы с памятью

- Использовать память для `text_chat`, `file_qa`, `url_summary`, `web_search`, `image_understanding`
- Не использовать память для `audio_transcription`
- Не использовать память для `image_generation`
- В memory packet в будущем должны входить:
  - `chat_summary`
  - `user_facts`
  - `preferences`
  - `relevant_docs`
  - `ongoing_tasks`

## Политика по инструментам

- `retrieve_doc_context`
  - вызывается для вопросов по файлам
  - ожидаемый результат: релевантные чанки и ссылки на источники
- `parse_url`
  - вызывается для summary по ссылке и follow-up по странице
  - ожидаемый результат: очищенный текст страницы и metadata
- `web_search`
  - вызывается только тогда, когда нужна свежая или внешняя информация
  - ожидаемый результат: короткие сниппеты и URL источников

## Ручной выбор модели

- Если `mode=manual` и передан `selected_model`:
  - всегда использовать выбранную модель
  - при этом не отключать task-specific tools, если они нужны
  - память определяется типом задачи, а не выбранной моделью

## Заметки по реализации

- Эта routing table специально сделана rule-based
- В следующей версии можно добавить confidence score и объяснение выбора маршрута
- Качество retrieval здесь важнее, чем раннее добавление большого количества веток моделей
