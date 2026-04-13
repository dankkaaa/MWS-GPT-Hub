const root = document.getElementById("app");

const state = {
  appName: root.dataset.appName || "MWS GPT Hub",
  userId: loadOrCreateUserId(),
  chats: [],
  activeChatId: null,
  messages: [],
  mode: localStorage.getItem("mts-web-mode") || "auto",
  selectedModel: localStorage.getItem("mts-web-model") || "",
  pendingAttachments: [],
  models: { manual_models: [] },
  loading: false,
  typingText: "",
  sidebarCollapsed: false,
  recognition: null,
  isRecording: false,
  recordingStartedAt: 0,
};

const els = {
  sidebar: document.getElementById("sidebar"),
  chatHistory: document.getElementById("chatHistory"),
  chatTitle: document.getElementById("chatTitle"),
  modeIndicator: document.getElementById("modeIndicator"),
  emptyState: document.getElementById("emptyState"),
  messages: document.getElementById("messages"),
  typingShell: document.getElementById("typingShell"),
  composerDock: document.getElementById("composerDock"),
  composerAttachments: document.getElementById("composerAttachments"),
  messageInput: document.getElementById("messageInput"),
  attachButton: document.getElementById("attachButton"),
  fileInput: document.getElementById("fileInput"),
  sendButton: document.getElementById("sendButton"),
  voiceButton: document.getElementById("voiceButton"),
  modelButton: document.getElementById("modelButton"),
  modelButtonText: document.getElementById("modelButtonText"),
  modelSheet: document.getElementById("modelSheet"),
  modelList: document.getElementById("modelList"),
  settingsSheet: document.getElementById("settingsSheet"),
  settingsButton: document.getElementById("settingsButton"),
  settingsMode: document.getElementById("settingsMode"),
  settingsUserId: document.getElementById("settingsUserId"),
  settingsApiKeyStatus: document.getElementById("settingsApiKeyStatus"),
  newChatTop: document.getElementById("newChatTop"),
  newChatSidebar: document.getElementById("newChatSidebar"),
  sidebarToggle: document.getElementById("sidebarToggle"),
};

init().catch((error) => {
  console.error(error);
  alert(error.message || "Не удалось запустить веб-чат.");
});

async function init() {
  bindEvents();
  autosizeTextarea();

  const [health, models] = await Promise.all([apiFetch("/api/health"), apiFetch("/api/models")]);
  state.models = models;
  normalizePersistedModelSelection();
  els.settingsApiKeyStatus.textContent = health.api_key_present ? "подключен" : "не задан";
  renderModelSheet();
  updateModeUi();

  await loadChats();
  if (!state.chats.length) {
    const chat = await createChat();
    await openChat(chat.chat_id);
  } else {
    const remembered = localStorage.getItem("mts-web-chat-id");
    const initialChatId = state.chats.find((item) => item.chat_id === remembered)?.chat_id || state.chats[0].chat_id;
    await openChat(initialChatId);
  }
}

function bindEvents() {
  els.newChatTop.addEventListener("click", () => handleNewChat());
  els.newChatSidebar.addEventListener("click", () => handleNewChat());
  els.sidebarToggle.addEventListener("click", toggleSidebar);
  els.settingsButton.addEventListener("click", () => toggleSheet(els.settingsSheet, true));
  els.attachButton.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length) {
      uploadFiles(files).catch(handleClientError);
    }
    event.target.value = "";
  });
  els.sendButton.addEventListener("click", () => sendCurrentMessage().catch(handleClientError));
  els.voiceButton.addEventListener("click", toggleVoiceRecording);
  els.modelButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSheet(els.modelSheet, els.modelSheet.classList.contains("hidden"));
  });
  els.modelSheet.addEventListener("click", (event) => event.stopPropagation());
  els.messageInput.addEventListener("input", autosizeTextarea);
  els.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendCurrentMessage().catch(handleClientError);
    }
  });

  root.querySelectorAll("[data-close-sheet='true']").forEach((button) => {
    button.addEventListener("click", () => toggleSheet(els.modelSheet, false));
  });
  root.querySelectorAll("[data-close-settings='true']").forEach((button) => {
    button.addEventListener("click", () => toggleSheet(els.settingsSheet, false));
  });

  document.addEventListener("click", (event) => {
    if (!els.modelSheet.classList.contains("hidden") && !els.modelButton.contains(event.target)) {
      toggleSheet(els.modelSheet, false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      toggleSheet(els.modelSheet, false);
      toggleSheet(els.settingsSheet, false);
    }
  });

  root.querySelectorAll(".quick-action").forEach((button) => {
    button.addEventListener("click", () => {
      els.messageInput.value = button.dataset.prompt || "";
      autosizeTextarea();
      els.messageInput.focus();
    });
  });
}

