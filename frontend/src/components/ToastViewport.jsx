import React from "react";
import { CheckIcon, CloseIcon } from "./icons";

export function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(92vw,360px)] flex-col gap-3 sm:bottom-5 sm:right-5">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto animate-[messageIn_.22s_ease-out] rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4 shadow-[0_24px_58px_-36px_var(--shadow-color)] backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--accent)]">
              <CheckIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--text-primary)]">{toast.title || "Готово"}</div>
              {toast.description ? <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{toast.description}</div> : null}
              {toast.actionLabel && toast.onAction ? (
                <button
                  type="button"
                  onClick={() => toast.onAction?.()}
                  className="mt-3 inline-flex rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                >
                  {toast.actionLabel}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
              aria-label="Закрыть уведомление"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
