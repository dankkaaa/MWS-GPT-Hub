import React, { useEffect, useMemo, useRef, useState } from "react";
import { filterGroupedChats } from "../lib/chat-utils";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  DownloadIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  MoreHorizontalIcon,
  PenSquareIcon,
  PinIcon,
  SearchIcon,
  SettingsIcon,
  ShareIcon,
  SunIcon,
  TrashIcon,
  UserCircleIcon,
} from "./icons";

function useDismiss(ref, onClose, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    function handleOutside(event) {
      if (ref.current?.contains(event.target)) return;
      onClose();
    }
    function handleEscape(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [active, onClose, ref]);
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedSnippet(text, query) {
  const source = String(text || "").trim();
  const normalizedQuery = String(query || "").trim();
  if (!source) return "";
  if (!normalizedQuery) return source;

  const escaped = escapeRegExp(normalizedQuery);
  const parts = source.split(new RegExp(`(${escaped})`, "ig"));

  return parts.map((part, index) =>
    part.toLowerCase() === normalizedQuery.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="rounded-sm bg-[rgba(62,178,255,0.16)] px-0.5 text-[var(--text-primary)]">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  );
}

function actionButtonClasses(collapsed, isPrimary = false) {
  return [
    "group relative inline-flex items-center overflow-hidden rounded-[22px] border transition-all duration-300 ease-out will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-glow)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
    isPrimary
      ? "border-transparent bg-[image:var(--accent-gradient)] text-white shadow-[0_18px_38px_-24px_var(--accent-glow)] hover:-translate-y-0.5 hover:brightness-[1.03] active:translate-y-0 active:scale-[0.99]"
      : "border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
    collapsed ? "mx-auto flex h-14 w-14 items-center justify-center" : "h-14 w-full gap-3 px-4",
  ].join(" ");
}

function chatItemClasses(isActive) {
  return [
    "group relative flex w-full items-start gap-3 rounded-[22px] border px-3.5 py-3.5 text-left transition-all duration-300 ease-out",
    isActive
      ? "border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_18px_32px_-28px_var(--shadow-color)]"
      : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-soft)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
  ].join(" ");
}

function ChatActionsMenu({ chat, onRename, onTogglePin, onShare, onExport, onDelete, onClose }) {
  const menuRef = useRef(null);
  useDismiss(menuRef, onClose, true);
  const itemClass = "flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition duration-200 hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]";

  return (
    <div ref={menuRef} className="absolute right-2 top-[calc(100%+6px)] z-30 w-[220px] rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-2 shadow-[0_24px_58px_-36px_var(--shadow-color)] backdrop-blur-xl">
      <button type="button" onClick={onRename} className={itemClass}><PenSquareIcon className="h-4 w-4" />Переименовать</button>
      <button type="button" onClick={onTogglePin} className={itemClass}><PinIcon className="h-4 w-4" />{chat.metadata?.pinned ? "Открепить" : "Закрепить"}</button>
      <button type="button" onClick={onShare} className={itemClass}><ShareIcon className="h-4 w-4" />Поделиться</button>
      <button type="button" onClick={onExport} className={itemClass}><DownloadIcon className="h-4 w-4" />Экспорт .md</button>
      <button type="button" onClick={onDelete} className={`${itemClass} text-[var(--danger-text)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)]`}><TrashIcon className="h-4 w-4" />Удалить</button>
    </div>
  );
}