function loadOrCreateUserId() {
  const existing = localStorage.getItem("mts-web-user-id");
  if (existing) {
    return existing;
  }
  const generated = `web-user-${makeId(8)}`;
  localStorage.setItem("mts-web-user-id", generated);
  return generated;
}

function normalizePersistedModelSelection() {
  const availableModelIds = new Set((state.models.manual_models || []).map((item) => item.id));
  if (state.mode === "manual" && state.selectedModel && !availableModelIds.has(state.selectedModel)) {
    state.mode = "auto";
    state.selectedModel = "";
    persistMode();
  }
}

function makeId(length = 8) {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID().replace(/-/g, "").slice(0, length);
  }
  return Math.random().toString(16).slice(2, 2 + length);
}

async function loadChats() {
  const payload = await apiFetch(`/api/chats?user_id=${encodeURIComponent(state.userId)}`);
  state.chats = payload.chats || [];
  renderChatHistory();
}

async function createChat() {
  const payload = await apiFetch("/api/chats", {
    method: "POST",
    body: JSON.stringify({ user_id: state.userId }),
  });
  state.chats = [payload.chat, ...state.chats.filter((item) => item.chat_id !== payload.chat.chat_id)];
  renderChatHistory();
  return payload.chat;
}

async function handleNewChat() {
  const chat = await createChat();
  state.messages = [];
  state.pendingAttachments = [];
  await openChat(chat.chat_id);
}

async function openChat(chatId) {
  state.activeChatId = chatId;
  localStorage.setItem("mts-web-chat-id", chatId);
  renderChatHistory();
  const payload = await apiFetch(`/api/chats/${encodeURIComponent(chatId)}/messages?user_id=${encodeURIComponent(state.userId)}`);
  state.messages = payload.messages || [];
  syncActiveChat(payload.chat);
  render();
  scrollMessagesToBottom();
}

function syncActiveChat(chat) {
  if (!chat) {
    return;
  }
  const nextChats = state.chats.filter((item) => item.chat_id !== chat.chat_id);
  state.chats = [chat, ...nextChats];
  renderChatHistory();
  els.chatTitle.textContent = chat.title || "Новый чат";
}

