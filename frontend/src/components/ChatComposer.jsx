import React, { useEffect, useMemo, useRef } from "react";
import { friendlyModelLabel } from "../lib/chat-utils";
import { ChevronUpIcon, CloseIcon, MicrophoneIcon, PlusIcon, SendIcon, ImageIcon, FileIcon } from "./icons";
import { ModelPopover } from "./MessageList";

function AttachmentChip({ attachment, onRemove }) {
  const isImage = attachment.type === "image";
  const label = attachment.metadata?.file_name || attachment.file_id || "Вложение";
  const status = attachment.metadata?.ingestion_status || attachment.metadata?.status || "готово";
  const previewUrl = attachment.metadata?.preview_url || "";
  const isUploading = /upload/i.test(status);
  const isFailed = /error|failed|ошиб/i.test(status);

  if (isImage && previewUrl) {
    return (
      <div className="relative h-[90px] w-[90px] overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-soft)] shadow-[0_14px_36px_-28px_var(--shadow-color)]">
        <img src={previewUrl} alt={label} className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(15,23,38,0.12))]" />
        {isUploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(255,255,255,0.42)] backdrop-blur-[2px] dark:bg-[rgba(8,21,41,0.42)]">
            <div className="relative h-10 w-10 rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)]/90 shadow-[0_10px_24px_-18px_var(--shadow-color)]">
              <div className="absolute inset-[4px] rounded-full border-[2.5px] border-[rgba(62,178,255,0.18)]" />
              <div className="absolute inset-[4px] rounded-full border-[2.5px] border-transparent border-t-[var(--accent)] border-r-[var(--accent)] animate-spin" />
            </div>
          </div>
        ) : null}
        {isFailed ? (
          <div className="absolute inset-x-2 bottom-2 rounded-full bg-[var(--danger-bg)] px-2 py-1 text-center text-[10px] font-semibold text-[var(--danger-text)]">
            Ошибка
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => onRemove(attachment.local_id || attachment.file_id)}
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(15,23,38,0.72)] text-white shadow-[0_8px_18px_-12px_rgba(0,0,0,0.5)] transition hover:scale-[1.03] hover:bg-[rgba(15,23,38,0.86)]"
          aria-label="Удалить вложение"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex max-w-full items-center gap-3 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2 text-sm text-[var(--text-secondary)] shadow-[0_14px_32px_-28px_var(--shadow-color)]">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[var(--accent)]">
        {isImage ? <ImageIcon className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}
      </span>
      <span className="max-w-[220px] truncate font-medium text-[var(--text-primary)]">{label}</span>
      <span className="text-xs text-[var(--text-tertiary)]">{isUploading ? "Загрузка…" : status}</span>
      <button
        type="button"
        onClick={() => onRemove(attachment.local_id || attachment.file_id)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-tertiary)] transition hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
        aria-label="Удалить вложение"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ChatComposer({ value, onChange, onSend, onKeyDown, onAttach, attachments, onRemoveAttachment, appName, models, mode, selectedModel, modelOpen, onToggleModel, onSelectModel, onCloseModel, onToggleVoice, isRecording, loading, variant = "hero" }) {
  const textareaRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
  }, [value]);

  useEffect(() => {
    if (!modelOpen) return undefined;
    function handleClickOutside(event) {
      if (popoverRef.current?.contains(event.target)) return;
      onCloseModel();
    }
    function handleEscape(event) {
      if (event.key === "Escape") onCloseModel();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [modelOpen, onCloseModel]);

  const modelLabel = mode === "auto" ? "Автоматически" : friendlyModelLabel(selectedModel, models.manual_models || []);
  const shellWidth = variant === "hero" ? "max-w-[920px]" : "max-w-[980px]";
  const attachmentCards = useMemo(() => attachments || [], [attachments]);

  return (
    <div className={`mx-auto w-full ${shellWidth}`}>
      <div className="rounded-[30px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 pb-4 pt-4 shadow-[0_24px_72px_-42px_var(--shadow-color)] backdrop-blur-xl transition duration-300 focus-within:border-[var(--border-strong)] focus-within:shadow-[0_28px_84px_-48px_var(--shadow-color)] sm:px-5 sm:pb-5 sm:pt-5">
        {attachmentCards.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-3">
            {attachmentCards.map((attachment, index) => (
              <AttachmentChip
                key={`${attachment.local_id || attachment.file_id || attachment.metadata?.file_name || 'attachment'}-${index}`}
                attachment={attachment}
                onRemove={onRemoveAttachment}
              />
            ))}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          data-chat-composer="true"
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Спросите что-нибудь у ${appName}`}
          className="max-h-[220px] min-h-[72px] w-full resize-none border-none bg-transparent px-1 py-1 text-[1rem] leading-8 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] sm:text-[1.06rem]"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onAttach} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-primary)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] active:translate-y-0" aria-label="Прикрепить файл"><PlusIcon className="h-5 w-5" /></button>
            <button type="button" onClick={onToggleVoice} className={["inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition duration-200", isRecording ? "border-[var(--danger-soft)] bg-[var(--danger-bg)] text-[var(--danger-text)]" : "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-primary)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] active:translate-y-0"].join(" ")} aria-label="Голосовой ввод"><MicrophoneIcon className="h-5 w-5" /></button>
          </div>

          <div className="relative flex items-center gap-2 self-end sm:self-auto" ref={popoverRef}>
            <button type="button" onClick={onToggleModel} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 text-sm font-medium text-[var(--text-secondary)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] active:translate-y-0"><span className="max-w-[150px] truncate">{modelLabel}</span><ChevronUpIcon className="h-4 w-4" /></button>
            <button type="button" onClick={onSend} disabled={loading} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[image:var(--accent-gradient)] text-white shadow-[0_16px_36px_-22px_var(--accent-glow)] transition duration-200 hover:-translate-y-0.5 hover:brightness-[1.04] hover:shadow-[0_24px_44px_-22px_var(--accent-glow)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-glow)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-60" aria-label="Отправить"><SendIcon className="h-[18px] w-[18px]" /></button>
            {modelOpen ? <ModelPopover models={models} mode={mode} selectedModel={selectedModel} onSelect={onSelectModel} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
