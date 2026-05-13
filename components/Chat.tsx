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
import Image from "next/image";
import {
  MenuIcon,
  PanelLeftIcon,
  SunIcon,
  MoonIcon,
  SendIcon,
  ScrollIcon,
  LanternIcon,
  ChevIcon,
  Flourish,
} from "@/components/icons";

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

// ── Types ──────────────────────────────────────────────────────────────────────

type Toast = {
  id: string;
  message: string;
  level: "info" | "warning" | "error";
};

type ToolEntry = {
  id: string;
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
      return [
        ...state,
        { id: action.id, kind: "assistant", text: "", streaming: true },
      ];

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
        m.id === action.id && m.kind === "compaction"
          ? { ...m, done: true }
          : m
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

/**
 * Render markdown to HTML. When streaming=true, injects a `.streaming-caret`
 * span before the final closing tag so the caret appears inline with the text.
 */
function renderMarkdown(text: string, streaming = false): string {
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

function historyToMessages(items: HistoryItem[]): Message[] {
  const messages: Message[] = [];
  let currentGroup: (Message & { kind: "tool_group" }) | null = null;

  for (const item of items) {
    if (item.type === "user") {
      currentGroup = null;
      messages.push({ id: uid(), kind: "user", text: item.text });
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

// ── SSE stream processor ───────────────────────────────────────────────────────
// Shared by sendMessage (POST) and the reconnect path (GET). Reads events from
// `body` until the stream closes and dispatches them into the reducer.

type StreamHandlers = {
  dispatch: React.Dispatch<Action>;
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
  setStatuses: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  setWidgets: React.Dispatch<React.SetStateAction<Map<string, string[]>>>;
  assistantIdRef: React.MutableRefObject<string | null>;
  toolGroupIdRef: React.MutableRefObject<string | null>;
  toolCallIdRef: React.MutableRefObject<string | null>;
  compactionIdRef: React.MutableRefObject<string | null>;
};

async function processEventStream(
  body: ReadableStream<Uint8Array>,
  handlers: StreamHandlers,
): Promise<void> {
  const {
    dispatch,
    setToasts,
    setStatuses,
    setWidgets,
    assistantIdRef,
    toolGroupIdRef,
    toolCallIdRef,
    compactionIdRef,
  } = handlers;

  const reader = body.getReader();
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
          if (!assistantIdRef.current) {
            const id = uid();
            assistantIdRef.current = id;
            toolGroupIdRef.current = null;
            dispatch({ type: "ADD_ASSISTANT", id });
          }
          dispatch({
            type: "APPEND_TEXT",
            id: assistantIdRef.current,
            delta: event.delta as string,
          });
          break;
        }
        case "tool_start": {
          assistantIdRef.current = null;
          if (!toolGroupIdRef.current) {
            const id = uid();
            toolGroupIdRef.current = id;
            dispatch({ type: "ADD_TOOL_GROUP", id });
          }
          toolCallIdRef.current = event.id as string;
          dispatch({
            type: "ADD_TOOL",
            groupId: toolGroupIdRef.current,
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
          if (toolGroupIdRef.current && toolCallIdRef.current) {
            dispatch({
              type: "SET_TOOL_OUTPUT",
              groupId: toolGroupIdRef.current,
              toolId: toolCallIdRef.current,
              text: event.text as string,
            });
          }
          break;
        }
        case "tool_end": {
          if (toolGroupIdRef.current) {
            dispatch({
              type: "FINALIZE_TOOL",
              groupId: toolGroupIdRef.current,
              toolId: event.id as string,
              isError: event.isError as boolean,
            });
          }
          toolCallIdRef.current = null;
          break;
        }
        case "compaction_start": {
          const id = uid();
          compactionIdRef.current = id;
          dispatch({ type: "ADD_COMPACTION", id });
          break;
        }
        case "compaction_end": {
          if (compactionIdRef.current) {
            const id = compactionIdRef.current;
            dispatch({ type: "FINALIZE_COMPACTION", id });
            setTimeout(() => dispatch({ type: "REMOVE", id }), 3000);
            compactionIdRef.current = null;
          }
          break;
        }
        case "done": {
          if (assistantIdRef.current) {
            dispatch({
              type: "FINALIZE_ASSISTANT",
              id: assistantIdRef.current,
            });
          }
          break;
        }
        case "notify": {
          const id = uid();
          const level = (event.level as Toast["level"]) ?? "info";
          setToasts((prev) => [...prev, { id, message: event.message as string, level }]);
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
          break;
        }
        case "status": {
          const key = event.key as string;
          const text = event.text as string | null;
          setStatuses((prev) => {
            const next = new Map(prev);
            if (text == null) next.delete(key);
            else next.set(key, text);
            return next;
          });
          break;
        }
        case "widget": {
          const key = event.key as string;
          const lines = event.lines as string[] | null;
          setWidgets((prev) => {
            const next = new Map(prev);
            if (lines == null) next.delete(key);
            else next.set(key, lines);
            return next;
          });
          break;
        }
        case "working_message":
        case "working_visible":
          // Acknowledged — no web equivalent yet.
          break;
        case "error": {
          dispatch({
            type: "ADD_ERROR",
            id: uid(),
            text: event.message as string,
          });
          break;
        }
      }
    }
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function UserMessage({ text }: { text: string }) {
  return (
    <div className="msg">
      <div className="msg-avatar user">Y</div>
      <div className="msg-body">
        <div className="msg-head">
          <span className="msg-name">You</span>
          <span className="msg-role">you</span>
        </div>
        <div className="prose">
          {text.split("\n").map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  return (
    <div className="msg">
      <div className="msg-avatar oracle">O</div>
      <div className="msg-body">
        <div className="msg-head">
          <span className="msg-name">The Oracle</span>
          <span className="msg-role">pi agent</span>
        </div>
        <div
          className="prose"
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(text, streaming),
          }}
        />
        {!streaming && text && (
          <div className="msg-actions">
            <button
              className="msg-action"
              onClick={() => navigator.clipboard.writeText(text)}
            >
              Copy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCard({
  tool,
  onToggle,
}: {
  tool: ToolEntry;
  onToggle: () => void;
}) {
  const isActive = tool.status === "running";
  const isOpen = tool.expanded;
  const statusClass =
    tool.status === "running"
      ? "pending"
      : tool.status === "ok"
        ? "done"
        : "error";
  const statusLabel =
    tool.status === "running"
      ? "in progress"
      : tool.status === "ok"
        ? "returned"
        : "failed";

  return (
    <div
      className={`tool-card ${isOpen ? "is-open" : ""} ${isActive ? "is-active" : ""}`}
    >
      <div
        className="tool-card-head"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <div className="tool-icon-wrap">⚙</div>
        <div className="tool-card-body-wrap">
          <div className="tool-card-name">{tool.label}</div>
          <div className="tool-card-sub">
            {isActive
              ? "working…"
              : tool.output
                ? tool.output.slice(0, 80)
                : "no output"}
          </div>
        </div>
        <span className={`tool-card-status ${statusClass}`}>{statusLabel}</span>
        <ChevIcon size={14} className="tool-card-chev" />
      </div>

      {isOpen && (
        <div className="tool-card-body">
          {isActive ? (
            <div className="shimmer" />
          ) : tool.output ? (
            <>
              <div className="tool-section-title">Output</div>
              <div className="tool-output">{tool.output}</div>
            </>
          ) : null}
        </div>
      )}
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
        <ToolCard key={tool.id} tool={tool} onToggle={() => onToggle(tool.id)} />
      ))}
    </div>
  );
}

function CompactionMarker({ done }: { done: boolean }) {
  if (!done) {
    return (
      <div className="compaction-banner">
        <div className="compaction-spinner" />
        The archivist is condensing…
      </div>
    );
  }

  return (
    <div>
      <div className="archive-mark">
        <ScrollIcon size={14} className="scroll-icon" />
        <span>The archivist condensed</span>
      </div>
      <div className="archive-card">
        <div className="archive-card-head">
          <ScrollIcon size={12} />
          Context archive
        </div>
        <p className="archive-card-summary">
          Older messages were condensed to free up the context window. The
          conversation continues from here.
        </p>
      </div>
    </div>
  );
}

function EmptyState({ cwd }: { cwd: string }) {
  return (
    <div className="empty">
      <Image
        className="empty-shield empty-shield--light"
        src="/logo-shield-light.png"
        alt=""
        width={72}
        height={72}
      />
      <Image
        className="empty-shield empty-shield--dark"
        src="/logo-shield-dark.png"
        alt=""
        width={72}
        height={72}
      />
      <h2 className="empty-title">A new page.</h2>
      <p className="empty-lede">
        The Oracle is ready. Ask anything — the agent can read, write, and run
        commands in <code>{cwd}</code>.
      </p>
    </div>
  );
}

function ToastList({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-list">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.level}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function StatusBar({ statuses }: { statuses: Map<string, string> }) {
  if (statuses.size === 0) return null;
  return (
    <div className="ext-status-bar">
      {Array.from(statuses.entries()).map(([key, text]) => (
        <span key={key} className="ext-status-item">{text}</span>
      ))}
    </div>
  );
}

function WidgetPanel({ widgets }: { widgets: Map<string, string[]> }) {
  if (widgets.size === 0) return null;
  return (
    <div className="widget-panel">
      {Array.from(widgets.entries()).map(([key, lines]) => (
        <div key={key} className="widget-block">
          {lines.map((line, i) => (
            <div key={i} className="widget-line">{line}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Chat ───────────────────────────────────────────────────────────────────────

export default function Chat({ cwd }: { cwd: string }) {
  const [messages, dispatch] = useReducer(reducer, []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [statuses, setStatuses] = useState<Map<string, string>>(new Map());
  const [widgets, setWidgets] = useState<Map<string, string[]>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const convoScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Streaming state — refs avoid stale closures without triggering re-renders.
  const currentAssistantId = useRef<string | null>(null);
  const currentToolGroupId = useRef<string | null>(null);
  const currentToolCallId = useRef<string | null>(null);
  const currentCompactionId = useRef<string | null>(null);

  // Sync theme to <html> element so CSS variables apply globally.
  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);

  // Load history on mount, then check whether the agent is mid-turn.
  // If it is, open a GET /api/chat SSE stream to receive the buffered + live events.
  useEffect(() => {
    const streamHandlers = (): StreamHandlers => ({
      dispatch,
      setToasts,
      setStatuses,
      setWidgets,
      assistantIdRef: currentAssistantId,
      toolGroupIdRef: currentToolGroupId,
      toolCallIdRef: currentToolCallId,
      compactionIdRef: currentCompactionId,
    });

    async function init() {
      // Load conversation history.
      try {
        const r = await fetch("/api/history");
        const { items }: { items: HistoryItem[] } = await r.json();
        if (items?.length > 0) {
          dispatch({ type: "HISTORY_LOADED", messages: historyToMessages(items) });
          setShowResumeBanner(true);
        }
      } catch {
        // History load failure is non-fatal.
      }

      setHistoryLoaded(true);

      // Check whether the agent is already processing (page was closed mid-turn).
      try {
        const statusRes = await fetch("/api/status");
        const { isProcessing } = await statusRes.json();
        if (!isProcessing) return;

        // Agent is still running — reconnect to its event stream.
        setBusy(true);
        setShowResumeBanner(false);
        setShowReconnectBanner(true);
        currentAssistantId.current = null;
        currentToolGroupId.current = null;
        currentToolCallId.current = null;
        currentCompactionId.current = null;

        const reconnect = await fetch("/api/chat");
        if (reconnect.ok && reconnect.body) {
          await processEventStream(reconnect.body, streamHandlers());
        }
      } catch {
        // Reconnect failure is non-fatal — the user can send a new message.
      } finally {
        setBusy(false);
      }
    }

    init();
  }, []);

  // Hydrate widget state on mount so refreshes and cross-device loads restore the panel.
  useEffect(() => {
    fetch("/api/widgets")
      .then((r) => r.json())
      .then((snapshot: Record<string, string[]>) => {
        const entries = Object.entries(snapshot);
        if (entries.length > 0) {
          setWidgets(new Map(entries));
        }
      })
      .catch(() => {/* widgets stay empty — non-fatal */});
  }, []);

  // Track whether the user is pinned to the bottom of the conversation.
  const handleConvoScroll = useCallback(() => {
    const el = convoScrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  // Scroll to bottom when messages change, only if pinned.
  // Use instant scroll — smooth animation queued repeatedly during streaming causes jitter.
  useEffect(() => {
    if (!isAtBottomRef.current) return;
    const el = convoScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
    setShowResumeBanner(false);
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
        dispatch({
          type: "ADD_ERROR",
          id: uid(),
          text: err.error ?? "Request failed",
        });
        return;
      }

      await processEventStream(res.body!, {
        dispatch,
        setToasts,
        setStatuses,
        setWidgets,
        assistantIdRef: currentAssistantId,
        toolGroupIdRef: currentToolGroupId,
        toolCallIdRef: currentToolCallId,
        compactionIdRef: currentCompactionId,
      });
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
    <div className="app">
      <ToastList toasts={toasts} />
      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="tb-left">
          <button
            className="icon-btn"
            onClick={() => setRailCollapsed((c) => !c)}
            aria-label="Toggle archive"
          >
            {railCollapsed ? (
              <MenuIcon size={18} />
            ) : (
              <PanelLeftIcon size={18} />
            )}
          </button>

          <div className="tb-brand">
            <Image
              className="tb-shield tb-shield--light"
              src="/logo-shield-light.png"
              alt=""
              width={26}
              height={26}
            />
            <Image
              className="tb-shield tb-shield--dark"
              src="/logo-shield-dark.png"
              alt=""
              width={26}
              height={26}
            />
            <div className="tb-word">
              Oracle <span className="em">Keep</span>
            </div>
          </div>

          <div className="tb-divider" />

          <div className="tb-thread">
            {busy && <span className="tb-lantern" />}
            <span>{cwd}</span>
          </div>
        </div>

        <div className="tb-right">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
            title={theme === "dark" ? "Light the day" : "Dim the lanterns"}
          >
            {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </div>
      </header>

      {/* ── Left rail ── */}
      <aside className={`rail ${railCollapsed ? "collapsed" : ""}`}>
        <div className="rail-toggle-wrap">
          <button
            className="icon-btn"
            onClick={() => setRailCollapsed((c) => !c)}
            aria-label={railCollapsed ? "Expand archive" : "Collapse archive"}
          >
            <PanelLeftIcon size={18} />
          </button>
        </div>

        {!railCollapsed && (
          <div className="rail-eyebrow">Scrolls</div>
        )}

        <div className="rail-scroll">
          {!railCollapsed && (
            <p
              style={{
                padding: "24px 16px",
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: 13,
                color: "var(--fg-3)",
                textAlign: "center",
                margin: 0,
              }}
            >
              The archivist keeps no scrolls yet.
            </p>
          )}
        </div>

        <div className="rail-foot">
          {railCollapsed ? (
            <span
              className="persona-avatar oracle"
              style={{ width: 22, height: 22, fontSize: 10 }}
            >
              O
            </span>
          ) : (
            <div className="persona-chip">
              <span className="persona-avatar oracle">O</span>
              <span>
                <span className="persona-name">The Oracle</span>
                <span className="persona-role">pi agent</span>
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* ── Stage ── */}
      <main className="stage">
        <div className="convo-wrap">
          {showResumeBanner && (
            <div className="resume-banner">
              <LanternIcon size={16} className="lantern-icon" />
              <span>
                Welcome back. Your consultation resumed where you left off.
              </span>
              <button onClick={() => setShowResumeBanner(false)}>Dismiss</button>
            </div>
          )}

          {showReconnectBanner && (
            <div className="resume-banner">
              <LanternIcon size={16} className="lantern-icon" />
              <span>
                The Oracle kept working while you were away. Catching up now…
              </span>
              <button onClick={() => setShowReconnectBanner(false)}>Dismiss</button>
            </div>
          )}

          <div className="convo-scroll" ref={convoScrollRef} onScroll={handleConvoScroll}>
            <div className="convo">
              {showWelcome && <EmptyState cwd={cwd} />}

              {messages.map((msg) => {
                switch (msg.kind) {
                  case "user":
                    return <UserMessage key={msg.id} text={msg.text} />;
                  case "assistant":
                    return (
                      <AssistantMessage
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
                          dispatch({
                            type: "TOGGLE_TOOL",
                            groupId: msg.id,
                            toolId,
                          })
                        }
                      />
                    );
                  case "compaction":
                    return (
                      <CompactionMarker key={msg.id} done={msg.done} />
                    );
                  case "error":
                    return (
                      <div key={msg.id} className="error-banner">
                        ⚠ {msg.text}
                      </div>
                    );
                }
              })}

              <div className="flourish-wrap" aria-hidden="true">
                <Flourish />
              </div>
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ── Composer ── */}
          <div className="composer">
            <WidgetPanel widgets={widgets} />
            <StatusBar statuses={statuses} />
            <div className="composer-inner">
              <div className="composer-box">
                <textarea
                  ref={textareaRef}
                  className="composer-input"
                  placeholder={
                    busy
                      ? "The Oracle is speaking…"
                      : "Ask, or set out on a new line…"
                  }
                  value={input}
                  rows={1}
                  disabled={busy}
                  autoFocus
                  onChange={(e) => {
                    setInput(e.target.value);
                    resizeTextarea();
                  }}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="send-btn"
                  onClick={sendMessage}
                  disabled={busy || !input.trim()}
                  title="Send (↵)"
                  aria-label="Send"
                >
                  <SendIcon size={16} />
                </button>
              </div>
              <div className="composer-foot">
                <div className="composer-shortcuts">
                  Speaking to <em style={{ color: "var(--fg-2)" }}>The Oracle</em>
                  {" · "}
                  <kbd>↵</kbd> to send, <kbd>⇧↵</kbd> for a new line
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
