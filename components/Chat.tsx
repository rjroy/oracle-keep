"use client";

import {
  useReducer,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { marked } from "marked";
import type { HistoryItem } from "@/types/chat";

marked.use({ breaks: true, gfm: true });

// ── Types ──────────────────────────────────────────────────────────────────────

type ToolEntry = {
  id: string;       // toolCallId — unique even when the same tool runs twice
  name: string;
  label: string;
  output: string;
  status: "running" | "ok" | "error";
  expanded: boolean;
};

type Message =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string; streaming: boolean }
  | { id: string; kind: "tool_group"; tools: ToolEntry[] }
  | { id: string; kind: "compaction"; done: boolean }
  | { id: string; kind: "error"; text: string };

type Action =
  | { type: "HISTORY_LOADED"; messages: Message[] }
  | { type: "ADD_USER"; id: string; text: string }
  | { type: "ADD_ASSISTANT"; id: string }
  | { type: "APPEND_TEXT"; id: string; delta: string }
  | { type: "FINALIZE_ASSISTANT"; id: string }
  | { type: "ADD_TOOL_GROUP"; id: string }
  | { type: "ADD_TOOL"; groupId: string; tool: ToolEntry }
  | { type: "SET_TOOL_OUTPUT"; groupId: string; toolId: string; text: string }
  | { type: "FINALIZE_TOOL"; groupId: string; toolId: string; isError: boolean }
  | { type: "TOGGLE_TOOL"; groupId: string; toolId: string }
  | { type: "ADD_COMPACTION"; id: string }
  | { type: "FINALIZE_COMPACTION"; id: string }
  | { type: "REMOVE"; id: string }
  | { type: "ADD_ERROR"; id: string; text: string };

// ── Reducer ────────────────────────────────────────────────────────────────────

