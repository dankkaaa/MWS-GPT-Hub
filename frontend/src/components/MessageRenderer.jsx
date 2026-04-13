import React from "react";
import { canonicalizeLanguage, isLongRichText } from "../lib/chat-utils";
import { CodeBlock } from "./CodeBlock";

function parseBlocks(input) {
  const text = String(input || "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeStart = line.match(/^```\s*([^\s`]*)\s*$/);
    if (codeStart) {
      const language = codeStart[1] || "text";
      index += 1;
      const codeLines = [];
      while (index < lines.length && !/^```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: "code", language, content: codeLines.join("\n") });
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      blocks.push({ type: "heading", level, content: line.replace(/^#{1,6}\s+/, "").trim() });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", content: quoteLines.join("\n") });
      continue;
    }

    const listMatch = line.match(/^\s*([-*]|\d+\.)\s+/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const items = [];
      while (index < lines.length && lines[index].match(/^\s*([-*]|\d+\.)\s+/)) {
        items.push(lines[index].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        index += 1;
      }
      blocks.push({ type: ordered ? "ordered-list" : "unordered-list", items });
      continue;
    }

    const looksLikeTable = line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*[:-]+/.test(lines[index + 1]);
    if (looksLikeTable) {
      const header = line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(
          lines[index]
            .split("|")
            .map((cell) => cell.trim())
            .filter(Boolean)
        );
        index += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length) {
      const nextLine = lines[index];
      if (!nextLine.trim()) {
        index += 1;
        break;
      }
      if (/^```/.test(nextLine) || /^#{1,6}\s+/.test(nextLine) || /^>\s?/.test(nextLine) || /^\s*([-*]|\d+\.)\s+/.test(nextLine)) {
        break;
      }
      const nextLooksLikeTable = nextLine.includes("|") && index + 1 < lines.length && /^\s*\|?\s*[:-]+/.test(lines[index + 1]);
      if (nextLooksLikeTable) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }
    blocks.push({ type: "paragraph", content: paragraphLines.join("\n") });
  }

  return blocks;
}

function renderInline(text) {
  const source = String(text || "");
  const parts = [];
  let lastIndex = 0;
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      parts.push(source.slice(lastIndex, start));
    }
    const token = match[0];
    if (/^\*\*/.test(token)) {
      parts.push(<strong key={`${start}-strong`} className="font-semibold text-[var(--text-primary)]">{token.slice(2, -2)}</strong>);
    } else if (/^\*/.test(token)) {
      parts.push(<em key={`${start}-em`} className="italic text-[var(--text-primary)]">{token.slice(1, -1)}</em>);
    } else if (/^`/.test(token)) {
      parts.push(
        <code key={`${start}-code`} className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-soft)] px-1.5 py-0.5 font-mono text-[0.92em] text-[var(--accent-strong)]">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^\)]+)\)$/) || [];
      parts.push(
        <a key={`${start}-link`} href={href} target="_blank" rel="noreferrer" className="font-medium text-[var(--accent)] underline decoration-[rgba(59,148,255,0.35)] underline-offset-4 transition hover:text-[var(--accent-strong)]">
          {label}
        </a>
      );
    }
    lastIndex = start + token.length;
  }

  if (lastIndex < source.length) {
    parts.push(source.slice(lastIndex));
  }

  return parts.map((part, index) => {
    if (typeof part === "string") {
      return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
    }
    return React.cloneElement(part, { key: part.key || `node-${index}` });
  });
}

function Paragraph({ text }) {
  const lines = String(text || "").split("\n");
  const isStandaloneStrong = lines.length === 1 && /^\*\*[^*].*\*\*$/.test(lines[0].trim());
  if (isStandaloneStrong) {
    return <h3 className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{lines[0].trim().slice(2, -2)}</h3>;
  }
  return (
    <p className="text-[15px] leading-8 text-[var(--text-primary)]">
      {lines.map((line, index) => (
        <React.Fragment key={`line-${index}`}>
          {renderInline(line)}
          {index < lines.length - 1 ? <br /> : null}
        </React.Fragment>
      ))}
    </p>
  );
}

function headingClass(level) {
  const map = {
    1: "text-2xl font-semibold tracking-[-0.05em]",
    2: "text-xl font-semibold tracking-[-0.04em]",
    3: "text-lg font-semibold tracking-[-0.03em]",
    4: "text-base font-semibold",
    5: "text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]",
    6: "text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]",
  };
  return map[level] || map[3];
}

export function MessageRenderer({ content, onOpenPanel, onCopyCode }) {
  const blocks = parseBlocks(content);
  const shouldOfferTextPanel = isLongRichText(content) && blocks.length > 3 && !blocks.some((block) => block.type === "code");

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <div key={`heading-${index}`} className={headingClass(block.level)}>
              {renderInline(block.content)}
            </div>
          );
        }

        if (block.type === "paragraph") {
          return <Paragraph key={`paragraph-${index}`} text={block.content} />;
        }

        if (block.type === "quote") {
          return (
            <blockquote key={`quote-${index}`} className="rounded-r-[22px] border-l-4 border-[var(--accent)]/55 bg-[var(--surface-soft)] px-4 py-3 text-[15px] leading-7 text-[var(--text-secondary)]">
              <Paragraph text={block.content} />
            </blockquote>
          );
        }

        if (block.type === "unordered-list" || block.type === "ordered-list") {
          const ListTag = block.type === "ordered-list" ? "ol" : "ul";
          return (
            <ListTag
              key={`list-${index}`}
              className={[
                "space-y-2 pl-5 text-[15px] leading-8 text-[var(--text-primary)]",
                block.type === "ordered-list" ? "list-decimal" : "list-disc",
              ].join(" ")}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`item-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === "table") {
          return (
            <div key={`table-${index}`} className="overflow-hidden rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-elevated)] shadow-[0_18px_42px_-34px_var(--shadow-color)]">
              <div className="overflow-auto">
                <table className="min-w-full divide-y divide-[var(--border-soft)] text-sm">
                  <thead className="bg-[var(--surface-soft)] text-[var(--text-primary)]">
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={`header-${cellIndex}`} className="px-4 py-3 text-left font-semibold">
                          {renderInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`} className="border-t border-[var(--border-soft)] text-[var(--text-secondary)]">
                        {row.map((cell, cellIndex) => (
                          <td key={`cell-${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        if (block.type === "code") {
          const language = canonicalizeLanguage(block.language);
          return (
            <CodeBlock
              key={`code-${index}`}
              code={block.content}
              language={language}
              onOpenPanel={() =>
                onOpenPanel?.({
                  kind: "code",
                  title: `${language === "text" ? "Код" : block.language || language}`,
                  language,
                  content: block.content,
                })
              }
              onCopy={onCopyCode}
            />
          );
        }

        return null;
      })}

      {shouldOfferTextPanel ? (
        <button
          type="button"
          onClick={() =>
            onOpenPanel?.({
              kind: "document",
              title: "Артефакт ответа",
              language: "markdown",
              content,
            })
          }
          className="inline-flex items-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          Открыть как артефакт
        </button>
      ) : null}
    </div>
  );
}
