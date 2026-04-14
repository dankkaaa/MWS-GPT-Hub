import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildRevealChunks,
  formatDuration,
  friendlySourceLabel,
  getModelVisualKind,
  isImageResult,
} from "../lib/chat-utils";
import {
  ChevronRightIcon,
  CodeIcon,
  CopyIcon,
  DotsLoaderIcon,
  EditIcon,
  FileIcon,
  GlobeIcon,
  ImageIcon,
  LinkIcon,
  MessageSquareIcon,
  MicrophoneIcon,
  RefreshIcon,
  SearchIcon,
  SparklesIcon,
  TrashIcon,
} from "./icons";
import { MessageRenderer } from "./MessageRenderer";

function MetaChip({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1 text-[11px] font-semibold tracking-[0.01em] text-[var(--text-secondary)]">
      {children}
    </span>
  );
}

function resolveAttachmentPreview(attachment) {
  return attachment?.metadata?.preview_url || attachment?.metadata?.public_url || attachment?.url || "";
}

function getScrollableParent(element) {
  if (!element) return null;

  let parent = element.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const canScroll =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      parent.scrollHeight > parent.clientHeight + 8;

    if (canScroll) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return document.scrollingElement || document.documentElement;
}

function isNearBottom(container, threshold = 120) {
  if (!container) return true;
  const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distance <= threshold;
}