function reducer(state: Message[], action: Action): Message[] {
  switch (action.type) {
    case "HISTORY_LOADED":
      return action.messages;

    case "ADD_USER":
      return [...state, { id: action.id, kind: "user", text: action.text }];

    case "ADD_ASSISTANT":
      return [...state, { id: action.id, kind: "assistant", text: "", streaming: true }];

    case "APPEND_TEXT":
      return state.map((m) =>
        m.id === action.id && m.kind === "assistant"
          ? { ...m, text: m.text + action.delta }
          : m
      );

    case "FINALIZE_ASSISTANT":
      return state.map((m) =>
        m.id === action.id && m.kind === "assistant"
          ? { ...m, streaming: false }
          : m
      );

    case "ADD_TOOL_GROUP":
      return [...state, { id: action.id, kind: "tool_group", tools: [] }];

    case "ADD_TOOL":
      return state.map((m) =>
        m.id === action.groupId && m.kind === "tool_group"
          ? { ...m, tools: [...m.tools, action.tool] }
          : m
      );

    case "SET_TOOL_OUTPUT":
      return state.map((m) =>
        m.id === action.groupId && m.kind === "tool_group"
          ? {
              ...m,
              tools: m.tools.map((t) =>
                t.id === action.toolId ? { ...t, output: action.text } : t
              ),
            }
          : m
      );

    case "FINALIZE_TOOL":
      return state.map((m) =>
        m.id === action.groupId && m.kind === "tool_group"
          ? {
              ...m,
              tools: m.tools.map((t) =>
                t.id === action.toolId
                  ? { ...t, status: action.isError ? "error" : "ok" }
                  : t
              ),
            }
          : m
      );

    case "TOGGLE_TOOL":
      return state.map((m) =>
        m.id === action.groupId && m.kind === "tool_group"
          ? {
              ...m,
              tools: m.tools.map((t) =>
                t.id === action.toolId ? { ...t, expanded: !t.expanded } : t
              ),
            }
          : m
      );

    case "ADD_COMPACTION":
      return [...state, { id: action.id, kind: "compaction", done: false }];

    case "FINALIZE_COMPACTION":
      return state.map((m) =>
        m.id === action.id && m.kind === "compaction" ? { ...m, done: true } : m
      );

    case "REMOVE":
      return state.filter((m) => m.id !== action.id);

    case "ADD_ERROR":
      return [...state, { id: action.id, kind: "error", text: action.text }];

    default:
      return state;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function renderMarkdown(text: string): string {
  const result = marked.parse(text);
  return typeof result === "string" ? result : "";
}

function historyToMessages(items: HistoryItem[]): Message[] {
  const messages: Message[] = [];
  let currentGroup: (Message & { kind: "tool_group" }) | null = null;

  for (const item of items) {
    if (item.type === "user") {
      currentGroup = null;
      messages.push({ id: uid(), kind: "user", text: item.text });
    } else if (item.type === "assistant_text") {
      currentGroup = null;
      messages.push({ id: uid(), kind: "assistant", text: item.text, streaming: false });
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="msg user">
      <div className="avatar">👤</div>
      <div className="bubble">
        {text.split("\n").map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  );
}

function AssistantBubble({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  return (
    <div className="msg assistant">
      <div className="avatar">⬡</div>
      <div className="bubble">
        <span dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
        {streaming && <span className="cursor" />}
      </div>
    </div>
  );
}

function ToolGroup({
  message,
  onToggle,
}: {
  message: Message & { kind: "tool_group" };
  onToggle: (toolId: string) => void;
}) {
  return (
    <div className="tool-group">
      {message.tools.map((tool) => (
        <div key={tool.id} className="tool-call">
          <div className="tool-header" onClick={() => onToggle(tool.id)}>
            <span className="tool-icon">
              {tool.status === "running" ? "🔧" : tool.status === "ok" ? "✅" : "❌"}
            </span>
            <span className="tool-name">{tool.label}</span>
            <span className={`tool-status ${tool.status}`}>
              {tool.status === "running"
                ? "running…"
                : tool.status === "ok"
                  ? "✓ done"
                  : "✗ error"}
            </span>
            <span className={`tool-toggle ${tool.expanded ? "open" : ""}`}>▶</span>
          </div>
          {tool.expanded && (
            <div className="tool-output">{tool.output}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function CompactionBanner({ done }: { done: boolean }) {
  return (
    <div className={`compaction-banner${done ? " resolved" : ""}`}>
      {done ? (
        "✓ Context compacted"
      ) : (
        <>
          <div className="compaction-spinner" />
          Compacting context…
        </>
      )}
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return <div className="error-banner">⚠ {text}</div>;
}

// ── Chat ───────────────────────────────────────────────────────────────────────

export default function Chat({ cwd }: { cwd: string }) {
  const [messages, dispatch] = useReducer(reducer, []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Streaming state — refs avoid stale closures without triggering re-renders.
  const currentAssistantId = useRef<string | null>(null);
  const currentToolGroupId = useRef<string | null>(null);
  const currentToolCallId = useRef<string | null>(null);
  const currentCompactionId = useRef<string | null>(null);

  // Load history on mount.
  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then(({ items }: { items: HistoryItem[] }) => {
        if (items?.length > 0) {
          dispatch({ type: "HISTORY_LOADED", messages: historyToMessages(items) });
        }
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, []);

  // Scroll to bottom when messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setBusy(true);
    requestAnimationFrame(resizeTextarea);

    // Reset streaming state.
    currentAssistantId.current = null;
    currentToolGroupId.current = null;
    currentToolCallId.current = null;
    currentCompactionId.current = null;

    dispatch({ type: "ADD_USER", id: uid(), text });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        dispatch({ type: "ADD_ERROR", id: uid(), text: err.error ?? "Request failed" });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          switch (event.type) {
            case "text": {
              if (!currentAssistantId.current) {
                const id = uid();
                currentAssistantId.current = id;
                currentToolGroupId.current = null; // next tool after text → new group
                dispatch({ type: "ADD_ASSISTANT", id });
              }
              dispatch({
                type: "APPEND_TEXT",
                id: currentAssistantId.current,
                delta: event.delta as string,
              });
              break;
            }
            case "tool_start": {
              currentAssistantId.current = null; // next text after tools → new bubble
              if (!currentToolGroupId.current) {
                const id = uid();
                currentToolGroupId.current = id;
                dispatch({ type: "ADD_TOOL_GROUP", id });
              }
              currentToolCallId.current = event.id as string;
              dispatch({
                type: "ADD_TOOL",
                groupId: currentToolGroupId.current,
                tool: {
                  id: event.id as string,
                  name: event.name as string,
                  label: (event.label as string) || (event.name as string),
                  output: "",
                  status: "running",
                  expanded: false,
                },
              });
              break;
            }
            case "tool_update": {
              if (currentToolGroupId.current && currentToolCallId.current) {
                dispatch({
                  type: "SET_TOOL_OUTPUT",
                  groupId: currentToolGroupId.current,
                  toolId: currentToolCallId.current,
                  text: event.text as string,
                });
              }
              break;
            }
            case "tool_end": {
              if (currentToolGroupId.current) {
                dispatch({
                  type: "FINALIZE_TOOL",
                  groupId: currentToolGroupId.current,
                  toolId: event.id as string,
                  isError: event.isError as boolean,
                });
              }
              currentToolCallId.current = null;
              break;
            }
            case "compaction_start": {
              const id = uid();
              currentCompactionId.current = id;
              dispatch({ type: "ADD_COMPACTION", id });
              break;
            }
            case "compaction_end": {
              if (currentCompactionId.current) {
                const id = currentCompactionId.current;
                dispatch({ type: "FINALIZE_COMPACTION", id });
                setTimeout(() => dispatch({ type: "REMOVE", id }), 3000);
                currentCompactionId.current = null;
              }
              break;
            }
            case "done": {
              if (currentAssistantId.current) {
                dispatch({ type: "FINALIZE_ASSISTANT", id: currentAssistantId.current });
              }
              break;
            }
            case "error": {
              dispatch({ type: "ADD_ERROR", id: uid(), text: event.message as string });
              break;
            }
          }
        }
      }
    } catch (err) {
      dispatch({
        type: "ADD_ERROR",
        id: uid(),
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
    }
  }, [input, busy, resizeTextarea]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const showWelcome = historyLoaded && messages.length === 0;

  return (
    <>
      <header>
        <div className="logo">⬡</div>
        <h1>Oracle Keep</h1>
        <div id="status-dot" className={busy ? "busy" : ""} />
        <span className="cwd">{cwd}</span>
      </header>

      <div id="messages">
        {showWelcome && (
          <div className="welcome">
            <div className="icon">🤖</div>
            <h2>Oracle is ready</h2>
            <p>
              Ask anything. The agent can read, write, and run commands in{" "}
              <code>{cwd}</code>.
            </p>
            <p style={{ marginTop: "4px", fontSize: "12px" }}>
              Shift+Enter for new line · Enter to send
            </p>
          </div>
        )}

        {messages.map((msg) => {
          switch (msg.kind) {
            case "user":
              return <UserBubble key={msg.id} text={msg.text} />;
            case "assistant":
              return (
                <AssistantBubble
                  key={msg.id}
                  text={msg.text}
                  streaming={msg.streaming}
                />
              );
            case "tool_group":
              return (
                <ToolGroup
                  key={msg.id}
                  message={msg}
                  onToggle={(toolId) =>
                    dispatch({ type: "TOGGLE_TOOL", groupId: msg.id, toolId })
                  }
                />
              );
            case "compaction":
              return <CompactionBanner key={msg.id} done={msg.done} />;
            case "error":
              return <ErrorBanner key={msg.id} text={msg.text} />;
          }
        })}

        <div ref={messagesEndRef} />
      </div>

      <div id="input-area">
        <textarea
          ref={textareaRef}
          id="input"
          rows={1}
          placeholder="Ask the oracle anything…"
          autoFocus
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            resizeTextarea();
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          id="send"
          disabled={busy || !input.trim()}
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </>
  );
}
