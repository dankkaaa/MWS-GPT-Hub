import React, { useMemo, useState } from "react";
import { canonicalizeLanguage, copyText, formatLanguageLabel, isLongCodeBlock } from "../lib/chat-utils";
import { CheckIcon, CodeIcon, CopyIcon, ExpandIcon } from "./icons";

const LANGUAGE_KEYWORDS = {
  javascript: ["const", "let", "var", "function", "return", "if", "else", "await", "async", "class", "new", "import", "from", "export", "try", "catch"],
  typescript: ["const", "let", "var", "function", "return", "if", "else", "await", "async", "class", "new", "import", "from", "export", "type", "interface", "extends", "implements", "try", "catch"],
  python: ["def", "return", "if", "else", "elif", "for", "while", "import", "from", "class", "try", "except", "with", "as", "lambda", "pass", "break", "continue"],
  json: [],
  bash: ["if", "then", "else", "fi", "for", "do", "done", "case", "esac", "function"],
  html: ["div", "span", "script", "style", "body", "head", "html"],
  css: ["display", "position", "background", "color", "border", "padding", "margin", "flex", "grid"],
};

function splitTokens(line, language) {
  const keywords = LANGUAGE_KEYWORDS[language] || [];
  const keywordPattern = keywords.length ? new RegExp(`\\b(?:${keywords.join("|")})\\b`, "gi") : null;
  const commentPattern = /(#.*$|\/\/.*$)/gm;
  const pattern = new RegExp(
    [
      "(`(?:\\\\.|[^`])*`|\"(?:\\\\.|[^\"])*\"|'(?:\\\\.|[^'])*')",
      commentPattern.source,
      "\\b\\d+(?:\\.\\d+)?\\b",
      keywordPattern?.source,
    ]
      .filter(Boolean)
      .join("|"),
    "gi"
  );

  const tokens = [];
  let lastIndex = 0;
  line.replace(pattern, (match, ...args) => {
    const offset = args.at(-2);
    if (offset > lastIndex) {
      tokens.push({ type: "plain", value: line.slice(lastIndex, offset) });
    }
    let type = "plain";
    if (/^(`|"|')/.test(match)) type = "string";
    else if (commentPattern.test(match)) type = "comment";
    else if (/^\d/.test(match)) type = "number";
    else if (keywordPattern && new RegExp(`^${keywordPattern.source}$`, "i").test(match)) type = "keyword";
    tokens.push({ type, value: match });
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < line.length) {
    tokens.push({ type: "plain", value: line.slice(lastIndex) });
  }
  return tokens.length ? tokens : [{ type: "plain", value: line || " " }];
}

function tokenClass(type) {
  if (type === "keyword") return "text-[var(--code-keyword)]";
  if (type === "string") return "text-[var(--code-string)]";
  if (type === "comment") return "text-[var(--code-comment)]";
  if (type === "number") return "text-[var(--code-number)]";
  return "text-[var(--code-text)]";
}

export function CodeBlock({
  code,
  language,
  previewLines = 16,
  expanded = false,
  showExpand = true,
  onOpenPanel,
  onCopy,
  className = "",
  hideCopy = false,
  drawerMode = false,
}) {
  const [copied, setCopied] = useState(false);
  const normalizedLanguage = canonicalizeLanguage(language);
  const label = formatLanguageLabel(normalizedLanguage);
  const lines = useMemo(() => String(code || "").replace(/\n$/, "").split("\n"), [code]);
  const isLong = isLongCodeBlock(code, previewLines);
  const visibleLines = expanded || !showExpand || !isLong ? lines : lines.slice(0, previewLines);

  async function handleCopy() {
    await copyText(code);
    setCopied(true);
    onCopy?.();
    window.clearTimeout(handleCopy._timer);
    handleCopy._timer = window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div
      className={[
        "overflow-hidden rounded-[26px] border border-[var(--code-border)] bg-[var(--code-surface)] shadow-[0_22px_56px_-36px_var(--shadow-color)] backdrop-blur-xl",
        drawerMode ? "flex h-full min-h-0 flex-col" : "",
        className,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--code-border)] bg-[var(--code-header-bg)] px-4 py-3 text-sm text-[var(--code-muted)]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-[var(--code-border)] bg-[var(--code-chip-bg)] text-[var(--accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <CodeIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold text-[var(--code-text)]">{label}</div>
            <div className="text-xs text-[var(--code-muted)]">{lines.length} строк</div>
          </div>
        </div>

        {!hideCopy ? (
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--code-border)] bg-[var(--code-chip-bg)] px-3 py-1.5 text-xs font-medium text-[var(--code-muted)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--code-chip-hover)] hover:text-[var(--code-text)] active:translate-y-0"
        >
          {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
          {copied ? "Скопировано" : "Копировать"}
        </button>
        ) : null}
      </div>

      <div className={drawerMode ? "min-h-0 flex-1 overflow-auto" : "overflow-auto"}>
        <div className="min-w-max font-mono text-[13px] leading-6">
          {visibleLines.map((line, index) => (
            <div key={`line-${index}`} className="grid grid-cols-[56px,minmax(0,1fr)]">
              <div className="select-none border-r border-[var(--code-border)] px-3 py-0.5 text-right tabular-nums text-[var(--code-line-number)]">
                {index + 1}
              </div>
              <div className="px-4 py-0.5 whitespace-pre">
                {splitTokens(line, normalizedLanguage).map((token, tokenIndex) => (
                  <span key={`${index}-${tokenIndex}`} className={tokenClass(token.type)}>
                    {token.value || " "}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isLong && showExpand && onOpenPanel ? (
        <div className="border-t border-[var(--code-border)] bg-[var(--code-header-bg)] px-4 py-3">
          <button
            type="button"
            onClick={onOpenPanel}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--code-border)] bg-[var(--code-chip-bg)] px-3.5 py-1.5 text-xs font-semibold text-[var(--code-muted)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--code-chip-hover)] hover:text-[var(--code-text)] active:translate-y-0"
          >
            <ExpandIcon className="h-3.5 w-3.5" />
            Показать всё
          </button>
        </div>
      ) : null}
    </div>
  );
}