function SidebarChatItem({
  chat,
  searchQuery,
  isActive,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onSelect,
  onRename,
  onTogglePin,
  onShare,
  onExport,
  onDelete,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSave,
  onRenameCancel,
}) {
  const isPinned = Boolean(chat.metadata?.pinned);

  return (
    <div className="relative">
      <button type="button" onClick={() => onSelect(chat.chat_id)} className={chatItemClasses(isActive)}>
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)]/70 opacity-0 transition duration-300 group-hover:opacity-100" />
        <div className="min-w-0 flex-1 pr-10">
          {isRenaming ? (
            <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5">
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onRenameSave(chat.chat_id);
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onRenameCancel();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-transparent text-[0.95rem] font-semibold text-[var(--text-primary)] outline-none"
                placeholder="Название чата"
              />
              <div className="mt-2 flex items-center justify-end gap-1">
                <button type="button" onClick={(e) => { e.stopPropagation(); onRenameCancel(); }} className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition hover:bg-[var(--surface)] hover:text-[var(--text-primary)]" aria-label="Отменить"><CloseIcon className="h-4 w-4" /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onRenameSave(chat.chat_id); }} className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition hover:bg-[var(--accent-strong)]" aria-label="Сохранить"><ChevronDownIcon className="h-4 w-4 -rotate-90" /></button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[1.75rem] items-center gap-2">
              <div className="truncate text-[0.96rem] font-semibold leading-6 tracking-[-0.02em] text-[var(--text-primary)]">
                {searchQuery ? renderHighlightedSnippet(chat.title || "Новый чат", searchQuery) : (chat.title || "Новый чат")}
              </div>
              {isPinned ? <PinIcon className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" /> : null}
            </div>
          )}
        </div>

        {!isRenaming ? (
          <div className="absolute right-2 top-2.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                menuOpen ? onCloseMenu() : onOpenMenu(chat.chat_id);
              }}
              className={[
                "inline-flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition duration-200",
                menuOpen || isActive ? "opacity-100 hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]" : "opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]",
              ].join(" ")}
              aria-label="Действия с чатом"
            >
              <MoreHorizontalIcon className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </button>
      {menuOpen && !isRenaming ? (
        <ChatActionsMenu chat={chat} onRename={() => onRename(chat)} onTogglePin={() => onTogglePin(chat)} onShare={() => onShare(chat)} onExport={() => onExport(chat)} onDelete={() => onDelete(chat)} onClose={onCloseMenu} />
      ) : null}
    </div>
  );
}

