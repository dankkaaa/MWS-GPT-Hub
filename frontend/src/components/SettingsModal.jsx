import React from "react";
import { CheckIcon, CloseIcon, MoonIcon, SparklesIcon, SunIcon } from "./icons";

function ToggleRow({ title, description, checked, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3.5 text-left transition duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">{description}</span>
      </span>
      <span
        className={[
          "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition duration-200",
          checked ? "border-[var(--accent)] bg-[var(--accent)]/18" : "border-[var(--border-soft)] bg-[var(--surface-elevated)]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[var(--accent)] shadow-[0_8px_18px_-12px_var(--shadow-color)] transition duration-200",
            checked ? "left-6" : "left-1",
          ].join(" ")}
        >
          {checked ? <CheckIcon className="h-3.5 w-3.5" /> : null}
        </span>
      </span>
    </button>
  );
}

function ThemeButton({ active, title, subtitle, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex min-h-[120px] w-full flex-col rounded-[22px] border px-4 py-4 text-left transition duration-300",
        active
          ? "border-[var(--border-strong)] bg-[var(--surface-soft)] shadow-[0_20px_48px_-34px_var(--shadow-color)]"
          : "border-[var(--border-soft)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]",
      ].join(" ")}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-primary)]">
        {icon}
      </span>
      <span className="mt-4 text-base font-semibold text-[var(--text-primary)]">{title}</span>
      <span className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{subtitle}</span>
      {active ? (
        <span className="mt-4 inline-flex w-fit rounded-full bg-[var(--accent)]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Активна
        </span>
      ) : null}
    </button>
  );
}

export function SettingsModal({
  open,
  onClose,
  modeLabel,
  user,
  apiKeyStatus,
  theme,
  onThemeChange,
  preferences,
  onTogglePreference,
  onResetOnboarding,
}) {
  if (!open) return null;

  const infoItems = [
    { label: "Аккаунт", value: user?.nickname || "Не авторизован" },
    { label: "Email", value: user?.email || "—" },
    { label: "Режим моделей", value: modeLabel },
    { label: "MWS API", value: apiKeyStatus },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button type="button" className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[860px] rounded-[34px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-5 shadow-[0_36px_120px_-60px_var(--shadow-color)] sm:p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Настройки</div>
            <h2 className="mt-2 text-[clamp(1.8rem,3vw,2.4rem)] font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Интерфейс и поведение чата</h2>
            <p className="mt-2 max-w-[520px] text-sm leading-6 text-[var(--text-secondary)]">
              Переключайте тему, управляйте выводом ответов и быстро возвращайте стартовые подсказки для первого запуска.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-secondary)] transition duration-300 hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
            aria-label="Закрыть"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.18fr_0.92fr]">
          <section className="space-y-4 rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 sm:p-5">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Оформление</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">Тема применяется ко всему приложению, включая панель кода и карточки сообщений.</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ThemeButton
                active={theme === "light"}
                title="Светлая"
                subtitle="Мягкий светлый интерфейс с исходной голубой палитрой."
                icon={<SunIcon className="h-5 w-5" />}
                onClick={() => onThemeChange("light")}
              />
              <ThemeButton
                active={theme === "dark"}
                title="Тёмная"
                subtitle="Глубокий тёмный режим с чистым контрастом для кода и чата."
                icon={<MoonIcon className="h-5 w-5" />}
                onClick={() => onThemeChange("dark")}
              />
            </div>

            <div className="pt-2">
              <div className="text-sm font-semibold text-[var(--text-primary)]">Полезные функции</div>
              <div className="mt-3 space-y-3">
                <ToggleRow
                  title="Плавный вывод ответа"
                  description="Ответ ассистента появляется постепенно, как в современных AI-чатах."
                  checked={Boolean(preferences?.streamResponses)}
                  onToggle={() => onTogglePreference?.("streamResponses")}
                />
                <ToggleRow
                  title="Артефакты справа"
                  description="Длинный код и большие ответы открываются в правой рабочей панели."
                  checked={Boolean(preferences?.autoArtifacts)}
                  onToggle={() => onTogglePreference?.("autoArtifacts")}
                />
                <button
                  type="button"
                  onClick={onResetOnboarding}
                  className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3.5 text-left transition duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                >
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text-primary)]">Показать onboarding снова</span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">Вернуть стартовые подсказки и карточки быстрого запуска в новом чате.</span>
                  </span>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--accent)]">
                    <SparklesIcon className="h-4 w-4" />
                  </span>
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Параметры</div>
            <div className="mt-4 space-y-3">
              {infoItems.map((item) => (
                <div key={item.label} className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3.5">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{item.label}</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-primary)]">{item.value}</div>
                </div>
              ))}
              <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3.5 text-sm leading-6 text-[var(--text-secondary)]">
                Голосовой ввод поддерживает браузерное распознавание речи и запись через MediaRecorder, если это доступно в браузере.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
