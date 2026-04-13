import React, { useEffect, useRef, useState } from "react";
import { copyText, formatLanguageLabel } from "../lib/chat-utils";
import { CheckIcon, CloseIcon, CopyIcon } from "./icons";
import { CodeBlock } from "./CodeBlock";
import { MessageRenderer } from "./MessageRenderer";

function DrawerBody({ kind, language, code }) {
  if (kind === "code") {
    return <CodeBlock code={code} language={language} expanded showExpand={false} hideCopy drawerMode className="h-full" />;
  }
  return (
    <div className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-surface)] p-5 shadow-[0_18px_48px_-34px_var(--shadow-color)]">
      <MessageRenderer content={code} />
    </div>
  );
}

function DrawerHeader({ kind, title, language, code, onClose, onCopy, copied }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--panel-border)] bg-[var(--panel-header-bg)] px-5 py-4 backdrop-blur-xl">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{title || (kind === "code" ? "Код" : "Артефакт")}</div>
        <div className="mt-1 text-xs text-[var(--text-secondary)]">{kind === "code" ? formatLanguageLabel(language) : "Развёрнутый артефакт"}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            await copyText(code);
            onCopy?.();
          }}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--panel-chip-bg)] px-3 text-sm font-medium text-[var(--text-secondary)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] active:translate-y-0"
        >
          {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
          {copied ? "Скопировано" : kind === "code" ? "Копировать" : "Копировать текст"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-chip-bg)] text-[var(--text-secondary)] transition duration-200 hover:rotate-90 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          aria-label="Закрыть панель"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function CodeDrawer({ open, kind = "code", title, language, code, onClose, onCopy, copied, width = 560, onWidthChange }) {
  const [isResizing, setIsResizing] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!isResizing) return undefined;

    function handleMove(event) {
      const viewportWidth = window.innerWidth;
      const nextWidth = Math.min(Math.max(viewportWidth - event.clientX, 420), Math.min(920, viewportWidth * 0.7));
      onWidthChange?.(nextWidth);
    }

    function handleUp() {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, onWidthChange]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[75] bg-[var(--overlay)] backdrop-blur-md lg:hidden" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[80] w-full max-w-[min(100vw,560px)] border-l border-[var(--panel-border)] bg-[var(--panel-surface)] shadow-[-30px_0_80px_-60px_var(--shadow-color)] lg:hidden">
        <div className="flex h-full flex-col">
          <DrawerHeader kind={kind} title={title} language={language} code={code} onClose={onClose} onCopy={onCopy} copied={copied} />
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-4"><DrawerBody kind={kind} language={language} code={code} /></div>
        </div>
      </div>

      <aside ref={drawerRef} className="relative hidden h-full shrink-0 overflow-hidden border-l border-[var(--panel-border)] bg-[var(--panel-surface)] shadow-[-20px_0_54px_-44px_var(--shadow-color)] transition-[width,opacity,transform] duration-300 ease-out lg:flex lg:flex-col" style={{ width, flexBasis: width }}>
        <button
          type="button"
          onMouseDown={() => setIsResizing(true)}
          className="absolute -left-1 top-0 z-10 hidden h-full w-2 cursor-col-resize bg-transparent lg:block"
          aria-label="Изменить ширину панели"
        >
          <span className="absolute left-1/2 top-1/2 h-16 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--panel-resize-handle)] opacity-70 transition hover:h-24 hover:opacity-100" />
        </button>
        <DrawerHeader kind={kind} title={title} language={language} code={code} onClose={onClose} onCopy={onCopy} copied={copied} />
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-4"><DrawerBody kind={kind} language={language} code={code} /></div>
      </aside>
    </>
  );
}
