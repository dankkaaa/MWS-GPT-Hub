import React, { useEffect, useMemo, useRef, useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { ChatComposer } from "./components/ChatComposer";
import { CodeDrawer } from "./components/CodeDrawer";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { MessageList } from "./components/MessageList";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { ToastViewport } from "./components/ToastViewport";
import { ArrowDownIcon, CodeIcon, FileIcon, SearchIcon, SparklesIcon, MenuIcon } from "./components/icons";
import {
  apiFetch,
  applyTheme,
  buildChatShareText,
  clearRememberedChatId,
  copyText,
  downloadTextFile,
  exportChatMarkdown,
  friendlyModelLabel,
  getRememberedChatId,
  getStoredTheme,
  groupChatsByDate,
  getLastAssistantVariant,
  inferTypingText,
  isChatEmpty,
  loadResponseHistories,
  makeId,
  mergeResponseHistory,
  persistResponseHistories,
  persistTheme,
  rememberChatId,
  slugifyFilename,
  isImageMode,
} from "./lib/chat-utils";

const initialConfig = window.__APP_CONFIG__ || {};
const ONBOARDING_STORAGE_KEY = "mts-web-onboarding-dismissed";
const APP_PREFS_STORAGE_KEY = "mts-web-app-prefs";

function createDefaultModels() {
  return { manual_models: [] };
}

function TopBarStatus({ title, loading }) {
  return (
    <div className="mx-auto flex min-w-0 max-w-[min(64vw,560px)] flex-col items-center justify-center text-center">
      <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Текущий чат</div>
      <div className="mt-1 truncate text-[clamp(1rem,1.5vw,1.125rem)] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</div>
      <div className="mt-2 h-5 flex items-center justify-center">
        {loading ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)]/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)] shadow-[0_10px_20px_-16px_var(--shadow-color)] backdrop-blur-sm animate-[messageIn_.18s_ease-out]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-[loaderDot_1.1s_ease-in-out_infinite]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-[loaderDot_1.1s_ease-in-out_.16s_infinite]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-[loaderDot_1.1s_ease-in-out_.32s_infinite]" />
            </span>
            Думаю
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  const [appName, setAppName] = useState(initialConfig.appName || "MWS GPT Hub");
  const [apiKeyPresent, setApiKeyPresent] = useState(Boolean(initialConfig.apiKeyPresent));
  const [theme, setTheme] = useState(() => getStoredTheme());
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [models, setModels] = useState(() => createDefaultModels());
  const [mode, setMode] = useState(() => window.localStorage.getItem("mts-web-mode") || "auto");
  const [selectedModel, setSelectedModel] = useState(() => window.localStorage.getItem("mts-web-model") || "");
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [typingText, setTypingText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingKind, setLoadingKind] = useState("text");
  const [isRecording, setIsRecording] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState({ open: false, chatId: null, title: "" });
  const [panelState, setPanelState] = useState({ open: false, kind: "code", title: "", language: "text", content: "" });
  const [drawerCopied, setDrawerCopied] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [panelWidth, setPanelWidth] = useState(560);
  const [responseHistories, setResponseHistories] = useState({});
  const [showOnboarding, setShowOnboarding] = useState(() => window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "1");
  const [streamMessageId, setStreamMessageId] = useState("");
  const [appPrefs, setAppPrefs] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(APP_PREFS_STORAGE_KEY) || "{}");
      return {
        streamResponses: stored.streamResponses !== false,
        autoArtifacts: stored.autoArtifacts !== false,
      };
    } catch {
      return { streamResponses: true, autoArtifacts: true };
    }
  });

  const fileInputRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const recordingStartRef = useRef(0);
  const sendLockRef = useRef(false);

  const groupedChats = useMemo(() => groupChatsByDate(chats), [chats]);
  const hasMessages = messages.length > 0;
  const activeChat = chats.find((chat) => chat.chat_id === activeChatId) || null;
  const activeChatTitle = activeChat?.message_count ? activeChat?.title || "Новый диалог" : "Новый диалог";
  const modeLabel =
    mode === "auto" ? "Автоматический" : `Вручную: ${friendlyModelLabel(selectedModel, models.manual_models || [])}`;

  const quickActions = useMemo(() => ([
    {
      id: "ui",
      title: "UI-концепт",
      description: "Сценарии и экраны.",
      prompt: "Помоги продумать UI-концепт для продукта. Нужны: цель интерфейса, ключевые экраны, основные пользовательские сценарии, важные состояния, ошибки и идеи для сильного демо. Ответ сделай структурированным markdown, но оставь место для моих правок.",
      icon: "sparkles",
    },
    {
      id: "debug",
      title: "Найти баг",
      description: "Причина и фикс.",
      prompt: "Помоги найти баг в коде. Сначала сформулируй вероятную причину, затем дай короткий план проверки, потом предложи минимальный рабочий фикс и способ убедиться, что ошибка исчезла. Если данных мало, начни с одного уточняющего вопроса.",
      icon: "search",
    },
    {
      id: "plan",
      title: "План проекта",
      description: "Roadmap и приоритеты.",
      prompt: "Собери план проекта для хакатона. Нужны: идея, ключевые функции, приоритеты для MVP, риски, что успеть к демо, что показать жюри и какой порядок работ оптимален на ближайшие дни. Ответ сделай коротким, структурированным и пригодным для редактирования.",
      icon: "file",
    },
    {
      id: "artifact",
      title: "Структурированный ответ",
      description: "Аккуратный markdown.",
      prompt: "Подготовь ответ как аккуратный markdown-артефакт. Нужны: короткий итог, затем заголовки, списки, таблицы и блоки кода только там, где это действительно помогает. Сделай формат удобным для чтения, редактирования и показа жюри.",
      icon: "code",
    },
  ]), []);

  const activeResponseHistory = activeChatId ? responseHistories[activeChatId] || { items: [], selectedIndex: 0 } : { items: [], selectedIndex: 0 };


  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(APP_PREFS_STORAGE_KEY, JSON.stringify(appPrefs));
  }, [appPrefs]);

  useEffect(() => {
    setResponseHistories(loadResponseHistories(currentUser?.user_id));
  }, [currentUser?.user_id]);

  useEffect(() => {
    if (!currentUser?.user_id) return;
    persistResponseHistories(currentUser.user_id, responseHistories);
  }, [currentUser?.user_id, responseHistories]);


  useEffect(() => {
    window.localStorage.setItem("mts-web-mode", mode);
    window.localStorage.setItem("mts-web-model", selectedModel || "");
  }, [mode, selectedModel]);

  function dismissOnboarding() {
    setShowOnboarding(false);
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
  }

  function normalizeMessagesForUI(nextMessages = []) {
    return (nextMessages || []).filter((item) => {
      const messageKind = item?.metadata?.message_kind;
      const content = String(item?.content || "").trim();
      if (messageKind === "file_upload" || messageKind === "upload_notice") return false;
      if (/^загружен файл:/i.test(content)) return false;
      if (item?.role === "assistant" && /^indexed$/i.test(content)) return false;
      return true;
    });
  }

  function releaseAttachmentPreviews(items = []) {
    (items || []).forEach((item) => {
      const previewUrl = item?.metadata?.preview_url;
      if (previewUrl && String(previewUrl).startsWith("blob:")) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {
          // noop
        }
      }
    });
  }

  function applyQuickActionPrompt(prompt) {
    const nextValue = String(prompt || "").trim();
    setInputValue(nextValue);
    window.requestAnimationFrame(() => {
      const field = document.querySelector('[data-chat-composer="true"]');
      if (field) {
        field.focus();
        if (typeof field.setSelectionRange === "function") {
          const end = nextValue.length;
          field.setSelectionRange(end, end);
        }
      }
    });
  }

  function quickActionIcon(id) {
    if (id === "code") return <CodeIcon className="h-[18px] w-[18px]" />;
    if (id === "file") return <FileIcon className="h-[18px] w-[18px]" />;
    if (id === "search") return <SearchIcon className="h-[18px] w-[18px]" />;
    return <SparklesIcon className="h-[18px] w-[18px]" />;
  }

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) {
      return undefined;
    }

    function handleScroll() {
      const distance = area.scrollHeight - area.scrollTop - area.clientHeight;
      setShowScrollButton(distance > 180);
    }

    handleScroll();
    area.addEventListener("scroll", handleScroll);
    return () => area.removeEventListener("scroll", handleScroll);
  }, [messages, loading, typingText, hasMessages, panelState.open]);

  useEffect(() => {
    if (!scrollAreaRef.current) {
      return;
    }
    const area = scrollAreaRef.current;
    const distance = area.scrollHeight - area.scrollTop - area.clientHeight;
    if (distance < 180 || loading) {
      area.scrollTo({
        top: area.scrollHeight,
        behavior: hasMessages ? "smooth" : "auto",
      });
    }
  }, [messages, typingText, loading, hasMessages]);

  useEffect(() => {
    async function bootstrap() {
      try {
        const [health, modelsPayload, sessionPayload] = await Promise.all([
          apiFetch("/api/health"),
          apiFetch("/api/models"),
          apiFetch("/api/auth/session"),
        ]);

        setAppName(health.app_name || initialConfig.appName || "MWS GPT Hub");
        setApiKeyPresent(Boolean(health.api_key_present));
        setModels(modelsPayload || createDefaultModels());

        const availableIds = new Set((modelsPayload.manual_models || []).map((item) => item.id));
        if (mode === "manual" && selectedModel && !availableIds.has(selectedModel)) {
          setMode("auto");
          setSelectedModel("");
          window.localStorage.setItem("mts-web-mode", "auto");
          window.localStorage.setItem("mts-web-model", "");
        }

        if (sessionPayload?.authenticated && sessionPayload.user) {
          setCurrentUser(sessionPayload.user);
          await hydrateChats(sessionPayload.user);
        } else {
          resetChatState();
          setCurrentUser(null);
        }
      } catch (error) {
        handleClientError(error);
      } finally {
        setAuthReady(true);
      }
    }

    bootstrap();
  }, []);

  function pushToast(title, description = "", options = {}) {
    const toast = { id: options.toastKey || makeId(10), title, description, ...options };
    setToasts((prev) => {
      const duplicate = prev.find((item) => item.id === toast.id || (item.title === toast.title && item.description === toast.description));
      if (duplicate) {
        return prev.map((item) => (item.id === duplicate.id ? { ...duplicate, ...toast } : item));
      }
      const next = [...prev, toast];
      return next.slice(-3);
    });
    if (!options.persistent) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, options.duration || 2400);
    }
  }

  function dismissToast(toastId) {
    setToasts((prev) => prev.filter((item) => item.id !== toastId));
  }

  function syncResponseHistory(chatId, nextMessages) {
    if (!chatId) return;
    const variant = getLastAssistantVariant(nextMessages);
    if (!variant) return;
    setResponseHistories((prev) => ({
      ...prev,
      [chatId]: mergeResponseHistory(prev[chatId], variant),
    }));
  }

  function selectResponseVersion(chatId, selectedIndex) {
    setResponseHistories((prev) => ({
      ...prev,
      [chatId]: {
        ...(prev[chatId] || { items: [] }),
        selectedIndex,
      },
    }));
  }

  function resetChatState() {
    setChats([]);
    setActiveChatId(null);
    setMessages([]);
    setPendingAttachments([]);
    setInputValue("");
    setTypingText("");
    setLoading(false);
    setModelOpen(false);
    setStreamMessageId("");
    setMobileSidebarOpen(false);
    setPanelState({ open: false, kind: "code", title: "", language: "text", content: "" });
  }

  async function hydrateChats(user) {
    const chatsPayload = await apiFetch("/api/chats");
    const incomingChats = chatsPayload.chats || [];
    setChats(incomingChats);

    if (!incomingChats.length) {
      const created = await createChat();
      await openChat(created.chat_id, user);
      return;
    }

    const remembered = getRememberedChatId(user.user_id);
    const initialChatId = incomingChats.find((item) => item.chat_id === remembered)?.chat_id || incomingChats[0].chat_id;
    await openChat(initialChatId, user);
  }

  async function createChat() {
    const payload = await apiFetch("/api/chats", {
      method: "POST",
      body: JSON.stringify({}),
    });
    setChats((prev) => [payload.chat, ...prev.filter((item) => item.chat_id !== payload.chat.chat_id)]);
    return payload.chat;
  }

  async function openChat(chatId, userOverride = currentUser) {
    setActiveChatId(chatId);
    setModelOpen(false);
    if (userOverride?.user_id) {
      rememberChatId(userOverride.user_id, chatId);
    }
    const payload = await apiFetch(`/api/chats/${encodeURIComponent(chatId)}/messages`);
    const nextMessages = normalizeMessagesForUI(payload.messages || []);
    setMessages(nextMessages);
    syncResponseHistory(chatId, nextMessages);
    syncChat(payload.chat, userOverride, { moveToTop: false });
    setMobileSidebarOpen(false);
  }

  function syncChat(chat, userOverride = currentUser, options = {}) {
    if (!chat) {
      return;
    }
    const moveToTop = Boolean(options.moveToTop);
    setChats((prev) => {
      const existingIndex = prev.findIndex((item) => item.chat_id === chat.chat_id);
      if (existingIndex === -1 || moveToTop) {
        return [chat, ...prev.filter((item) => item.chat_id !== chat.chat_id)];
      }
      const next = [...prev];
      next[existingIndex] = chat;
      return next;
    });
    setActiveChatId(chat.chat_id);
    if (userOverride?.user_id) {
      rememberChatId(userOverride.user_id, chat.chat_id);
    }
  }

  async function updateChat(chatId, patch) {
    const payload = await apiFetch(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    syncChat(payload.chat, currentUser, { moveToTop: false });
    return payload.chat;
  }

  async function handleRenameChat(chatId, title) {
    await updateChat(chatId, { title });
    pushToast("Название обновлено", "Чат переименован.");
  }

  async function handleTogglePinChat(chatId, pinned) {
    await updateChat(chatId, { pinned });
    pushToast(pinned ? "Чат закреплён" : "Чат откреплён");
  }

  function requestDeleteChat(chatId) {
    const chat = chats.find((item) => item.chat_id === chatId);
    setConfirmState({ open: true, chatId, title: chat?.title || "Новый чат" });
  }

  async function handleDeleteChatConfirmed() {
    const chatId = confirmState.chatId;
    if (!chatId) {
      return;
    }
    setConfirmState({ open: false, chatId: null, title: "" });

    await apiFetch(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: "DELETE",
      body: JSON.stringify({}),
    });

    const remaining = chats.filter((chat) => chat.chat_id !== chatId);
    setChats(remaining);
    setResponseHistories((prev) => { const next = { ...prev }; delete next[chatId]; return next; });
    pushToast("Чат удалён", "История диалога удалена.");

    if (chatId !== activeChatId) {
      return;
    }

    if (remaining.length) {
      await openChat(remaining[0].chat_id);
      return;
    }

    const created = await createChat();
    setMessages([]);
    setPendingAttachments([]);
    setInputValue("");
    await openChat(created.chat_id);
  }

  async function fetchChatBundle(chatId) {
    if (chatId === activeChatId && activeChat) {
      return { chat: activeChat, messages };
    }
    const payload = await apiFetch(`/api/chats/${encodeURIComponent(chatId)}/messages`);
    return { chat: payload.chat, messages: payload.messages || [] };
  }

  async function handleShareChat(chatId) {
    const bundle = await fetchChatBundle(chatId);
    const text = buildChatShareText(bundle.chat, bundle.messages);
    if (navigator.share) {
      try {
        await navigator.share({ title: bundle.chat.title || "Чат", text });
        pushToast("Поделиться", "Чат передан через системное меню.");
        return;
      } catch {
        // fallback below
      }
    }
    await copyText(text);
    pushToast("Скопировано", "Содержимое чата скопировано для шеринга.");
  }

  async function handleExportChat(chatId) {
    const bundle = await fetchChatBundle(chatId);
    const markdown = exportChatMarkdown(bundle.chat, bundle.messages);
    downloadTextFile(`${slugifyFilename(bundle.chat.title || "chat")}.md`, markdown);
    pushToast("Экспорт готов", "Markdown-файл скачан.");
  }

  async function handleNewChat() {
    const active = chats.find((chat) => chat.chat_id === activeChatId);
    if (active && isChatEmpty(active) && messages.length === 0) {
      setPendingAttachments([]);
      setInputValue("");
      await openChat(active.chat_id);
      return;
    }

    const reusableEmptyChat = chats.find((chat) => chat.chat_id !== activeChatId && isChatEmpty(chat));
    if (reusableEmptyChat) {
      setPendingAttachments([]);
      setInputValue("");
      await openChat(reusableEmptyChat.chat_id);
      pushToast("Открыт существующий пустой чат", "Чтобы не плодить пустые диалоги, используется уже созданный чат.");
      return;
    }

    const chat = await createChat();
    setMessages([]);
    setPendingAttachments([]);
    setInputValue("");
    await openChat(chat.chat_id);
  }

  async function handleSendMessage(overrideText = "") {
    if (!currentUser || loading || sendLockRef.current) {
      return;
    }

    const text = String(overrideText || inputValue).trim();
    const outgoingAttachments = [...pendingAttachments];
    if (!text && !outgoingAttachments.length) {
      return;
    }

    sendLockRef.current = true;
    setLoading(true);
    const imageFlow = isImageMode(mode, selectedModel, models) || /(сгенерируй|создай|нарисуй|изображени|картин)/i.test(text);
    setLoadingKind(imageFlow ? "image" : "text");
    setTypingText(inferTypingText(text, outgoingAttachments, { image: imageFlow }));

    let chatId = activeChatId;
    let optimisticUserMessage = null;

    try {
      if (!chatId) {
        const created = await createChat();
        chatId = created.chat_id;
        setActiveChatId(chatId);
      }

      optimisticUserMessage = {
        message_id: `temp-user-${makeId(8)}`,
        chat_id: chatId,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
        attachments: outgoingAttachments,
        tool_outputs: [],
        sources: [],
        metadata: { message_kind: "chat" },
      };

      setInputValue("");
      setPendingAttachments([]);
      setMessages((prev) => [...prev, optimisticUserMessage]);

      const payload = await apiFetch(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
        method: "POST",
        body: JSON.stringify({
          message: text,
          attachments: outgoingAttachments,
          mode,
          selected_model: mode === "manual" ? selectedModel : null,
        }),
      });

      const nextMessages = normalizeMessagesForUI(payload.messages || []);
      const lastAssistant = [...nextMessages].reverse().find((item) => item.role === "assistant");
      setMessages(nextMessages);
      setStreamMessageId(lastAssistant?.message_id || "");
      syncResponseHistory(chatId, nextMessages);
      syncChat(payload.chat, currentUser, { moveToTop: true });
    } catch (error) {
      setInputValue(text);
      setPendingAttachments(outgoingAttachments);
      if (optimisticUserMessage) {
        setMessages((prev) => prev.filter((item) => item.message_id !== optimisticUserMessage.message_id));
      }
      throw error;
    } finally {
      setLoading(false);
      setLoadingKind("text");
      setTypingText("");
      sendLockRef.current = false;
    }
  }

  async function handleDeleteMessage(message) {
    if (!activeChatId || !message?.message_id) {
      return;
    }
    const payload = await apiFetch(`/api/chats/${encodeURIComponent(activeChatId)}/messages/${encodeURIComponent(message.message_id)}`, {
      method: "DELETE",
    });
    const nextMessages = normalizeMessagesForUI(payload.messages || []);
    setMessages(nextMessages);
    syncResponseHistory(activeChatId, nextMessages);
    syncChat(payload.chat, currentUser, { moveToTop: false });
    pushToast("Сообщение удалено", "Пользовательский ход удалён из чата.");
  }

  async function handleRegenerate() {
    if (!activeChatId || loading) {
      return;
    }
    const previousVariant = getLastAssistantVariant(messages);
    if (previousVariant) {
      setResponseHistories((prev) => ({
        ...prev,
        [activeChatId]: mergeResponseHistory(prev[activeChatId], previousVariant),
      }));
    }
    setLoading(true);
    setLoadingKind("text");
    setTypingText("Думаю над новой версией");
    try {
      const payload = await apiFetch(`/api/chats/${encodeURIComponent(activeChatId)}/regenerate`, {
        method: "POST",
        body: JSON.stringify({
          mode,
          selected_model: mode === "manual" ? selectedModel : null,
        }),
      });
      const nextMessages = normalizeMessagesForUI(payload.messages || []);
      const lastAssistant = [...nextMessages].reverse().find((item) => item.role === "assistant");
      setMessages(nextMessages);
      setStreamMessageId(lastAssistant?.message_id || "");
      syncResponseHistory(activeChatId, nextMessages);
      syncChat(payload.chat, currentUser, { moveToTop: true });
      pushToast("Ответ обновлён", "Последний ответ сформирован заново. История версий сохранена.");
    } finally {
      setLoading(false);
      setLoadingKind("text");
      setTypingText("");
    }
  }

  function handleEditLastUserMessage(message) {
    setInputValue(message.content || "");
    pushToast("Текст возвращён в поле ввода", "Отредактируйте сообщение и отправьте его ещё раз.");
  }

  async function handleFileUpload(files) {
    if (!currentUser) {
      return;
    }

    let chatId = activeChatId;
    if (!chatId) {
      const created = await createChat();
      chatId = created.chat_id;
      setActiveChatId(chatId);
    }

    for (const file of files) {
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
      const tempAttachment = {
        local_id: makeId(6),
        type: file.type.startsWith("image/") ? "image" : "file",
        mime_type: file.type || undefined,
        metadata: {
          file_name: file.name,
          ingestion_status: "uploading",
          file_size: file.size,
          preview_url: previewUrl,
        },
      };

      setPendingAttachments((prev) => [...prev, tempAttachment]);

      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("file", file);

      try {
        const response = await fetch("/api/uploads", { method: "POST", body: formData, credentials: "same-origin" });
        const payload = await response.json();
        if (!response.ok) {
          const error = new Error(payload.error || `Не удалось загрузить файл ${file.name}`);
          error.status = response.status;
          throw error;
        }

        const nextAttachment = {
          ...payload.attachment,
          metadata: {
            ...(payload.attachment?.metadata || {}),
            preview_url: previewUrl || payload.attachment?.metadata?.preview_url || "",
          },
        };
        setPendingAttachments((prev) => prev.map((item) => (item.local_id === tempAttachment.local_id ? nextAttachment : item)));
        syncChat(payload.chat, currentUser, { moveToTop: false });
      } catch (error) {
        releaseAttachmentPreviews([tempAttachment]);
        setPendingAttachments((prev) => prev.filter((item) => item.local_id !== tempAttachment.local_id));
        handleClientError(error);
      }
    }
  }

  function removePendingAttachment(localIdOrFileId) {
    setPendingAttachments((prev) => {
      const removed = prev.filter((item) => item.local_id === localIdOrFileId || item.file_id === localIdOrFileId);
      releaseAttachmentPreviews(removed);
      return prev.filter((item) => item.local_id !== localIdOrFileId && item.file_id !== localIdOrFileId);
    });
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      Promise.resolve(handleSendMessage()).catch(handleClientError);
    }
  }

  async function toggleVoiceRecording() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (Recognition) {
      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
        return;
      }

      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = "ru-RU";
      recognition.interimResults = true;
      recognition.continuous = false;

      let finalTranscript = "";
      recordingStartRef.current = Date.now();
      setIsRecording(true);

      recognition.onresult = (event) => {
        finalTranscript = Array.from(event.results)
          .map((result) => result[0]?.transcript || "")
          .join(" ")
          .trim();
        setInputValue(finalTranscript);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        const transcript = finalTranscript.trim();
        if (!transcript) {
          return;
        }
        setPendingAttachments((prev) => [
          ...prev.filter((item) => item.type !== "voice_note"),
          {
            type: "voice_note",
            metadata: {
              transcript,
              duration_ms: Date.now() - recordingStartRef.current,
            },
          },
        ]);
      };

      recognition.start();
      return;
    }

    if (!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)) {
      pushToast("Голосовой ввод недоступен", "В этом браузере нет SpeechRecognition и MediaRecorder.");
      return;
    }

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      return;
    }

    recordingStartRef.current = Date.now();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    mediaChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    setIsRecording(true);

    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        mediaChunksRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      setIsRecording(false);
      stream.getTracks().forEach((track) => track.stop());
      pushToast("Не удалось записать голос", "Попробуйте ещё раз или используйте другой браузер.");
    };

    recorder.onstop = async () => {
      setIsRecording(false);
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(mediaChunksRef.current, { type: mimeType || "audio/webm" });
      mediaChunksRef.current = [];
      if (!blob.size) {
        return;
      }

      const formData = new FormData();
      formData.append("file", new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type || "audio/webm" }));
      try {
        pushToast("Обрабатываю голос", "Секунду, распознаю запись…", { persistent: true, toastKey: "voice-transcribe" });
        const response = await fetch("/api/transcribe-audio", { method: "POST", body: formData, credentials: "same-origin" });
        const payload = await response.json();
        dismissToast("voice-transcribe");
        if (!response.ok) {
          const error = new Error(payload.error || "Не удалось распознать голос");
          error.status = response.status;
          throw error;
        }
        const transcript = String(payload.transcript || "").trim();
        if (!transcript) {
          pushToast("Речь не распознана", "Попробуйте записать голос чуть громче или короче.");
          return;
        }
        setInputValue((prev) => [prev.trim(), transcript].filter(Boolean).join(prev.trim() ? "\n" : ""));
        pushToast("Голос распознан", "Текст добавлен в поле ввода.");
      } catch (error) {
        dismissToast("voice-transcribe");
        handleClientError(error);
      }
    };

    recorder.start();
  }

  async function handleLogin(credentials) {
    setAuthSubmitting(true);
    try {
      const payload = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      setCurrentUser(payload.user || null);
      resetChatState();
      await hydrateChats(payload.user);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleRegister(credentials) {
    setAuthSubmitting(true);
    try {
      const payload = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      setCurrentUser(payload.user || null);
      resetChatState();
      await hydrateChats(payload.user);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    const currentUserId = currentUser?.user_id;
    await apiFetch("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    if (currentUserId) {
      clearRememberedChatId(currentUserId);
    }
    resetChatState();
    setCurrentUser(null);
    setSettingsOpen(false);
  }

  function handleClientError(error) {
    console.error(error);
    if (error?.status === 401) {
      const currentUserId = currentUser?.user_id;
      if (currentUserId) {
        clearRememberedChatId(currentUserId);
      }
      resetChatState();
      setCurrentUser(null);
      setAuthReady(true);
      pushToast("Сессия завершилась", "Войдите снова, чтобы продолжить.");
      return;
    }
    setLoading(false);
    setLoadingKind("text");
    setTypingText("");
    pushToast("Произошла ошибка", error.message || "Не удалось выполнить действие.");
  }

  const composerProps = {
    value: inputValue,
    onChange: setInputValue,
    onSend: () => Promise.resolve(handleSendMessage()).catch(handleClientError),
    onKeyDown: handleComposerKeyDown,
    onAttach: () => fileInputRef.current?.click(),
    attachments: pendingAttachments,
    onRemoveAttachment: removePendingAttachment,
    appName,
    models,
    mode,
    selectedModel,
    modelOpen,
    onToggleModel: () => setModelOpen((prev) => !prev),
    onSelectModel: ({ mode: nextMode, selectedModel: nextSelectedModel }) => {
      setMode(nextMode);
      setSelectedModel(nextSelectedModel);
      setModelOpen(false);
    },
    onCloseModel: () => setModelOpen(false),
    onToggleVoice: () => toggleVoiceRecording().catch(handleClientError),
    isRecording,
    loading,
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 text-[var(--text-primary)]">
        <div className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-5 py-3 text-sm text-[var(--text-secondary)] shadow-[0_18px_40px_-34px_var(--shadow-color)]">
          Загружаю рабочее пространство…
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen appName={appName} onLogin={handleLogin} onRegister={handleRegister} loading={authSubmitting} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--page-bg)] text-[var(--text-primary)] transition-colors duration-300">
      <Sidebar
        groups={groupedChats}
        activeChatId={activeChatId}
        user={currentUser}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
        onNewChat={() => handleNewChat().catch(handleClientError)}
        onOpenSettings={() => setSettingsOpen(true)}
        onSelectChat={(chatId) => openChat(chatId).catch(handleClientError)}
        onRenameChat={(chatId, title) => handleRenameChat(chatId, title).catch(handleClientError)}
        onTogglePinChat={(chatId, pinned) => handleTogglePinChat(chatId, pinned).catch(handleClientError)}
        onDeleteChat={(chatId) => requestDeleteChat(chatId)}
        onShareChat={(chatId) => handleShareChat(chatId).catch(handleClientError)}
        onExportChat={(chatId) => handleExportChat(chatId).catch(handleClientError)}
        onLogout={() => handleLogout().catch(handleClientError)}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-0 opacity-90">
          <div className="absolute left-[10%] top-[9%] h-[280px] w-[280px] rounded-full bg-[var(--bg-orb-1)] blur-3xl" />
          <div className="absolute bottom-[8%] right-[8%] h-[240px] w-[240px] rounded-full bg-[var(--bg-orb-2)] blur-3xl" />
        </div>

        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="px-4 pb-3 pt-5 sm:px-6 lg:px-8 lg:pt-7">
            <div className="mx-auto grid w-full grid-cols-[48px,1fr,48px] items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-primary)] transition duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] lg:hidden"
                aria-label="Открыть меню"
              >
                <MenuIcon className="h-[18px] w-[18px]" />
              </button>
              <div className="hidden lg:block" />
              <TopBarStatus title={activeChatTitle} loading={loading} />
              <div className="h-11 w-11" />
            </div>
          </header>

          {hasMessages ? (
            <>
              <div ref={scrollAreaRef} className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-2 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-[1160px] pb-8 pt-2">
                  <MessageList
                    messages={messages}
                    loading={loading}
                    loadingKind={loadingKind}
                    typingText={typingText}
                    appName={appName}
                    onCopyMessage={async (message) => {
                      await copyText(message.content || "");
                      pushToast("Скопировано", "Сообщение добавлено в буфер обмена.");
                    }}
                    onDeleteMessage={(message) => handleDeleteMessage(message).catch(handleClientError)}
                    onEditMessage={handleEditLastUserMessage}
                    onRegenerate={() => handleRegenerate().catch(handleClientError)}
                    onOpenPanel={appPrefs.autoArtifacts ? ((panel) => setPanelState({ open: true, ...panel })) : undefined}
                    onCopyCode={() => pushToast("Скопировано", "Код добавлен в буфер обмена.")}
                    responseHistory={activeResponseHistory}
                    streamMessageId={streamMessageId}
                    streamResponses={appPrefs.streamResponses}
                    scrollContainerRef={scrollAreaRef}
                    onSelectResponseVersion={(index) => selectResponseVersion(activeChatId, index)}
                  />
                </div>
              </div>
              {showScrollButton ? (
                <button
                  type="button"
                  onClick={() => scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: "smooth" })}
                  className="absolute bottom-[108px] z-20 hidden h-11 w-11 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_18px_40px_-30px_var(--shadow-color)] transition-[right,border-color,background-color,transform] duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] sm:inline-flex"
                  style={{ right: panelState.open ? `${panelWidth + 24}px` : "24px" }}
                  aria-label="Прокрутить вниз"
                >
                  <ArrowDownIcon className="h-4 w-4" />
                </button>
              ) : null}
              <div className="px-4 pb-5 pt-2 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-[1160px]">
                  <ChatComposer {...composerProps} variant="dock" />
                </div>
              </div>
            </>
          ) : (
            <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
              <div className="mx-auto flex min-h-full w-full max-w-[1160px] items-center justify-center py-10 sm:py-12 lg:py-16">
                <div className="w-full max-w-[880px]">
                  <div className="mx-auto max-w-[760px] text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">MWS GPT</div>
                    <h1 className="mt-8 text-balance text-[clamp(3rem,5vw,5rem)] font-semibold leading-[0.94] tracking-[-0.07em] text-[var(--text-primary)]">
                      Чем могу помочь <span className="text-[var(--accent)]">сегодня</span>?
                    </h1>
                    <p className="mx-auto mt-5 max-w-[620px] text-[15px] leading-7 text-[var(--text-secondary)] sm:text-base">
                      Ваши диалоги привязаны к аккаунту <span className="font-medium text-[var(--text-primary)]">{currentUser.nickname}</span> и будут доступны после повторного входа.
                    </p>
                  </div>

                  {showOnboarding ? (
                    <div className="mx-auto mt-8 max-w-[760px] rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-5 py-5 text-left shadow-[0_18px_42px_-34px_var(--shadow-color)] animate-[messageIn_.24s_ease-out]">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Быстрый старт</div>
                          <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">Спросите, загрузите файл или начните с готового сценария</div>
                          <div className="mt-2 max-w-[600px] text-sm leading-7 text-[var(--text-secondary)]">Чат умеет работать с контекстом переписки, искать по истории и открывать длинный код или артефакты в отдельной панели справа.</div>
                        </div>
                        <button type="button" onClick={dismissOnboarding} className="inline-flex rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]">Понятно</button>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-primary)]">1.</span> Выберите готовый сценарий ниже или напишите свой запрос.</div>
                        <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-primary)]">2.</span> Для длинного кода используйте правую панель — так чат остаётся читаемым.</div>
                        <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-primary)]">3.</span> История закреплена за аккаунтом и доступна после повторного входа.</div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:mt-10">
                    {quickActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => applyQuickActionPrompt(action.prompt)}
                        className="group inline-flex max-w-[188px] items-start gap-2.5 rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-elevated)]/92 px-3 py-2.5 text-left shadow-[0_12px_28px_-26px_var(--shadow-color)] transition duration-300 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                      >
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--accent)] transition duration-300 group-hover:border-[var(--border-strong)]">{quickActionIcon(action.icon)}</span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{action.title}</span>
                          <span className="mt-1 block text-[11px] leading-5 text-[var(--text-secondary)]">{action.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-8 sm:mt-10">
                    <ChatComposer {...composerProps} variant="hero" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <CodeDrawer
          open={panelState.open}
          kind={panelState.kind}
          title={panelState.title}
          language={panelState.language}
          code={panelState.content}
          copied={drawerCopied}
          width={panelWidth}
          onWidthChange={setPanelWidth}
          onClose={() => setPanelState({ open: false, kind: "code", title: "", language: "text", content: "" })}
          onCopy={() => {
            setDrawerCopied(true);
            pushToast("Скопировано", panelState.kind === "code" ? "Код добавлен в буфер обмена." : "Текст добавлен в буфер обмена.");
            window.setTimeout(() => setDrawerCopied(false), 1200);
          }}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          if (files.length) {
            handleFileUpload(files).catch(handleClientError);
          }
          event.target.value = "";
        }}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        modeLabel={modeLabel}
        user={currentUser}
        apiKeyStatus={apiKeyPresent ? "подключён" : "не задан"}
        theme={theme}
        onThemeChange={setTheme}
        preferences={appPrefs}
        onTogglePreference={(key) => setAppPrefs((prev) => ({ ...prev, [key]: !prev[key] }))}
        onResetOnboarding={() => {
          window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
          setShowOnboarding(true);
          pushToast("Онбординг снова доступен", "Стартовые подсказки снова появятся в новом чате.");
        }}
      />

      <ConfirmDialog
        open={confirmState.open}
        title="Удалить чат?"
        description={`Диалог «${confirmState.title || "Новый чат"}» исчезнет из боковой панели и истории аккаунта.`}
        confirmLabel="Удалить"
        danger
        onCancel={() => setConfirmState({ open: false, chatId: null, title: "" })}
        onConfirm={() => handleDeleteChatConfirmed().catch(handleClientError)}
      />

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