function AttachmentRow({ attachments }) {
  return (
    <div className="flex flex-wrap gap-3">
      {attachments.map((attachment, index) => {
        if (attachment.type === "image") {
          const fileName = attachment.metadata?.file_name || attachment.file_id || "Изображение";
          const status = attachment.metadata?.ingestion_status || attachment.metadata?.status || "готово";
          const preview = resolveAttachmentPreview(attachment);
          return (
            <div
              key={`${fileName}-${index}`}
              className="overflow-hidden rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-soft)] shadow-[0_18px_48px_-38px_var(--shadow-color)]"
            >
              {preview ? (
                <img src={preview} alt={fileName} className="block h-[138px] w-[184px] object-cover" />
              ) : (
                <div className="flex h-[138px] w-[184px] items-center justify-center bg-[linear-gradient(180deg,rgba(62,178,255,0.08),transparent)] text-[var(--accent)]">
                  <ImageIcon className="h-7 w-7" />
                </div>
              )}
              <div className="px-4 py-3">
                <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{fileName}</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">{status}</div>
              </div>
            </div>
          );
        }

        if (attachment.type === "file") {
          const fileName = attachment.metadata?.file_name || attachment.file_id || "Файл";
          const status = attachment.metadata?.ingestion_status || attachment.metadata?.status || "готово";
          return (
            <div
              key={`${fileName}-${index}`}
              className="min-w-[220px] max-w-[320px] rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 shadow-[0_18px_48px_-38px_var(--shadow-color)]"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <FileIcon className="h-4 w-4 text-[var(--accent)]" />
                <span className="truncate">{fileName}</span>
              </div>
              <div className="mt-2 text-xs text-[var(--text-secondary)]">{status}</div>
            </div>
          );
        }

        if (attachment.type === "voice_note") {
          const duration = Number(attachment.metadata?.duration_ms || 0);
          const transcript = attachment.metadata?.transcript || "Распознано как текст";
          return (
            <div
              key={`voice-${index}`}
              className="min-w-[240px] max-w-[360px] rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 shadow-[0_18px_48px_-38px_var(--shadow-color)]"
            >
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {duration ? formatDuration(duration) : "Голосовой запрос"}
              </div>
              <div className="mt-2 h-2 rounded-full bg-[linear-gradient(90deg,var(--accent),rgba(59,148,255,0.35),rgba(59,148,255,0.08))]" />
              <div className="mt-2 text-xs text-[var(--text-secondary)]">{transcript}</div>
            </div>
          );
        }

        if (attachment.type === "url") {
          const url = attachment.url || attachment.metadata?.url || "";
          return (
            <a
              key={`${url}-${index}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="min-w-[220px] max-w-[320px] rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--text-secondary)] shadow-[0_18px_48px_-38px_var(--shadow-color)] transition duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                <LinkIcon className="h-4 w-4 text-[var(--accent)]" />
                <span className="truncate">{friendlySourceLabel(url)}</span>
              </div>
              <div className="mt-2 truncate text-xs">{url}</div>
            </a>
          );
        }

        return null;
      })}
    </div>
  );
}

function SourceRow({ sources }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {sources.map((source, index) => {
        const url = source.url || source;
        const label = source.title || friendlySourceLabel(url);
        return (
          <a
            key={`${url}-${index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <GlobeIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </a>
        );
      })}
    </div>
  );
}

function ToolRow({ tools }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {tools.map((tool, index) => (
        <span
          key={`${tool.name || "tool"}-${index}`}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          {tool.metadata?.title || tool.name || "Инструмент"}
        </span>
      ))}
    </div>
  );
}

function MessageActions({ items, visible = true }) {
  return (
    <div
      className={[
        "flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-1.5 py-1 shadow-[0_14px_32px_-28px_var(--shadow-color)] transition duration-200",
        visible ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100",
      ].join(" ")}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] transition duration-200 hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
          aria-label={item.label}
          title={item.label}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}

function ResponseAnalysis({ message, displayContent }) {
  const [open, setOpen] = useState(false);
  const lineCount = String(displayContent || "").split("\n").length;
  const hasCode = /```/.test(displayContent || "");
  const hasTable = /\|/.test(displayContent || "") && /\n\s*\|?\s*[:-]/.test(displayContent || "");
  const hasList = /^\s*([-*]|\d+\.)\s+/m.test(displayContent || "");

  const insightItems = [
    message.model_used ? `Модель: ${message.model_used}` : null,
    message.tool_outputs?.length ? `Инструменты: ${message.tool_outputs.length}` : "Ответ сформирован без внешних инструментов",
    message.sources?.length ? `Источники: ${message.sources.length}` : null,
    hasCode ? "Есть кодовые блоки — ответ можно открыть как артефакт справа" : null,
    hasTable ? "Есть таблицы — структура уже оформлена для быстрого чтения" : null,
    hasList ? "Ответ содержит пошаговую структуру и списки" : null,
    lineCount > 18 ? `Объём: ${lineCount} строк` : "Краткий ответ без перегруза",
  ].filter(Boolean);

  return (
    <div className="mt-4 max-w-[760px]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      >
        <SparklesIcon className="h-3.5 w-3.5" />
        Разбор ответа
        <ChevronRightIcon className={`h-3.5 w-3.5 transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? (
        <div className="mt-3 animate-[messageIn_.22s_ease-out] rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 py-4 shadow-[0_18px_42px_-34px_var(--shadow-color)]">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            Почему ответ выглядит так
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {insightItems.map((item) => (
              <div
                key={item}
                className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm leading-6 text-[var(--text-secondary)]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ImageLoadingBubble() {
  return (
    <div className="flex justify-start pl-[52px]">
      <div className="w-full max-w-[720px] rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-5 py-5 shadow-[0_18px_42px_-34px_var(--shadow-color)]">
        <div className="flex items-center gap-4">
          <div className="relative h-11 w-11 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="absolute inset-[5px] rounded-full border-[2.5px] border-[rgba(62,178,255,0.16)]" />
            <div className="absolute inset-[5px] animate-spin rounded-full border-[2.5px] border-transparent border-r-[var(--accent)] border-t-[var(--accent)]" />
            <div className="absolute inset-[13px] rounded-full bg-[var(--surface-elevated)]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">Создаю изображение</div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">
              Подбираю композицию, свет и детали кадра…
            </div>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(62,178,255,0.06),transparent)] p-4">
          <div className="h-[220px] animate-pulse rounded-[20px] bg-[radial-gradient(circle_at_24%_22%,rgba(62,178,255,0.18),transparent_34%),radial-gradient(circle_at_72%_64%,rgba(62,178,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent)]" />
        </div>
      </div>
    </div>
  );
}

function useStreamedContent(content, enabled, onChunk) {
  const [visible, setVisible] = useState(enabled ? "" : (content || ""));

  useEffect(() => {
    if (!enabled) {
      const finalValue = content || "";
      setVisible(finalValue);
      onChunk?.(finalValue);
      return undefined;
    }

    const chunks = buildRevealChunks(content || "");
    if (!chunks.length) {
      const finalValue = content || "";
      setVisible(finalValue);
      onChunk?.(finalValue);
      return undefined;
    }

    let cancelled = false;
    let index = 0;

    setVisible("");
    onChunk?.("");

    function step() {
      if (cancelled) return;

      const chunk = chunks[index] || "";
      const increment =
        chunk === "\n"
          ? 1
          : Math.max(1, Math.min(3, Math.ceil(chunk.length / 18)));

      index = Math.min(chunks.length, index + increment);

      const nextValue = chunks.slice(0, index).join("");
      setVisible(nextValue);
      onChunk?.(nextValue);

      if (index >= chunks.length) return;

      const currentChunk = chunks[Math.max(0, index - 1)] || chunk;
      const delay =
        currentChunk === "\n"
          ? 36
          : /[.!?]\s*$/.test(currentChunk)
            ? 50
            : 24;

      window.setTimeout(step, delay);
    }

    const startTimer = window.setTimeout(step, 70);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
    };
  }, [content, enabled, onChunk]);

  return visible;
}

function resolveImageSource(message, content) {
  const value = String(content || "").trim();
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (
    message?.task_type === "image_generation" &&
    /^[A-Za-z0-9+/=\s]+$/.test(value) &&
    value.replace(/\s+/g, "").length > 128
  ) {
    return `data:image/png;base64,${value.replace(/\s+/g, "")}`;
  }
  return "";
}

function MessageBubble({
  message,
  appName,
  isLastUser,
  isLastAssistant,
  onCopyMessage,
  onDeleteMessage,
  onEditMessage,
  onRegenerate,
  onOpenPanel,
  onCopyCode,
  streamMessageId,
  streamResponses = true,
  onStreamChunk,
}) {
  const displayContent = message.content;
  const shouldStream = Boolean(
    streamResponses &&
      streamMessageId &&
      isLastAssistant &&
      message.message_id === streamMessageId &&
      !isImageResult({ ...message, content: displayContent })
  );

  const streamedContent = useStreamedContent(
    displayContent,
    shouldStream,
    shouldStream ? onStreamChunk : undefined
  );

  const renderContent = shouldStream ? streamedContent : displayContent;
  const imageSrc = resolveImageSource(message, renderContent || displayContent);
  const imageError =
    message.task_type === "image_generation" &&
    !imageSrc &&
    /изображени|картин/i.test(displayContent || "");

  const actionItems =
    message.role === "user"
      ? [
          { label: "Копировать", onClick: () => onCopyMessage(message), icon: <CopyIcon className="h-4 w-4" /> },
          ...(isLastUser
            ? [{ label: "Изменить", onClick: () => onEditMessage(message), icon: <EditIcon className="h-4 w-4" /> }]
            : []),
          { label: "Удалить", onClick: () => onDeleteMessage(message), icon: <TrashIcon className="h-4 w-4" /> },
        ]
      : [
          {
            label: "Копировать",
            onClick: () => onCopyMessage({ ...message, content: displayContent }),
            icon: <CopyIcon className="h-4 w-4" />,
          },
          ...(isLastAssistant
            ? [{ label: "Повторить", onClick: onRegenerate, icon: <RefreshIcon className="h-4 w-4" /> }]
            : []),
        ];

  if (message.role === "user") {
    return (
      <article className="group flex justify-end">
        <div className="w-full max-w-[900px] animate-[messageIn_.24s_ease-out]">
          <div className="mb-3 flex justify-end gap-3 text-sm text-[var(--text-secondary)]">
            <MessageActions items={actionItems} visible={false} />
          </div>
          <div className="rounded-[28px] border border-[var(--user-border)] bg-[var(--user-bg)] px-5 py-4 text-[var(--text-primary)] shadow-[0_18px_42px_-34px_var(--shadow-color)]">
            {message.attachments?.length ? (
              <div className="mb-4">
                <AttachmentRow attachments={message.attachments} />
              </div>
            ) : null}
            {message.content?.trim() ? (
              <div className="whitespace-pre-wrap text-[15px] leading-8 text-current">{message.content}</div>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex justify-start">
      <div className="w-full max-w-[900px] animate-[messageIn_.24s_ease-out]">
        <div className="mb-3 flex items-start justify-between gap-4 text-sm text-[var(--text-secondary)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--accent)]">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[var(--text-primary)]">{appName}</span>
              {message.model_used ? <MetaChip>{message.model_used}</MetaChip> : null}
            </div>
          </div>
          <MessageActions items={actionItems} visible={false} />
        </div>

        <div className="pl-[52px]">
          {message.attachments?.length ? (
            <div className="mb-4">
              <AttachmentRow attachments={message.attachments} />
            </div>
          ) : null}

          {message.tool_outputs?.length ? (
            <div className="mb-4">
              <ToolRow tools={message.tool_outputs} />
            </div>
          ) : null}

          {renderContent?.trim() ? (
            imageSrc ? (
              <div className="max-w-[760px] overflow-hidden rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] shadow-[0_18px_42px_-34px_var(--shadow-color)]">
                <img src={imageSrc} alt="Сгенерированное изображение" className="block h-auto w-full transition duration-300" />
              </div>
            ) : imageError ? (
              <div className="max-w-[760px] rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-5 py-4 shadow-[0_18px_42px_-34px_var(--shadow-color)]">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Не удалось получить изображение</div>
                <div className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{displayContent}</div>
              </div>
            ) : (
              <div className="max-w-[760px]">
                <MessageRenderer content={renderContent} onOpenPanel={onOpenPanel} onCopyCode={onCopyCode} />
              </div>
            )
          ) : null}

          {!imageSrc && !imageError && message.task_type !== "image_generation" ? (
            <ResponseAnalysis message={message} displayContent={displayContent} />
          ) : null}

          {message.sources?.length ? (
            <div className="mt-5">
              <SourceRow sources={message.sources} />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function MessageList({
  messages,
  loading,
  typingText,
  loadingKind = "text",
  appName,
  onCopyMessage,
  onDeleteMessage,
  onEditMessage,
  onRegenerate,
  onOpenPanel,
  onCopyCode,
  streamMessageId,
  streamResponses = true,
}) {
  const rootRef = useRef(null);
  const bottomAnchorRef = useRef(null);
  const scrollParentRef = useRef(null);

  const [streamedPreview, setStreamedPreview] = useState("");
  const [shouldStickToBottom, setShouldStickToBottom] = useState(true);

  const lastUserId = useMemo(
    () => [...messages].reverse().find((message) => message.role === "user")?.message_id,
    [messages]
  );

  const lastAssistantId = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant")?.message_id,
    [messages]
  );

  const scrollToBottom = useCallback((behavior = "smooth") => {
    const container = scrollParentRef.current;
    if (!container) return;

    const targetTop = container.scrollHeight - container.clientHeight;
    container.scrollTo({
      top: Math.max(0, targetTop),
      behavior,
    });
  }, []);

  const syncStickiness = useCallback(() => {
    const container = scrollParentRef.current;
    setShouldStickToBottom(isNearBottom(container));
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const parent = getScrollableParent(root);
    scrollParentRef.current = parent;
    syncStickiness();

    if (!parent || !parent.addEventListener) return undefined;

    parent.addEventListener("scroll", syncStickiness, { passive: true });
    return () => {
      parent.removeEventListener("scroll", syncStickiness);
    };
  }, [syncStickiness]);

  useLayoutEffect(() => {
    if (!shouldStickToBottom) return;
    scrollToBottom("auto");
  }, [messages.length, shouldStickToBottom, scrollToBottom]);

  useLayoutEffect(() => {
    if (!shouldStickToBottom) return;
    if (!streamedPreview) return;
    scrollToBottom("auto");
  }, [streamedPreview, shouldStickToBottom, scrollToBottom]);

  useEffect(() => {
    if (!loading || loadingKind !== "text") return undefined;
    if (!shouldStickToBottom) return undefined;

    const timer = window.setInterval(() => {
      scrollToBottom("auto");
    }, 90);

    return () => {
      window.clearInterval(timer);
    };
  }, [loading, loadingKind, shouldStickToBottom, scrollToBottom]);

  return (
    <div ref={rootRef} className="mx-auto flex w-full max-w-[1040px] flex-col gap-7">
      {messages.map((message) => (
        <MessageBubble
          key={message.message_id || `${message.role}-${message.created_at || "message"}`}
          message={message}
          appName={appName}
          isLastUser={message.message_id === lastUserId}
          isLastAssistant={message.message_id === lastAssistantId}
          onCopyMessage={onCopyMessage}
          onDeleteMessage={onDeleteMessage}
          onEditMessage={onEditMessage}
          onRegenerate={onRegenerate}
          onOpenPanel={onOpenPanel}
          onCopyCode={onCopyCode}
          streamMessageId={streamMessageId}
          streamResponses={streamResponses}
          onStreamChunk={setStreamedPreview}
        />
      ))}

      {loading ? (
        loadingKind === "image" ? (
          <ImageLoadingBubble />
        ) : (
          <div className="flex justify-start pl-[52px]">
            <div className="inline-flex items-center gap-3 rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 py-2.5 text-sm text-[var(--text-secondary)] shadow-[0_18px_40px_-34px_var(--shadow-color)]">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-soft)] px-2 py-1 text-[var(--accent)]">
                <DotsLoaderIcon className="h-4 w-4" />
              </span>
              <span className="font-medium text-[var(--text-primary)]">{typingText || "Думаю"}</span>
            </div>
          </div>
        )
      ) : null}

      <div ref={bottomAnchorRef} className="h-px w-full" />
    </div>
  );
}

function modelOptionIcon(model) {
  const kind = getModelVisualKind(model);
  if (kind === "image") return <ImageIcon className="h-5 w-5" />;
  if (kind === "code") return <CodeIcon className="h-5 w-5" />;
  if (kind === "search") return <SearchIcon className="h-5 w-5" />;
  if (kind === "audio") return <MicrophoneIcon className="h-5 w-5" />;
  if (kind === "auto") return <SparklesIcon className="h-5 w-5" />;
  return <MessageSquareIcon className="h-5 w-5" />;
}

export function ModelPopover({ models, mode, selectedModel, onSelect }) {
  const options = [
    {
      key: "auto",
      label: "Автоматически",
      subtitle: "Система сама выберет модель",
      icon: <SparklesIcon className="h-5 w-5" />,
      active: mode === "auto",
      onClick: () => onSelect({ mode: "auto", selectedModel: "" }),
    },
    ...(models.manual_models || []).map((model) => ({
      key: model.id,
      label: model.label,
      subtitle: model.kind,
      icon: modelOptionIcon(model),
      active: mode === "manual" && selectedModel === model.id,
      onClick: () => onSelect({ mode: "manual", selectedModel: model.id }),
    })),
  ];

  return (
    <div className="absolute bottom-[calc(100%+12px)] right-0 z-40 w-[292px] animate-[messageIn_.18s_ease-out] rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-2 shadow-[0_28px_68px_-38px_var(--shadow-color)] backdrop-blur-xl">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={option.onClick}
          className={[
            "flex w-full items-start gap-3 rounded-[18px] px-3 py-3 text-left transition duration-200",
            option.active
              ? "bg-[var(--surface-soft)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]",
          ].join(" ")}
        >
          <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--accent)]">
            {option.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="mt-1 block text-xs text-[var(--text-tertiary)]">{option.subtitle}</span>
          </span>
        </button>
      ))}
    </div>
  );
}