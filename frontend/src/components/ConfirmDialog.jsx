import React from "react";
import { CloseIcon, TrashIcon } from "./icons";

export function ConfirmDialog({ open, title, description, confirmLabel = "Подтвердить", cancelLabel = "Отмена", danger = false, onCancel, onConfirm }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--overlay)] px-4 py-6 backdrop-blur-md">
      <div className="w-full max-w-[440px] rounded-[30px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-5 shadow-[0_28px_70px_-46px_var(--shadow-color)] sm:p-6">
        <div className="flex items-start gap-4">
          <span className={["inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px]", danger ? "bg-[var(--danger-soft)] text-[var(--danger-text)]" : "bg-[var(--surface-soft)] text-[var(--accent)]"].join(" ")}>
            <TrashIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</div>
            {description ? <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</div> : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
            aria-label="Закрыть"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={["inline-flex rounded-full px-4 py-2.5 text-sm font-semibold text-white transition", danger ? "bg-[linear-gradient(135deg,#f97373_0%,#e25050_100%)] shadow-[0_16px_36px_-22px_rgba(226,80,80,0.38)] hover:brightness-[1.03]" : "bg-[image:var(--accent-gradient)] shadow-[0_16px_36px_-22px_var(--accent-glow)] hover:brightness-[1.03]"].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
