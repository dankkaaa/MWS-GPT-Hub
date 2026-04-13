import React, { useMemo, useState } from "react";
import { LockIcon, MailIcon, PenSquareIcon, UserCircleIcon } from "./icons";

function Field({ label, type = "text", value, onChange, placeholder, icon }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">{label}</span>
      <div className="flex items-center gap-3 rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3.5 transition duration-200 focus-within:border-[var(--border-strong)] focus-within:bg-[var(--surface-soft)]">
        <span className="text-[var(--text-tertiary)]">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full border-none bg-transparent text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
      </div>
    </label>
  );
}

export function AuthScreen({ appName, onLogin, onRegister, loading = false }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submitLabel = useMemo(() => (mode === "login" ? "Войти" : "Создать аккаунт"), [mode]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        await onLogin({ email, password });
      } else {
        await onRegister({ email, nickname, password });
      }
      setPassword("");
    } catch (submitError) {
      setError(submitError.message || "Не удалось выполнить авторизацию");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute left-[8%] top-[12%] h-[280px] w-[280px] rounded-full bg-[var(--bg-orb-1)] blur-3xl" />
        <div className="absolute bottom-[10%] right-[10%] h-[220px] w-[220px] rounded-full bg-[var(--bg-orb-2)] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[1060px]">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <section className="rounded-[34px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-6 shadow-[0_28px_90px_-52px_var(--shadow-color)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-3 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent)]">
                <PenSquareIcon className="h-4 w-4" />
              </span>
              Безопасный вход в рабочее пространство
            </div>

            <h1 className="mt-8 max-w-[520px] text-[clamp(2.4rem,4.6vw,4.4rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-[var(--text-primary)]">
              Продолжите работу в <span className="text-[var(--accent)]">{appName}</span>
            </h1>
            <p className="mt-5 max-w-[520px] text-[15px] leading-7 text-[var(--text-secondary)] sm:text-base">
              Авторизуйтесь, чтобы хранить историю диалогов за своим аккаунтом и безопасно возвращаться к ним после
              повторного входа.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Чаты привязаны к аккаунту</div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  После входа видны только ваши чаты. После выхода чужая история недоступна.
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Сессия сохраняется</div>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Повторный вход восстанавливает ваши диалоги, настройки и структуру рабочей области.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[34px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-6 shadow-[0_28px_90px_-52px_var(--shadow-color)] backdrop-blur-xl sm:p-8">
            <div className="flex gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] p-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className={[
                  "flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition duration-200",
                  mode === "login"
                    ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_10px_24px_-18px_var(--shadow-color)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                className={[
                  "flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition duration-200",
                  mode === "register"
                    ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_10px_24px_-18px_var(--shadow-color)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                Регистрация
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                icon={<MailIcon className="h-5 w-5" />}
              />

              {mode === "register" ? (
                <Field
                  label="Nickname"
                  value={nickname}
                  onChange={setNickname}
                  placeholder="Ваш никнейм"
                  icon={<UserCircleIcon className="h-5 w-5" />}
                />
              ) : null}

              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Минимум 8 символов"
                icon={<LockIcon className="h-5 w-5" />}
              />

              {error ? (
                <div className="rounded-[20px] border border-[var(--danger-soft)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-[20px] bg-[image:var(--accent-gradient)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_var(--accent-glow)] transition duration-200 hover:-translate-y-0.5 hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Подождите…" : submitLabel}
              </button>
            </form>

            <p className="mt-5 text-sm leading-6 text-[var(--text-secondary)]">
              {mode === "login"
                ? "Используйте email и пароль, чтобы открыть только свои сохранённые чаты."
                : "После регистрации аккаунт и сессия будут созданы сразу, а история начнёт сохраняться за вами."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
