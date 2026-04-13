export function makeId(length = 8) {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID().replace(/-/g, "").slice(0, length);
  }
  return Math.random().toString(16).slice(2, 2 + length);
}

export function getStoredTheme() {
  return window.localStorage.getItem("mts-web-theme") || "light";
}

export function persistTheme(theme) {
  window.localStorage.setItem("mts-web-theme", theme);
}

export function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalized;
  document.documentElement.style.colorScheme = normalized;
  document.body.dataset.theme = normalized;
}

export function friendlyModelLabel(modelId, models) {
  return models.find((item) => item.id === modelId)?.label || modelId || "Автоматически";
}

export function isChatEmpty(chat) {
  const preview = String(chat?.preview || "").trim();
  const messageCount = Number(chat?.message_count || 0);
  const previewLooksEmpty = !preview || /без сообщений|пока без сообщений/i.test(preview);
  if (messageCount > 0) {
    return false;
  }
  return previewLooksEmpty;
}

export function groupChatsByDate(chats) {
  const pinned = [];
  const today = [];
  const yesterday = [];
  const recent = [];

  chats.forEach((chat) => {
    if (chat?.metadata?.pinned) {
      pinned.push(chat);
      return;
    }

    const updatedAt = new Date(chat.updated_at || chat.created_at || Date.now());
    const daysDiff = Math.floor((Date.now() - updatedAt.getTime()) / 86400000);
    if (daysDiff <= 0) {
      today.push(chat);
      return;
    }
    if (daysDiff === 1) {
      yesterday.push(chat);
      return;
    }
    recent.push(chat);
  });

  return [
    { label: "Закреплённые", items: pinned },
    { label: "Сегодня", items: today },
    { label: "Вчера", items: yesterday },
    { label: "Недавние", items: recent },
  ].filter((group) => group.items.length);
}

function normalizeSearchText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function findMatchSnippet(text = "", query = "", radius = 68) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  const normalizedSource = source.toLowerCase();
  const normalizedQuery = normalizeSearchText(query);
  if (!source || !normalizedQuery) {
    return "";
  }
  const index = normalizedSource.indexOf(normalizedQuery);
  if (index === -1) {
    return "";
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(source.length, index + normalizedQuery.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < source.length ? "…" : "";
  return `${prefix}${source.slice(start, end)}${suffix}`;
}

export function filterGroupedChats(groups, query = "") {
  const normalized = normalizeSearchText(query);
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .map((chat) => {
          if (!normalized) {
            return { ...chat, _matchPreview: "" };
          }
          const haystack = normalizeSearchText(
            `${chat.title || ""} ${chat.preview || ""} ${chat.search_preview || ""} ${chat.search_text || ""}`
          );
          if (!haystack.includes(normalized)) {
            return null;
          }
          const snippet =
            findMatchSnippet(chat.search_text || "", normalized) ||
            findMatchSnippet(chat.search_preview || "", normalized) ||
            findMatchSnippet(chat.preview || "", normalized) ||
            findMatchSnippet(chat.title || "", normalized);
          return { ...chat, _matchPreview: snippet };
        })
        .filter(Boolean),
    }))
    .filter((group) => group.items.length);
}

export function extractUrls(text) {
  return (text || "").match(/https?:\/\/[^\s]+/gi) || [];
}

export function friendlySourceLabel(source) {
  try {
    const url = new URL(source);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return source;
  }
}

