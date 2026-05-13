import { describe, test, expect } from "bun:test";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { buildHistory } from "../../lib/history";

// ── Fixture helpers ────────────────────────────────────────────────────────────

function userMsg(content: string | { type: "text"; text: string }[]): AgentMessage {
  return { role: "user", content, timestamp: 0 } as AgentMessage;
}

function assistantMsg(
  content: Array<
    | { type: "text"; text: string }
    | { type: "thinking"; thinking: string }
    | { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> }
  >
): AgentMessage {
  // AgentMessage requires several other fields; cast to satisfy the type.
  return {
    role: "assistant",
    content,
    api: "anthropic" as never,
    provider: "anthropic" as never,
    model: "claude-test",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
    stopReason: "end_turn",
    timestamp: 0,
  } as unknown as AgentMessage;
}

function toolResult(
  toolCallId: string,
  texts: string[],
  isError = false
): AgentMessage {
  return {
    role: "toolResult",
    toolCallId,
    toolName: "some_tool",
    content: texts.map((t) => ({ type: "text", text: t })),
    isError,
    timestamp: 0,
  } as AgentMessage;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("buildHistory", () => {
  test("empty messages returns empty array", () => {
    expect(buildHistory([])).toEqual([]);
  });

  test("user string message produces user item", () => {
    const items = buildHistory([userMsg("hello")]);
    expect(items).toEqual([{ type: "user", text: "hello" }]);
  });

  test("user content-block message joins text blocks", () => {
    const items = buildHistory([
      userMsg([
        { type: "text", text: "part one" },
        { type: "text", text: "part two" },
      ]),
    ]);
    expect(items).toEqual([{ type: "user", text: "part one\npart two" }]);
  });

  test("user message with only whitespace is skipped", () => {
    expect(buildHistory([userMsg("   ")])).toEqual([]);
    expect(buildHistory([userMsg([{ type: "text", text: "  \n" }])])).toEqual([]);
  });

  test("assistant text block produces assistant_text item", () => {
    const items = buildHistory([assistantMsg([{ type: "text", text: "answer" }])]);
    expect(items).toEqual([{ type: "assistant_text", text: "answer" }]);
  });

  test("assistant text block with only whitespace is skipped", () => {
    expect(buildHistory([assistantMsg([{ type: "text", text: "   " }])])).toEqual([]);
  });

  test("assistant tool call is paired with its tool result", () => {
    const messages: AgentMessage[] = [
      assistantMsg([{ type: "toolCall", id: "call-1", name: "bash", arguments: {} }]),
      toolResult("call-1", ["output text"]),
    ];
    const items = buildHistory(messages);
    expect(items).toEqual([
      { type: "tool", name: "bash", output: "output text", isError: false },
    ]);
  });

  test("tool call result marked isError propagates", () => {
    const messages: AgentMessage[] = [
      assistantMsg([{ type: "toolCall", id: "call-err", name: "bash", arguments: {} }]),
      toolResult("call-err", ["error output"], true),
    ];
    const items = buildHistory(messages);
    expect(items).toEqual([
      { type: "tool", name: "bash", output: "error output", isError: true },
    ]);
  });

  test("tool call with no matching result produces empty output", () => {
    const messages: AgentMessage[] = [
      assistantMsg([{ type: "toolCall", id: "orphan", name: "read", arguments: {} }]),
    ];
    const items = buildHistory(messages);
    expect(items).toEqual([
      { type: "tool", name: "read", output: "", isError: false },
    ]);
  });

  test("tool result with multiple text blocks is joined without separator", () => {
    const messages: AgentMessage[] = [
      assistantMsg([{ type: "toolCall", id: "c1", name: "read", arguments: {} }]),
      toolResult("c1", ["line one\n", "line two"]),
    ];
    const items = buildHistory(messages);
    expect(items).toEqual([
      { type: "tool", name: "read", output: "line one\nline two", isError: false },
    ]);
  });

  test("thinking blocks in assistant message produce a thinking item", () => {
    const items = buildHistory([
      assistantMsg([{ type: "thinking", thinking: "internal thought" }]),
    ]);
    expect(items).toEqual([{ type: "thinking", text: "internal thought" }]);
  });

  test("thinking block with only whitespace is skipped", () => {
    const items = buildHistory([
      assistantMsg([{ type: "thinking", thinking: "   " }]),
    ]);
    expect(items).toEqual([]);
  });

  test("toolResult messages are skipped as top-level items", () => {
    // Tool results are indexed for pairing — they should not become standalone items.
    const messages: AgentMessage[] = [
      toolResult("some-id", ["result"]),
    ];
    expect(buildHistory(messages)).toEqual([]);
  });

  test("mixed conversation produces items in order", () => {
    const messages: AgentMessage[] = [
      userMsg("what is 2+2?"),
      assistantMsg([
        { type: "thinking", thinking: "let me think" },
        { type: "toolCall", id: "c1", name: "calculate", arguments: {} },
      ]),
      toolResult("c1", ["4"]),
      assistantMsg([
        { type: "thinking", thinking: "got the result" },
        { type: "text", text: "The answer is 4." },
      ]),
    ];
    const items = buildHistory(messages);
    expect(items).toEqual([
      { type: "user", text: "what is 2+2?" },
      { type: "thinking", text: "let me think" },
      { type: "tool", name: "calculate", output: "4", isError: false },
      { type: "thinking", text: "got the result" },
      { type: "assistant_text", text: "The answer is 4." },
    ]);
  });

  test("multiple assistant blocks in one message produce multiple items", () => {
    const items = buildHistory([
      assistantMsg([
        { type: "text", text: "first" },
        { type: "toolCall", id: "c2", name: "search", arguments: {} },
        { type: "text", text: "second" },
      ]),
      toolResult("c2", ["results"]),
    ]);
    expect(items).toEqual([
      { type: "assistant_text", text: "first" },
      { type: "tool", name: "search", output: "results", isError: false },
      { type: "assistant_text", text: "second" },
    ]);
  });

  test("tool results appearing before their call are still paired correctly", () => {
    // buildHistory pre-indexes tool results, so order doesn't matter.
    const messages: AgentMessage[] = [
      toolResult("early", ["pre-indexed"]),
      assistantMsg([{ type: "toolCall", id: "early", name: "fetch", arguments: {} }]),
    ];
    const items = buildHistory(messages);
    expect(items).toEqual([
      { type: "tool", name: "fetch", output: "pre-indexed", isError: false },
    ]);
  });
});
