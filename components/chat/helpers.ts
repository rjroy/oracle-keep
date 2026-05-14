import { marked } from "marked";
import type { HistoryItem } from "@/types/chat";
import type { Message } from "./types";

// Configure marked with language annotation for code blocks.
const renderer = new marked.Renderer();
renderer.code = ({
  text,
  lang,
}: {
  text: string;
  lang?: string;
  escaped?: boolean;
}) => {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre data-lang="${lang ?? ""}"><code>${escaped}</code></pre>`;
};
marked.use({ breaks: true, gfm: true, renderer });

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Render markdown to HTML. When streaming=true, injects a `.streaming-caret`
 * span before the final closing tag so the caret appears inline with the text.
 */
export function renderMarkdown(text: string, streaming = false): string {
  let html = marked.parse(text);
  if (typeof html !== "string") return "";
  if (streaming) {
    html = html
      .trimEnd()
      .replace(
        /<\/([^>]+)>$/,
        '<span class="streaming-caret">▍</span></$1>'
      );
  }
  return html;
}

export function historyToMessages(items: HistoryItem[]): Message[] {
  const messages: Message[] = [];
  let currentGroup: (Message & { kind: "tool_group" }) | null = null;

  for (const item of items) {
    if (item.type === "user") {
      currentGroup = null;
      messages.push({ id: uid(), kind: "user", text: item.text });
    } else if (item.type === "thinking") {
      currentGroup = null;
      messages.push({
        id: uid(),
        kind: "thinking",
        text: item.text,
        streaming: false,
        expanded: false,
      });
    } else if (item.type === "assistant_text") {
      currentGroup = null;
      messages.push({
        id: uid(),
        kind: "assistant",
        text: item.text,
        streaming: false,
      });
    } else if (item.type === "tool") {
      if (!currentGroup) {
        currentGroup = { id: uid(), kind: "tool_group", tools: [] };
        messages.push(currentGroup);
      }
      currentGroup.tools.push({
        id: uid(),
        name: item.name,
        label: item.name,
        output: item.output,
        status: item.isError ? "error" : "ok",
        expanded: false,
      });
    }
  }

  return messages;
}