export function formatDuration(durationMs) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} голосовой запрос`;
}

export function inferTypingText(message, attachments, options = {}) {
  if (options.image) {
    return "Генерирую изображение";
  }
  if (attachments.some((item) => item.type === "file")) {
    return "Обрабатываю файл и подбираю релевантный контекст";
  }
  if (attachments.some((item) => item.type === "voice_note")) {
    return "Продолжаю диалог по голосовому запросу";
  }
  if (/https?:\/\//i.test(message)) {
    return "Проверяю содержимое страницы";
  }
  if (/(погода|новости|найди|кто такой|расскажи про|поиск|research|search)/i.test(message)) {
    return "Ищу свежие источники и собираю ответ";
  }
  return "Думаю";
}

export function isImageResult(message) {
  const content = (message.content || "").trim();
  if (!content) {
    return false;
  }
  if (/^https?:\/\/.+\.(png|jpg|jpeg|webp)(\?.*)?$/i.test(content)) {
    return true;
  }
  return message.task_type === "image_generation" && /^https?:\/\//i.test(content);
}

export function getModelVisualKind(model) {
  const source = `${model?.id || ""} ${model?.label || ""} ${model?.kind || ""}`.toLowerCase();
  if (!source || source.includes("auto")) return "auto";
  if (/(image|изображ|картин|vision|генерац)/.test(source)) return "image";
  if (/(code|код|coder|programming|dev)/.test(source)) return "code";
  if (/(search|reason|research|web|поиск|аналит)/.test(source)) return "search";
  if (/(audio|voice|asr|whisper|голос|звук)/.test(source)) return "audio";
  return "chat";
}

export function isImageMode(mode, selectedModel, models) {
  if (mode !== "manual") return false;
  const model = (models?.manual_models || []).find((item) => item.id === selectedModel);
  return getModelVisualKind(model) === "image";
}

export function toolLabel(tool) {
  const labels = {
    retrieve_doc_context: "Анализ документа",
    parse_url: "Ссылка",
    web_search: "Web search",
  };
  return labels[tool.name] || tool.name || "Инструмент";
}

export function toolPreview(tool) {
  if (tool.name === "retrieve_doc_context") {
    const count = tool.metadata?.file_ids?.length || 1;
    return `Использован документ${count > 1 ? "ы" : ""} для ответа`;
  }
  if (tool.name === "parse_url") {
    return tool.metadata?.title || tool.metadata?.url || "Проверено содержимое страницы";
  }
  if (tool.name === "web_search") {
    const count = tool.metadata?.sources?.length || 0;
    return count ? `Найдено источников: ${count}` : "Использован поиск по интернету";
  }
  return (tool.content || "").slice(0, 90) || "Инструмент использован";
}

export function chatStorageKey(userId) {
  return `mts-web-chat-id:${userId || "anonymous"}`;
}

export function rememberChatId(userId, chatId) {
  if (!userId || !chatId) {
    return;
  }
  window.localStorage.setItem(chatStorageKey(userId), chatId);
}

export function getRememberedChatId(userId) {
  if (!userId) {
    return "";
  }
  return window.localStorage.getItem(chatStorageKey(userId)) || "";
}

export function clearRememberedChatId(userId) {
  if (!userId) {
    return;
  }
  window.localStorage.removeItem(chatStorageKey(userId));
}

export function canonicalizeLanguage(language = "") {
  const value = String(language || "").trim().toLowerCase();
  const aliasMap = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    sh: "bash",
    shell: "bash",
    yml: "yaml",
    md: "markdown",
    html: "html",
    css: "css",
    csharp: "c#",
  };
  return aliasMap[value] || value || "text";
}

export function formatLanguageLabel(language = "") {
  const normalized = canonicalizeLanguage(language);
  const labels = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    python: "Python",
    bash: "Bash",
    json: "JSON",
    yaml: "YAML",
    markdown: "Markdown",
    html: "HTML",
    css: "CSS",
    sql: "SQL",
    text: "Текст",
    plaintext: "Текст",
    "c#": "C#",
  };
  return labels[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function lineCount(value = "") {
  return String(value || "").split("\n").length;
}

export function isLongCodeBlock(code = "", threshold = 22) {
  return lineCount(code) > threshold || String(code || "").length > 1400;
}

export function isLongRichText(content = "") {
  const text = String(content || "").trim();
  return lineCount(text) > 26 || text.length > 2200;
}

export function buildRevealChunks(content = "") {
  const text = String(content || "").replace(/\r\n/g, "\n");
  if (!text) {
    return [];
  }

  const lines = text.split("\n");
  const chunks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (/^```/.test(line)) {
      const codeLines = [line];
      index += 1;
      while (index < lines.length) {
        codeLines.push(lines[index]);
        if (/^```/.test(lines[index])) {
          index += 1;
          break;
        }
        index += 1;
      }
      chunks.push(codeLines.join("\n") + (index < lines.length ? "\n" : ""));
      continue;
    }

    if (!line.trim()) {
      chunks.push("\n");
      index += 1;
      continue;
    }

    const words = line.match(/\S+\s*/g) || [line];
    words.forEach((word) => chunks.push(word));
    if (index < lines.length - 1) {
      chunks.push("\n");
    }
    index += 1;
  }

  return chunks;
}

export async function copyText(text) {
  const value = String(text || "");
  if (!value) {
    return false;
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const result = document.execCommand("copy");
  document.body.removeChild(textarea);
  return result;
}

export function escapeMarkdown(text = "") {
  return String(text || "").replace(/[\\`*_{}\[\]()#+\-.!|>]/g, "\\$&");
}

export function exportChatMarkdown(chat, messages) {
  const lines = [];
  lines.push(`# ${chat?.title || "Новый чат"}`);
  lines.push("");
  messages.forEach((message) => {
    const roleLabel =
      message.role === "assistant" ? "Ассистент" : message.role === "user" ? "Пользователь" : "Система";
    lines.push(`## ${roleLabel}`);
    lines.push("");
    if (message.content) {
      lines.push(message.content);
      lines.push("");
    }
    if (message.attachments?.length) {
      lines.push("Вложения:");
      message.attachments.forEach((attachment) => {
        lines.push(`- ${attachment.metadata?.file_name || attachment.metadata?.transcript || attachment.type || "Вложение"}`);
      });
      lines.push("");
    }
  });
  return lines.join("\n").trim() + "\n";
}

export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function slugifyFilename(value = "chat") {
  return (
    String(value || "chat")
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "chat"
  );
}

export function buildChatShareText(chat, messages) {
  const markdown = exportChatMarkdown(chat, messages);
  return `${chat?.title || "Новый чат"}\n\n${markdown}`;
}

export function apiFetch(url, options = {}) {
  return fetch(url, {
    credentials: "same-origin",
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    ...options,
  }).then(async (response) => {
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      const error = new Error(payload?.error || "Запрос завершился ошибкой");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  });
}


export function responseHistoryStorageKey(userId) {
  return `mts-web-response-history:${userId || "anonymous"}`;
}

export function loadResponseHistories(userId) {
  try {
    const raw = window.localStorage.getItem(responseHistoryStorageKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function persistResponseHistories(userId, value) {
  if (!userId) return;
  window.localStorage.setItem(responseHistoryStorageKey(userId), JSON.stringify(value || {}));
}

export function getLastAssistantVariant(messages = []) {
  const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant" && String(item.content || "").trim());
  if (!lastAssistant) return null;
  return {
    id: lastAssistant.message_id || makeId(12),
    content: lastAssistant.content || "",
    model_used: lastAssistant.model_used || "",
    created_at: lastAssistant.created_at || "",
  };
}

export function mergeResponseHistory(historyEntry = {}, variant) {
  if (!variant?.content) return historyEntry || { items: [], selectedIndex: 0 };
  const items = Array.isArray(historyEntry.items) ? [...historyEntry.items] : [];
  const duplicateIndex = items.findIndex((item) => String(item.content || "").trim() === String(variant.content || "").trim());
  if (duplicateIndex === -1) {
    items.push({
      id: variant.id || makeId(12),
      content: variant.content,
      model_used: variant.model_used || "",
      created_at: variant.created_at || new Date().toISOString(),
    });
    return { items, selectedIndex: items.length - 1 };
  }
  const next = items.map((item, index) => (index === duplicateIndex ? { ...item, ...variant } : item));
  return { items: next, selectedIndex: duplicateIndex };
}
