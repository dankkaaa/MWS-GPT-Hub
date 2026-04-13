import json
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def utcnow_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="microseconds")


def _to_json(value: dict[str, Any] | None) -> str:
    return json.dumps(value or {}, ensure_ascii=False, sort_keys=True)


def _from_json(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        loaded = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return loaded if isinstance(loaded, dict) else {}


def _normalize_identity(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


class StorageBackend:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = OFF")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def _ensure_schema(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    normalized_email TEXT NOT NULL UNIQUE,
                    nickname TEXT NOT NULL,
                    normalized_nickname TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}'
                );

                CREATE INDEX IF NOT EXISTS idx_users_email ON users(normalized_email);
                CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(normalized_nickname);

                CREATE TABLE IF NOT EXISTS chats (
                    chat_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}'
                );

                CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS messages (
                    message_id TEXT PRIMARY KEY,
                    chat_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    task_type TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}'
                );

                CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, created_at DESC);

                CREATE TABLE IF NOT EXISTS chat_summaries (
                    chat_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_chat_summaries_user
                    ON chat_summaries(user_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS user_facts (
                    fact_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    fact TEXT NOT NULL,
                    normalized_fact TEXT NOT NULL,
                    source_chat_id TEXT,
                    updated_at TEXT NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    UNIQUE(user_id, normalized_fact)
                );

                CREATE INDEX IF NOT EXISTS idx_user_facts_user
                    ON user_facts(user_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS preferences (
                    preference_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    preference TEXT NOT NULL,
                    normalized_preference TEXT NOT NULL,
                    source_chat_id TEXT,
                    updated_at TEXT NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    UNIQUE(user_id, normalized_preference)
                );

                CREATE INDEX IF NOT EXISTS idx_preferences_user
                    ON preferences(user_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS ongoing_tasks (
                    task_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    chat_id TEXT NOT NULL,
                    task TEXT NOT NULL,
                    normalized_task TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'open',
                    updated_at TEXT NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    UNIQUE(user_id, chat_id, normalized_task)
                );

                CREATE INDEX IF NOT EXISTS idx_tasks_user
                    ON ongoing_tasks(user_id, updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_tasks_chat
                    ON ongoing_tasks(chat_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS files (
                    file_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    chat_id TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    mime_type TEXT NOT NULL DEFAULT '',
                    file_path TEXT NOT NULL DEFAULT '',
                    raw_text TEXT NOT NULL DEFAULT '',
                    sha256 TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}'
                );

                CREATE INDEX IF NOT EXISTS idx_files_user
                    ON files(user_id, updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_files_chat
                    ON files(chat_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS parsed_links (
                    link_id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    chat_id TEXT NOT NULL,
                    url TEXT NOT NULL,
                    title TEXT NOT NULL DEFAULT '',
                    cleaned_text TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    UNIQUE(user_id, chat_id, url)
                );

                CREATE INDEX IF NOT EXISTS idx_links_user
                    ON parsed_links(user_id, updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_links_chat
                    ON parsed_links(chat_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS document_chunks (
                    chunk_id TEXT PRIMARY KEY,
                    source_type TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    chat_id TEXT NOT NULL,
                    ordinal INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}'
                );

                CREATE INDEX IF NOT EXISTS idx_document_chunks_source
                    ON document_chunks(source_type, source_id, ordinal);
                CREATE INDEX IF NOT EXISTS idx_document_chunks_owner
                    ON document_chunks(user_id, chat_id, created_at DESC);
                """
            )

    def create_user(
        self,
        user_id: str,
        email: str,
        nickname: str,
        password_hash: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        now = utcnow_iso()
        normalized_email = _normalize_identity(email)
        normalized_nickname = _normalize_identity(nickname)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO users(
                    user_id, email, normalized_email, nickname, normalized_nickname,
                    password_hash, created_at, updated_at, metadata_json
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    (email or "").strip(),
                    normalized_email,
                    " ".join((nickname or "").strip().split()),
                    normalized_nickname,
                    password_hash,
                    now,
                    now,
                    _to_json(metadata),
                ),
            )
        return self.get_user_by_id(user_id) or {}

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
        if row is None:
            return None
        item = dict(row)
        item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return item

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        normalized_email = _normalize_identity(email)
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM users WHERE normalized_email = ?", (normalized_email,)).fetchone()
        if row is None:
            return None
        item = dict(row)
        item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return item

    def get_user_by_nickname(self, nickname: str) -> dict[str, Any] | None:
        normalized_nickname = _normalize_identity(nickname)
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM users WHERE normalized_nickname = ?", (normalized_nickname,)).fetchone()
        if row is None:
            return None
        item = dict(row)
        item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return item

    def upsert_chat(self, user_id: str, chat_id: str, metadata: dict[str, Any] | None = None) -> None:
        now = utcnow_iso()
        existing = self.get_chat(chat_id)
        payload_metadata = (existing or {}).get("metadata", {}) if metadata is None else metadata
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO chats(chat_id, user_id, created_at, updated_at, metadata_json)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(chat_id) DO UPDATE SET
                    updated_at = excluded.updated_at,
                    metadata_json = excluded.metadata_json
                """,
                (chat_id, user_id, now, now, _to_json(payload_metadata)),
            )

    def get_chat(self, chat_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM chats WHERE chat_id = ?",
                (chat_id,),
            ).fetchone()
        if row is None:
            return None
        item = dict(row)
        item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return item

    def update_chat_metadata(
        self,
        user_id: str,
        chat_id: str,
        metadata: dict[str, Any],
        replace: bool = False,
    ) -> None:
        current = self.get_chat(chat_id)
        merged = dict(metadata) if replace else {**(current or {}).get("metadata", {}), **metadata}
        self.upsert_chat(user_id=user_id, chat_id=chat_id, metadata=merged)

    def rename_chat(self, user_id: str, chat_id: str, title: str) -> None:
        cleaned = " ".join((title or "").strip().split())
        self.update_chat_metadata(user_id=user_id, chat_id=chat_id, metadata={"title": cleaned or "Новый чат"})

    def set_chat_pinned(self, user_id: str, chat_id: str, pinned: bool) -> None:
        self.update_chat_metadata(user_id=user_id, chat_id=chat_id, metadata={"pinned": bool(pinned)})

    def delete_chat(self, user_id: str, chat_id: str) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM messages WHERE user_id = ? AND chat_id = ?", (user_id, chat_id))
            connection.execute("DELETE FROM chat_summaries WHERE user_id = ? AND chat_id = ?", (user_id, chat_id))
            connection.execute("DELETE FROM ongoing_tasks WHERE user_id = ? AND chat_id = ?", (user_id, chat_id))
            connection.execute("DELETE FROM files WHERE user_id = ? AND chat_id = ?", (user_id, chat_id))
            connection.execute("DELETE FROM parsed_links WHERE user_id = ? AND chat_id = ?", (user_id, chat_id))
            connection.execute("DELETE FROM document_chunks WHERE user_id = ? AND chat_id = ?", (user_id, chat_id))
            connection.execute("DELETE FROM user_facts WHERE user_id = ? AND source_chat_id = ?", (user_id, chat_id))
            connection.execute("DELETE FROM preferences WHERE user_id = ? AND source_chat_id = ?", (user_id, chat_id))
            connection.execute("DELETE FROM chats WHERE user_id = ? AND chat_id = ?", (user_id, chat_id))

    def _refresh_chat_updated_at(self, chat_id: str) -> None:
        latest_message = None
        with self._connect() as connection:
            row = connection.execute(
                "SELECT created_at FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1",
                (chat_id,),
            ).fetchone()
            latest_message = row[0] if row is not None else utcnow_iso()
            connection.execute("UPDATE chats SET updated_at = ? WHERE chat_id = ?", (latest_message, chat_id))

    def delete_message_ids(self, user_id: str, chat_id: str, message_ids: list[str]) -> int:
        message_ids = [str(message_id) for message_id in message_ids if message_id]
        if not message_ids:
            return 0
        placeholders = ",".join("?" for _ in message_ids)
        with self._connect() as connection:
            cursor = connection.execute(
                f"DELETE FROM messages WHERE user_id = ? AND chat_id = ? AND message_id IN ({placeholders})",
                [user_id, chat_id, *message_ids],
            )
        self._refresh_chat_updated_at(chat_id)
        return int(cursor.rowcount or 0)

    def delete_turn(self, user_id: str, chat_id: str, message_id: str) -> int:
        messages = self.list_messages(chat_id, limit=400)
        target_index = next((index for index, item in enumerate(messages) if item.get("message_id") == message_id), None)
        if target_index is None:
            return 0

        target = messages[target_index]
        delete_ids = [target.get("message_id")]
        if target.get("role") == "user":
            for item in messages[target_index + 1 :]:
                if item.get("role") == "user":
                    break
                delete_ids.append(item.get("message_id"))
                if item.get("role") == "assistant":
                    break
        deleted = self.delete_message_ids(user_id=user_id, chat_id=chat_id, message_ids=delete_ids)
        return deleted

    def prepare_regeneration(self, user_id: str, chat_id: str) -> dict[str, Any] | None:
        messages = self.list_messages(chat_id, limit=400)
        last_user_index = None
        for index in range(len(messages) - 1, -1, -1):
            if messages[index].get("role") == "user":
                last_user_index = index
                break
        if last_user_index is None:
            return None

        user_message = messages[last_user_index]
        attachments = list((user_message.get("metadata") or {}).get("attachments", []))
        delete_ids = [item.get("message_id") for item in messages[last_user_index:] if item.get("message_id")]
        self.delete_message_ids(user_id=user_id, chat_id=chat_id, message_ids=delete_ids)
        return {
            "message": user_message.get("content", ""),
            "task_type": user_message.get("task_type", "text_chat"),
            "attachments": attachments,
        }

    def count_messages(self, chat_id: str) -> int:
        with self._connect() as connection:
            row = connection.execute("SELECT COUNT(*) AS total FROM messages WHERE chat_id = ?", (chat_id,)).fetchone()
        return int((dict(row) if row is not None else {}).get("total", 0))

    def list_chats(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM chats
                WHERE user_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
        items = [dict(row) for row in rows]
        for item in items:
            item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return items

    def find_empty_chat(self, user_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT chats.*
                FROM chats
                LEFT JOIN messages ON messages.chat_id = chats.chat_id
                WHERE chats.user_id = ?
                GROUP BY chats.chat_id
                HAVING COUNT(messages.message_id) = 0
                ORDER BY chats.updated_at DESC
                LIMIT 1
                """,
                (user_id,),
            ).fetchone()
        if row is None:
            return None
        item = dict(row)
        item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return item

    def add_message(
        self,
        user_id: str,
        chat_id: str,
        role: str,
        content: str,
        task_type: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> str:
        message_id = str(uuid.uuid4())
        now = utcnow_iso()
        self.upsert_chat(user_id=user_id, chat_id=chat_id)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO messages(message_id, chat_id, user_id, role, content, task_type, created_at, metadata_json)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (message_id, chat_id, user_id, role, content, task_type, now, _to_json(metadata)),
            )
            connection.execute(
                "UPDATE chats SET updated_at = ? WHERE chat_id = ?",
                (now, chat_id),
            )
        return message_id

    def upsert_chat_summary(self, user_id: str, chat_id: str, summary: str) -> None:
        now = utcnow_iso()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO chat_summaries(chat_id, user_id, summary, updated_at)
                VALUES(?, ?, ?, ?)
                ON CONFLICT(chat_id) DO UPDATE SET
                    user_id = excluded.user_id,
                    summary = excluded.summary,
                    updated_at = excluded.updated_at
                """,
                (chat_id, user_id, summary, now),
            )

    def get_chat_summary(self, chat_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM chat_summaries WHERE chat_id = ?",
                (chat_id,),
            ).fetchone()
        if row is None:
            return None
        return dict(row)

    def list_recent_messages(self, chat_id: str, limit: int = 8) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM messages
                WHERE chat_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (chat_id, limit),
            ).fetchall()
        recent = [dict(row) for row in rows]
        recent.reverse()
        for row in recent:
            row["metadata"] = _from_json(row.pop("metadata_json", ""))
        return recent

    def list_messages(self, chat_id: str, limit: int = 200) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM messages
                WHERE chat_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (chat_id, limit),
            ).fetchall()
        items = [dict(row) for row in rows]
        items.reverse()
        for item in items:
            item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return items

    def upsert_user_fact(
        self,
        user_id: str,
        fact: str,
        normalized_fact: str,
        source_chat_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        now = utcnow_iso()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO user_facts(fact_id, user_id, fact, normalized_fact, source_chat_id, updated_at, metadata_json)
                VALUES(?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, normalized_fact) DO UPDATE SET
                    fact = excluded.fact,
                    source_chat_id = excluded.source_chat_id,
                    updated_at = excluded.updated_at,
                    metadata_json = excluded.metadata_json
                """,
                (str(uuid.uuid4()), user_id, fact, normalized_fact, source_chat_id, now, _to_json(metadata)),
            )

    def list_user_facts(self, user_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM user_facts WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
        items = [dict(row) for row in rows]
        for item in items:
            item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return items

    def upsert_preference(
        self,
        user_id: str,
        preference: str,
        normalized_preference: str,
        source_chat_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        now = utcnow_iso()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO preferences(
                    preference_id, user_id, preference, normalized_preference, source_chat_id, updated_at, metadata_json
                )
                VALUES(?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, normalized_preference) DO UPDATE SET
                    preference = excluded.preference,
                    source_chat_id = excluded.source_chat_id,
                    updated_at = excluded.updated_at,
                    metadata_json = excluded.metadata_json
                """,
                (
                    str(uuid.uuid4()),
                    user_id,
                    preference,
                    normalized_preference,
                    source_chat_id,
                    now,
                    _to_json(metadata),
                ),
            )

    def list_preferences(self, user_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM preferences WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
        items = [dict(row) for row in rows]
        for item in items:
            item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return items

    def upsert_task(
        self,
        user_id: str,
        chat_id: str,
        task: str,
        normalized_task: str,
        status: str = "open",
        metadata: dict[str, Any] | None = None,
    ) -> None:
        now = utcnow_iso()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO ongoing_tasks(task_id, user_id, chat_id, task, normalized_task, status, updated_at, metadata_json)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, chat_id, normalized_task) DO UPDATE SET
                    task = excluded.task,
                    status = excluded.status,
                    updated_at = excluded.updated_at,
                    metadata_json = excluded.metadata_json
                """,
                (
                    str(uuid.uuid4()),
                    user_id,
                    chat_id,
                    task,
                    normalized_task,
                    status,
                    now,
                    _to_json(metadata),
                ),
            )

    def list_tasks(self, user_id: str, chat_id: str | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM ongoing_tasks WHERE user_id = ?"
        params: list[Any] = [user_id]
        if chat_id:
            query += " AND chat_id = ?"
            params.append(chat_id)
        query += " ORDER BY updated_at DESC"
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        items = [dict(row) for row in rows]
        for item in items:
            item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return items

    def upsert_file(
        self,
        file_id: str,
        user_id: str,
        chat_id: str,
        file_name: str,
        mime_type: str,
        file_path: str,
        sha256: str,
        status: str,
        metadata: dict[str, Any] | None = None,
        raw_text: str = "",
    ) -> None:
        now = utcnow_iso()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO files(
                    file_id, user_id, chat_id, file_name, mime_type, file_path, raw_text, sha256, status,
                    created_at, updated_at, metadata_json
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(file_id) DO UPDATE SET
                    user_id = excluded.user_id,
                    chat_id = excluded.chat_id,
                    file_name = excluded.file_name,
                    mime_type = excluded.mime_type,
                    file_path = excluded.file_path,
                    raw_text = excluded.raw_text,
                    sha256 = excluded.sha256,
                    status = excluded.status,
                    updated_at = excluded.updated_at,
                    metadata_json = excluded.metadata_json
                """,
                (
                    file_id,
                    user_id,
                    chat_id,
                    file_name,
                    mime_type,
                    file_path,
                    raw_text,
                    sha256,
                    status,
                    now,
                    now,
                    _to_json(metadata),
                ),
            )

    def get_file(self, file_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM files WHERE file_id = ?",
                (file_id,),
            ).fetchone()
        if row is None:
            return None
        item = dict(row)
        item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return item

    def upsert_link(
        self,
        link_id: str,
        user_id: str,
        chat_id: str,
        url: str,
        title: str,
        cleaned_text: str,
        status: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        now = utcnow_iso()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO parsed_links(
                    link_id, user_id, chat_id, url, title, cleaned_text, status, created_at, updated_at, metadata_json
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, chat_id, url) DO UPDATE SET
                    link_id = excluded.link_id,
                    title = excluded.title,
                    cleaned_text = excluded.cleaned_text,
                    status = excluded.status,
                    updated_at = excluded.updated_at,
                    metadata_json = excluded.metadata_json
                """,
                (link_id, user_id, chat_id, url, title, cleaned_text, status, now, now, _to_json(metadata)),
            )

    def get_link_by_url(self, user_id: str, chat_id: str, url: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT * FROM parsed_links
                WHERE user_id = ? AND chat_id = ? AND url = ?
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (user_id, chat_id, url),
            ).fetchone()
        if row is None:
            return None
        item = dict(row)
        item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return item

    def get_link_by_id(self, link_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM parsed_links WHERE link_id = ?",
                (link_id,),
            ).fetchone()
        if row is None:
            return None
        item = dict(row)
        item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return item

    def list_links(self, user_id: str, chat_id: str | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM parsed_links WHERE user_id = ?"
        params: list[Any] = [user_id]
        if chat_id:
            query += " AND chat_id = ?"
            params.append(chat_id)
        query += " ORDER BY updated_at DESC"
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        items = [dict(row) for row in rows]
        for item in items:
            item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return items

    def replace_chunks(
        self,
        source_type: str,
        source_id: str,
        user_id: str,
        chat_id: str,
        chunks: list[str],
        metadata: list[dict[str, Any]] | None = None,
    ) -> list[str]:
        chunk_ids: list[str] = []
        now = utcnow_iso()
        metadata_items = metadata or [{} for _ in chunks]
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM document_chunks WHERE source_type = ? AND source_id = ?",
                (source_type, source_id),
            )
            for ordinal, chunk_text in enumerate(chunks):
                chunk_id = f"{source_id}:chunk-{ordinal + 1}"
                chunk_ids.append(chunk_id)
                connection.execute(
                    """
                    INSERT INTO document_chunks(
                        chunk_id, source_type, source_id, user_id, chat_id, ordinal, text, created_at, metadata_json
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        chunk_id,
                        source_type,
                        source_id,
                        user_id,
                        chat_id,
                        ordinal,
                        chunk_text,
                        now,
                        _to_json(metadata_items[ordinal] if ordinal < len(metadata_items) else {}),
                    ),
                )
        return chunk_ids

    def get_chunks_for_source(
        self,
        source_type: str,
        source_id: str,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        query = """
            SELECT * FROM document_chunks
            WHERE source_type = ? AND source_id = ?
            ORDER BY ordinal ASC
        """
        params: list[Any] = [source_type, source_id]
        if limit is not None:
            query += " LIMIT ?"
            params.append(limit)
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        items = [dict(row) for row in rows]
        for item in items:
            item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return items

    def list_chunks(
        self,
        user_id: str,
        chat_id: str | None = None,
        source_type: str | None = None,
        source_ids: list[str] | None = None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        query = "SELECT * FROM document_chunks WHERE user_id = ?"
        params: list[Any] = [user_id]
        if chat_id:
            query += " AND chat_id = ?"
            params.append(chat_id)
        if source_type:
            query += " AND source_type = ?"
            params.append(source_type)
        if source_ids:
            placeholders = ", ".join("?" for _ in source_ids)
            query += f" AND source_id IN ({placeholders})"
            params.extend(source_ids)
        query += " ORDER BY created_at DESC, ordinal ASC LIMIT ?"
        params.append(limit)
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        items = [dict(row) for row in rows]
        for item in items:
            item["metadata"] = _from_json(item.pop("metadata_json", ""))
        return items