function AccountMenu({ user, onOpenSettings, theme, onToggleTheme, onLogout, onClose, collapsed }) {
  const menuRef = useRef(null);
  useDismiss(menuRef, onClose, true);
  const itemClass = "flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition duration-200 hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]";

  return (
    <div ref={menuRef} className={["absolute z-30 w-[240px] rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-2 shadow-[0_24px_58px_-36px_var(--shadow-color)] backdrop-blur-xl", collapsed ? "bottom-0 left-[calc(100%+10px)]" : "bottom-[calc(100%+10px)] left-0 right-0"].join(" ")}>
      <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3.5">
        <div className="truncate text-sm font-semibold text-[var(--text-primary)]">{user?.nickname || "Аккаунт"}</div>
        <div className="mt-1 truncate text-xs text-[var(--text-secondary)]">{user?.email || ""}</div>
      </div>
      {user ? (
        <>
          <button type="button" onClick={onOpenSettings} className={`mt-2 ${itemClass}`}><SettingsIcon className="h-4 w-4" />Настройки</button>
          <button type="button" onClick={onToggleTheme} className={itemClass}>{theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</button>
          <button type="button" onClick={onLogout} className={itemClass}><LogOutIcon className="h-4 w-4" />Выйти</button>
        </>
      ) : (
        <button type="button" onClick={onClose} className={`mt-2 ${itemClass}`}><LogInIcon className="h-4 w-4" />Войти</button>
      )}
    </div>
  );
}

export function Sidebar({
  groups,
  activeChatId,
  user,
  theme,
  onToggleTheme,
  onNewChat,
  onOpenSettings,
  onSelectChat,
  onRenameChat,
  onTogglePinChat,
  onDeleteChat,
  onShareChat,
  onExportChat,
  onLogout,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}) {
  const [menuChatId, setMenuChatId] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (collapsed) {
      setMenuChatId(null);
      setEditingChatId(null);
      setAccountMenuOpen(false);
    }
  }, [collapsed]);

  const visibleGroups = useMemo(() => filterGroupedChats(groups, searchQuery), [groups, searchQuery]);

  function startRename(chat) {
    setMenuChatId(null);
    setEditingChatId(chat.chat_id);
    setRenameValue(chat.title || "");
  }

  async function saveRename(chatId) {
    const nextTitle = renameValue.trim();
    if (!nextTitle) return;
    await onRenameChat(chatId, nextTitle);
    setEditingChatId(null);
    setRenameValue("");
  }

  return (
    <>
      <div className={["fixed inset-0 z-30 bg-[var(--overlay)] backdrop-blur-md transition-opacity duration-300 lg:hidden", mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"].join(" ")} onClick={onCloseMobile} />
      <aside className={["fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-4 pb-4 pt-4 backdrop-blur-xl transition-[width,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:static lg:z-auto", collapsed ? "w-[94px]" : "w-[308px]", mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"].join(" ")}>
        <div className="flex h-12 items-center justify-center lg:justify-start">
          <button type="button" onClick={onToggleCollapse} className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-primary)] transition-colors duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]" aria-label="Переключить сайдбар">
            <MenuIcon className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button type="button" onClick={onNewChat} className={actionButtonClasses(collapsed, true)}>
            <PenSquareIcon className="h-5 w-5 shrink-0" />
            {!collapsed ? <span className="text-[0.98rem] font-semibold tracking-[-0.02em]">Новый чат</span> : null}
          </button>
        </div>

        {!collapsed ? (
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="sticky top-0 z-10 bg-[var(--sidebar-bg)] pb-4">
              <label className="relative block">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Поиск по чатам"
                  className="h-[52px] w-full rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] pl-12 pr-4 text-sm text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition duration-200 placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-strong)] focus:bg-[var(--surface-hover)] focus:shadow-[0_0_0_4px_rgba(62,178,255,0.08)]"
                />
              </label>
            </div>

            {visibleGroups.length ? (
              <div className="space-y-7 pb-2">
                {visibleGroups.map((group) => (
                  <section key={group.label}>
                    <div className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{group.label}</div>
                    <div className="space-y-2">
                      {group.items.map((chat) => (
                        <SidebarChatItem
                          key={chat.chat_id}
                          chat={chat}
                          searchQuery={searchQuery}
                          isActive={chat.chat_id === activeChatId}
                          menuOpen={menuChatId === chat.chat_id}
                          onOpenMenu={setMenuChatId}
                          onCloseMenu={() => setMenuChatId(null)}
                          onSelect={(chatId) => { onSelectChat(chatId); onCloseMobile(); }}
                          onRename={startRename}
                          onTogglePin={async (item) => {
                            setMenuChatId(null);
                            await onTogglePinChat(item.chat_id, !item.metadata?.pinned);
                          }}
                          onShare={(item) => {
                            setMenuChatId(null);
                            onShareChat(item.chat_id);
                          }}
                          onExport={(item) => {
                            setMenuChatId(null);
                            onExportChat(item.chat_id);
                          }}
                          onDelete={(item) => {
                            setMenuChatId(null);
                            onDeleteChat(item.chat_id);
                          }}
                          isRenaming={editingChatId === chat.chat_id}
                          renameValue={renameValue}
                          onRenameChange={setRenameValue}
                          onRenameSave={saveRename}
                          onRenameCancel={() => {
                            setEditingChatId(null);
                            setRenameValue("");
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-5 text-sm leading-6 text-[var(--text-secondary)]">
                {searchQuery ? "Ничего не найдено. Попробуйте другой запрос." : "История диалогов появится здесь после первых сообщений."}
              </div>
            )}
          </div>
        ) : <div className="flex-1" />}

        <div className="relative mt-auto pt-4">
          <button type="button" onClick={() => setAccountMenuOpen((prev) => !prev)} className={["flex w-full items-center rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] transition-all duration-300 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]", collapsed ? "mx-auto h-14 w-14 justify-center" : "gap-3 px-3 py-3"].join(" ")} aria-label="Аккаунт">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--surface-soft)] text-[var(--text-primary)]"><UserCircleIcon className="h-5 w-5" /></span>
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{user?.nickname || "Аккаунт"}</span>
                  <span className="block truncate text-xs text-[var(--text-secondary)]">{user?.email || "Нет email"}</span>
                </span>
                <ChevronUpIcon className="h-4 w-4 text-[var(--text-tertiary)]" />
              </>
            ) : null}
          </button>
          {accountMenuOpen ? (
            <AccountMenu
              user={user}
              collapsed={collapsed}
              theme={theme}
              onOpenSettings={() => { setAccountMenuOpen(false); onOpenSettings(); }}
              onToggleTheme={onToggleTheme}
              onLogout={async () => { setAccountMenuOpen(false); await onLogout(); }}
              onClose={() => setAccountMenuOpen(false)}
            />
          ) : null}
        </div>
      </aside>
    </>
  );
}