async function sendCurrentMessage() {
  if (state.loading) {
    return;
  }
  const text = els.messageInput.value.trim();
  if (!text && !state.pendingAttachments.length) {
    return;
  }
  if (!state.activeChatId) {
    const created = await createChat();
    state.activeChatId = created.chat_id;
  }

  state.loading = true;
  state.typingText = inferTypingText(text, state.pendingAttachments);
  renderTypingState();
  updateSendButton();

  const payload = await apiFetch(`/api/chats/${encodeURIComponent(state.activeChatId)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      user_id: state.userId,
      message: text,
      attachments: state.pendingAttachments,
      mode: state.mode,
      selected_model: state.mode === "manual" ? state.selectedModel : null,
    }),
  });

  state.messages = payload.messages || [];
  state.pendingAttachments = [];
  els.messageInput.value = "";
  autosizeTextarea();
  syncActiveChat(payload.chat);
  render();
  state.loading = false;
  state.typingText = "";
  renderTypingState();
  updateSendButton();
  scrollMessagesToBottom();
}

async function uploadFiles(files) {
  if (!state.activeChatId) {
    const created = await createChat();
    state.activeChatId = created.chat_id;
  }

  for (const file of files) {
    const temporary = {
      local_id: makeId(6),
      type: "file",
      metadata: {
        file_name: file.name,
        ingestion_status: "uploading",
        file_size: file.size,
      },
    };
    state.pendingAttachments.push(temporary);
    renderComposerAttachments();

    const formData = new FormData();
    formData.append("user_id", state.userId);
    formData.append("chat_id", state.activeChatId);
    formData.append("file", file);

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) {
      removePendingAttachment(temporary.local_id);
      throw new Error(payload.error || `Не удалось загрузить файл ${file.name}`);
    }

    state.pendingAttachments = state.pendingAttachments.map((item) =>
      item.local_id === temporary.local_id ? payload.attachment : item
    );
    state.messages = payload.messages || state.messages;
    syncActiveChat(payload.chat);
    render();
    scrollMessagesToBottom();
  }
}

function removePendingAttachment(localIdOrFileId) {
  state.pendingAttachments = state.pendingAttachments.filter((item) => {
    return item.local_id !== localIdOrFileId && item.file_id !== localIdOrFileId;
  });
  renderComposerAttachments();
}

function render() {
  renderChatHistory();
  renderMessages();
  renderComposerAttachments();
  updateModeUi();
  renderSettings();
}

function renderChatHistory() {
  els.chatHistory.innerHTML = "";
  const groups = groupChatsByDate(state.chats);
  if (!groups.length) {
    const empty = document.createElement("div");
    empty.className = "sidebar__group";
    empty.innerHTML = "<h3>История</h3><div class='chat-link'><div class='chat-link__title'>Пока пусто</div></div>";
    els.chatHistory.appendChild(empty);
    return;
  }

  for (const group of groups) {
    const wrapper = document.createElement("section");
    wrapper.className = "sidebar__group";

    const title = document.createElement("h3");
    title.textContent = group.label;
    wrapper.appendChild(title);

    group.items.forEach((chat) => {
      const button = document.createElement("button");
      button.className = `chat-link${chat.chat_id === state.activeChatId ? " is-active" : ""}`;
      button.innerHTML = `
        <span class="chat-link__title">${escapeHtml(chat.title || "Новый чат")}</span>
        <span class="chat-link__preview">${escapeHtml(chat.preview || "Без сообщений")}</span>
      `;
      button.addEventListener("click", () => openChat(chat.chat_id).catch(handleClientError));
      wrapper.appendChild(button);
    });

    els.chatHistory.appendChild(wrapper);
  }
}

function groupChatsByDate(chats) {
  const today = [];
  const yesterday = [];
  const recent = [];

  chats.forEach((chat) => {
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
    { label: "Сегодня", items: today },
    { label: "Вчера", items: yesterday },
    { label: "Недавние", items: recent },
  ].filter((group) => group.items.length);
}

function renderMessages() {
  els.messages.innerHTML = "";
  const hasMessages = state.messages.length > 0;
  els.emptyState.classList.toggle("hidden", hasMessages);
  els.composerDock.classList.toggle("composer-dock--compact", hasMessages);
  root.classList.toggle("app--empty", !hasMessages);
  root.classList.toggle("app--has-messages", hasMessages);

  if (!hasMessages) {
    return;
  }

  state.messages.forEach((message) => {
    els.messages.appendChild(buildMessageNode(message));
  });
}

function buildMessageNode(message) {
  const wrapper = document.createElement("article");
  wrapper.className = `message message--${message.role || "assistant"}`;

  if (message.role === "user") {
    const row = document.createElement("div");
    row.className = "message__row";
    const body = document.createElement("div");
    body.className = "message__body";

    if (message.attachments?.length) {
      body.appendChild(buildAttachmentRow(message.attachments));
    }

    if (message.content?.trim()) {
      const bubble = document.createElement("div");
      bubble.className = "message__text";
      bubble.textContent = message.content;
      body.appendChild(bubble);
    }

    const urls = extractUrls(message.content || "");
    if (urls.length) {
      body.appendChild(buildSourceRow(urls));
    }

    row.appendChild(body);
    wrapper.appendChild(row);
    return wrapper;
  }

  if (message.role === "system" && message.message_kind === "file_upload") {
    const row = document.createElement("div");
    row.className = "message__row";
    const avatar = document.createElement("div");
    avatar.className = "message__avatar";
    avatar.textContent = "↗";
    const body = document.createElement("div");
    body.className = "message__body";
    const role = document.createElement("div");
    role.className = "message__role";
    role.innerHTML = `<strong>Файл готов</strong>`;
    body.appendChild(role);
    if (message.attachments?.length) {
      body.appendChild(buildAttachmentRow(message.attachments, true));
    }
    row.appendChild(avatar);
    row.appendChild(body);
    wrapper.appendChild(row);
    return wrapper;
  }

  const row = document.createElement("div");
  row.className = "message__row";

  const avatar = document.createElement("div");
  avatar.className = "message__avatar";
  avatar.textContent = message.role === "assistant" ? "✦" : "•";

  const body = document.createElement("div");
  body.className = "message__body";

  const role = document.createElement("div");
  role.className = "message__role";
  role.innerHTML = `<strong>${message.role === "assistant" ? state.appName : "Система"}</strong>`;
  if (message.context_used) {
    role.appendChild(makeMetaChip("С учетом контекста"));
  }
  if (message.model_used) {
    role.appendChild(makeMetaChip(message.model_used));
  }
  body.appendChild(role);

  if (message.attachments?.length) {
    body.appendChild(buildAttachmentRow(message.attachments));
  }

  if (message.tool_outputs?.length) {
    body.appendChild(buildToolRow(message.tool_outputs));
  }

  if (message.content?.trim()) {
    if (shouldRenderImageResult(message)) {
      body.appendChild(buildImageResultCard(message.content));
    } else {
      const text = document.createElement("div");
      text.className = "message__text";
      text.textContent = message.content;
      body.appendChild(text);
    }
  }

  if (message.sources?.length) {
    body.appendChild(buildSourceRow(message.sources));
  }

  row.appendChild(avatar);
  row.appendChild(body);
  wrapper.appendChild(row);
  return wrapper;
}

function shouldRenderImageResult(message) {
  const content = (message.content || "").trim();
  if (!content) {
    return false;
  }
  const looksLikeImageUrl = /^https?:\/\/.+\.(png|jpg|jpeg|webp)(\?.*)?$/i.test(content);
  if (looksLikeImageUrl) {
    return true;
  }
  return message.task_type === "image_generation" && /^https?:\/\//i.test(content);
}

function buildImageResultCard(imageUrl) {
  const card = document.createElement("div");
  card.className = "image-result-card";

  const link = document.createElement("a");
  link.href = imageUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.className = "image-result-card__link";

  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = "Сгенерированное изображение";
  image.className = "image-result-card__img";

  const caption = document.createElement("div");
  caption.className = "image-result-card__caption";
  caption.textContent = "Сгенерированное изображение";

  link.appendChild(image);
  card.appendChild(link);
  card.appendChild(caption);
  return card;
}

function buildAttachmentRow(attachments, forceFileCards = false) {
  const container = document.createElement("div");
  container.className = "message__attachments";

  attachments.forEach((attachment) => {
    if (attachment.type === "file" || forceFileCards) {
      container.appendChild(buildFileCard(attachment));
      return;
    }
    if (attachment.type === "voice_note") {
      container.appendChild(buildVoiceCard(attachment));
      return;
    }
    if (attachment.type === "url") {
      container.appendChild(buildSourceCard(attachment.url || attachment.metadata?.url || "", "Ссылка"));
      return;
    }
    const chip = document.createElement("div");
    chip.className = "attachment-chip";
    chip.textContent = attachment.type || "вложение";
    container.appendChild(chip);
  });

  return container;
}

function buildFileCard(attachment) {
  const card = document.createElement("div");
  card.className = "file-card";
  const meta = attachment.metadata || {};
  const title = meta.file_name || attachment.file_id || "Файл";
  const ext = title.includes(".") ? title.split(".").pop().toUpperCase() : attachment.mime_type || "FILE";
  const status = meta.ingestion_status || meta.status || "готово";
  card.innerHTML = `
    <div class="file-card__title">${escapeHtml(title)}</div>
    <div class="file-card__meta">
      <span>${escapeHtml(ext)}</span>
      <span class="file-card__status">${escapeHtml(status)}</span>
    </div>
  `;
  return card;
}

function buildVoiceCard(attachment) {
  const card = document.createElement("div");
  card.className = "voice-card";
  const transcript = attachment.metadata?.transcript || "";
  const durationMs = Number(attachment.metadata?.duration_ms || 0);
  const durationLabel = durationMs ? formatDuration(durationMs) : "Голосовой запрос";
  card.innerHTML = `
    <strong>${escapeHtml(durationLabel)}</strong>
    <div class="voice-card__wave"></div>
    <span class="source-card__text">${escapeHtml(transcript || "Распознано как текст")}</span>
  `;
  return card;
}

function buildToolRow(toolOutputs) {
  const row = document.createElement("div");
  row.className = "message__tools";
  toolOutputs.forEach((tool) => {
    const card = document.createElement("div");
    card.className = "tool-card";
    const label = toolLabel(tool);
    card.innerHTML = `
      <div class="tool-card__name">${escapeHtml(label)}</div>
      <div class="tool-card__text">${escapeHtml(toolPreview(tool))}</div>
    `;
    row.appendChild(card);
  });
  return row;
}

function toolLabel(tool) {
  const labels = {
    retrieve_doc_context: "Анализ документа",
    parse_url: "Ссылка",
    web_search: "Web search",
  };
  return labels[tool.name] || tool.name || "Инструмент";
}

function toolPreview(tool) {
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

function buildSourceRow(sources) {
  const row = document.createElement("div");
  row.className = "message__sources";
  [...new Set(sources)].forEach((source) => {
    row.appendChild(buildSourceCard(source));
  });
  return row;
}

function buildSourceCard(source, title = "") {
  const card = document.createElement("div");
  card.className = "source-card";
  const isUrl = /^https?:\/\//i.test(source);
  if (isUrl) {
    card.innerHTML = `
      <a href="${escapeAttribute(source)}" target="_blank" rel="noreferrer">${escapeHtml(title || friendlySourceLabel(source))}</a>
      <div class="source-card__text">${escapeHtml(source)}</div>
    `;
    return card;
  }
  card.innerHTML = `
    <strong>${escapeHtml(title || "Источник")}</strong>
    <div class="source-card__text">${escapeHtml(source)}</div>
  `;
  return card;
}

function makeMetaChip(text) {
  const chip = document.createElement("span");
  chip.className = "message__meta-chip";
  chip.textContent = text;
  return chip;
}

function renderComposerAttachments() {
  els.composerAttachments.innerHTML = "";
  els.composerAttachments.classList.toggle("hidden", !state.pendingAttachments.length);
  state.pendingAttachments.forEach((attachment) => {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";
    const fileName = attachment.metadata?.file_name || attachment.metadata?.transcript || attachment.file_id || "Вложение";
    const status = attachment.metadata?.ingestion_status || (attachment.type === "voice_note" ? "готово" : "");
    chip.innerHTML = `
      <span>${escapeHtml(fileName)}</span>
      <span class="attachment-chip__status">${escapeHtml(status)}</span>
    `;
    const remove = document.createElement("button");
    remove.className = "attachment-chip__remove";
    remove.type = "button";
    remove.textContent = "✕";
    remove.addEventListener("click", () => removePendingAttachment(attachment.local_id || attachment.file_id));
    chip.appendChild(remove);
    els.composerAttachments.appendChild(chip);
  });
}

function renderTypingState() {
  if (!state.loading) {
    els.typingShell.classList.add("hidden");
    els.typingShell.innerHTML = "";
    return;
  }
  els.typingShell.classList.remove("hidden");
  els.typingShell.innerHTML = `
    <div class="typing-card">
      <div class="spinner"></div>
      <div>${escapeHtml(state.typingText || "Думаю над ответом")}</div>
    </div>
  `;
  scrollMessagesToBottom();
}

function renderModelSheet() {
  els.modelList.innerHTML = "";
  const autoButton = document.createElement("button");
  autoButton.className = `model-option${state.mode === "auto" ? " is-active" : ""}`;
  autoButton.innerHTML = `
    <span class="model-option__title">Автоматически</span>
    <span class="model-option__subtitle">Система сама выберет модель и инструменты.</span>
  `;
  autoButton.addEventListener("click", () => {
    state.mode = "auto";
    state.selectedModel = "";
    persistMode();
    updateModeUi();
    toggleSheet(els.modelSheet, false);
    renderModelSheet();
  });
  els.modelList.appendChild(autoButton);

  (state.models.manual_models || []).forEach((model) => {
    const button = document.createElement("button");
    const active = state.mode === "manual" && state.selectedModel === model.id;
    button.className = `model-option${active ? " is-active" : ""}`;
    button.innerHTML = `
      <span class="model-option__title">${escapeHtml(model.label)}</span>
      <span class="model-option__subtitle">${escapeHtml(model.kind)} · ${escapeHtml(model.id)}</span>
    `;
    button.addEventListener("click", () => {
      state.mode = "manual";
      state.selectedModel = model.id;
      persistMode();
      updateModeUi();
      toggleSheet(els.modelSheet, false);
      renderModelSheet();
    });
    els.modelList.appendChild(button);
  });
}

function renderSettings() {
  els.settingsMode.textContent = state.mode === "auto" ? "Автоматический" : `Вручную: ${state.selectedModel}`;
  els.settingsUserId.textContent = state.userId;
}

function updateModeUi() {
  const modeLabel = state.mode === "auto" ? "Авто" : "Вручную";
  els.modeIndicator.textContent = modeLabel;
  els.modelButtonText.textContent =
    state.mode === "auto"
      ? "Автоматически"
      : friendlyModelLabel(state.selectedModel || "Вручную");
  renderSettings();
}

function persistMode() {
  localStorage.setItem("mts-web-mode", state.mode);
  localStorage.setItem("mts-web-model", state.selectedModel || "");
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  els.sidebar.classList.toggle("sidebar--collapsed", state.sidebarCollapsed);
}

function toggleSheet(sheet, open) {
  sheet.classList.toggle("hidden", !open);
  if (sheet === els.modelSheet) {
    els.modelButton.setAttribute("aria-expanded", open ? "true" : "false");
    return;
  }
}

function updateSendButton() {
  els.sendButton.classList.toggle("is-loading", state.loading);
  els.sendButton.disabled = state.loading;
}

function autosizeTextarea() {
  els.messageInput.style.height = "0px";
  els.messageInput.style.height = `${Math.min(els.messageInput.scrollHeight, 180)}px`;
}

function inferTypingText(message, attachments) {
  if (attachments.some((item) => item.type === "file")) {
    return "Обрабатываю файл и подбираю релевантный контекст";
  }
  if (attachments.some((item) => item.type === "voice_note")) {
    return "Продолжаю диалог по голосовому запросу";
  }
  if (/https?:\/\//i.test(message)) {
    return "Проверяю содержимое страницы";
  }
  if (/(погода|новости|найди|кто такой|расскажи про)/i.test(message)) {
    return "Ищу свежие источники и собираю ответ";
  }
  return "Формирую ответ";
}

function extractUrls(text) {
  return (text || "").match(/https?:\/\/[^\s]+/gi) || [];
}

function formatDuration(durationMs) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} голосовой запрос`;
}

function friendlySourceLabel(source) {
  try {
    const url = new URL(source);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return source;
  }
}

function friendlyModelLabel(modelId) {
  return (
    (state.models.manual_models || []).find((item) => item.id === modelId)?.label ||
    modelId ||
    "Автоматически"
  );
}

function scrollMessagesToBottom() {
  const surface = document.getElementById("chatSurface");
  requestAnimationFrame(() => {
    surface.scrollTo({ top: surface.scrollHeight, behavior: "smooth" });
  });
}

function toggleVoiceRecording() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    alert("В этом браузере нет встроенного SpeechRecognition. На демо лучше открыть сайт в Chrome.");
    return;
  }

  if (state.isRecording && state.recognition) {
    state.recognition.stop();
    return;
  }

  state.recognition = new Recognition();
  state.recognition.lang = "ru-RU";
  state.recognition.interimResults = true;
  state.recognition.continuous = false;

  let finalTranscript = "";
  state.recordingStartedAt = Date.now();
  state.isRecording = true;
  els.voiceButton.classList.add("is-recording");

  state.recognition.onresult = (event) => {
    finalTranscript = Array.from(event.results)
      .map((result) => result[0]?.transcript || "")
      .join(" ")
      .trim();
    els.messageInput.value = finalTranscript;
    autosizeTextarea();
  };

  state.recognition.onerror = () => {
    state.isRecording = false;
    els.voiceButton.classList.remove("is-recording");
  };

  state.recognition.onend = () => {
    state.isRecording = false;
    els.voiceButton.classList.remove("is-recording");
    const transcript = finalTranscript.trim();
    if (!transcript) {
      return;
    }
    state.pendingAttachments = state.pendingAttachments.filter((item) => item.type !== "voice_note");
    state.pendingAttachments.push({
      type: "voice_note",
      metadata: {
        transcript,
        duration_ms: Date.now() - state.recordingStartedAt,
      },
    });
    renderComposerAttachments();
  };

  state.recognition.start();
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Запрос завершился ошибкой");
  }
  return payload;
}

function handleClientError(error) {
  console.error(error);
  state.loading = false;
  state.typingText = "";
  renderTypingState();
  updateSendButton();
  alert(error.message || "Произошла ошибка");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
