import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { HistoryItem } from "@/types/chat";

export type { HistoryItem };

export function buildHistory(messages: AgentMessage[]): HistoryItem[] {
  // Index tool results by toolCallId for O(1) pairing with tool calls.
  const toolResults: Record<
    string,
    Extract<AgentMessage, { role: "toolResult" }>
  > = {};

  for (const msg of messages) {
    if (msg.role === "toolResult") {
      toolResults[msg.toolCallId] = msg;
    }
  }

  const items: HistoryItem[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : msg.content
              .filter((b) => b.type === "text")
              .map((b) => (b as { type: "text"; text: string }).text)
              .join("\n");
      if (text.trim()) items.push({ type: "user", text });
    } else if (msg.role === "assistant") {
      for (const block of msg.content) {
        if (block.type === "text" && block.text.trim()) {
          items.push({ type: "assistant_text", text: block.text });
        } else if (block.type === "thinking" && block.thinking.trim()) {
          items.push({ type: "thinking", text: block.thinking });
        } else if (block.type === "toolCall") {
          const result = toolResults[block.id];
          const output = result
            ? result.content
                .filter((b) => b.type === "text")
                .map((b) => (b as { type: "text"; text: string }).text)
                .join("")
            : "";
          items.push({
            type: "tool",
            name: block.name,
            output,
            isError: result?.isError ?? false,
          });
        }
      }
    }
    // skip: toolResult, bashExecution, custom, branchSummary, compactionSummary
  }

  return items;
}
