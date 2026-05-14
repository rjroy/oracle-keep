"use client";

import {
  useReducer,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { marked } from "marked";
import { useRouter } from "next/navigation";
import type { HistoryItem } from "@/types/chat";
import type { SessionMeta } from "@/types/session";
import Image from "next/image";
import {
  MenuIcon,
  SunIcon,
  MoonIcon,
  SendIcon,
  ScrollIcon,
  LanternIcon,
  ChevIcon,
  Flourish,
} from "@/components/icons";
import { useSidebar } from "@/components/sidebar-context";

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
  | { id: string; kind: "thinking"; text: string; streaming: boolean; expanded: boolean }
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
  | { type: "ADD_THINKING"; id: string }
  | { type: "APPEND_THINKING"; id: string; delta: string }
  | { type: "FINALIZE_THINKING"; id: string }
  | { type: "TOGGLE_THINKING"; id: string }
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

    case "ADD_THINKING":
      return [
        ...state,
        { id: action.id, kind: "thinking", text: "", streaming: true, expanded: false },
      ];

    case "APPEND_THINKING":
      return state.map((m) =>
        m.id === action.id && m.kind === "thinking"
          ? { ...m, text: m.text + action.delta }
          : m
      );

    case "FINALIZE_THINKING":
      return state.map((m) =>
        m.id === action.id && m.kind === "thinking"
          ? { ...m, streaming: false }
          : m
      );

    case "TOGGLE_THINKING":
      return state.map((m) =>
        m.id === action.id && m.kind === "thinking"
          ? { ...m, expanded: !m.expanded }
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

// ── SSE stream processor ───────────────────────────────────────────────────────
// Shared by sendMessage (POST) and the reconnect path (GET). Reads events from
// `body` until the stream closes and dispatches them into the reducer.

type StreamHandlers = {
  dispatch: React.Dispatch<Action>;
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
  setStatuses: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  setWidgets: React.Dispatch<React.SetStateAction<Map<string, string[]>>>;
  assistantIdRef: React.MutableRefObject<string | null>;
  thinkingIdRef: React.MutableRefObject<string | null>;
  toolGroupIdRef: React.MutableRefObject<string | null>;
  toolCallIdRef: React.MutableRefObject<string | null>;
  compactionIdRef: React.MutableRefObject<string | null>;
  onNavigate?: (url: string) => void;
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
    thinkingIdRef,
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
        case "thinking": {
          if (!thinkingIdRef.current) {
            const id = uid();
            thinkingIdRef.current = id;
            dispatch({ type: "ADD_THINKING", id });
          }
          dispatch({
            type: "APPEND_THINKING",
            id: thinkingIdRef.current,
            delta: event.delta as string,
          });
          break;
        }
        case "text": {
          // Finalize any in-progress thinking block before the assistant speaks.
          if (thinkingIdRef.current) {
            dispatch({ type: "FINALIZE_THINKING", id: thinkingIdRef.current });
            thinkingIdRef.current = null;
          }
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
          if (assistantIdRef.current) {
            dispatch({ type: "FINALIZE_ASSISTANT", id: assistantIdRef.current });
            assistantIdRef.current = null;
          }
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
          if (toolGroupIdRef.current && event.id) {
            dispatch({
              type: "SET_TOOL_OUTPUT",
              groupId: toolGroupIdRef.current,
              toolId: event.id as string,
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
          // Only clear the ref if it still points to this tool —
          // parallel tool calls may have already advanced it.
          if (toolCallIdRef.current === (event.id as string)) {
            toolCallIdRef.current = null;
          }
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
        case "navigate": {
          handlers.onNavigate?.(event.url as string);
          break;
        }
        case "done": {
          // Finalize thinking if it never transitioned to text (thinking-only turn).
          if (thinkingIdRef.current) {
            dispatch({ type: "FINALIZE_THINKING", id: thinkingIdRef.current });
            thinkingIdRef.current = null;
          }
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

function ThinkingCard({
  message,
  onToggle,
}: {
  message: Message & { kind: "thinking" };
  onToggle: () => void;
}) {
  const isOpen = message.expanded;
  const wordCount = message.text.trim().split(/\s+/).filter(Boolean).length;
  const summary = message.streaming
    ? "reasoning…"
    : wordCount > 0
      ? `${wordCount} words`
      : "no content";

  return (
    <div className={`thinking-card ${isOpen ? "is-open" : ""} ${message.streaming ? "is-active" : ""}`}>
      <div
        className="thinking-card-head"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <div className="thinking-icon-wrap">✦</div>
        <div className="tool-card-body-wrap">
          <div className="tool-card-name">Thinking</div>
          <div className="tool-card-sub">{summary}</div>
        </div>
        <span className={`tool-card-status ${message.streaming ? "pending" : "done"}`}>
          {message.streaming ? "reasoning" : "complete"}
        </span>
        <ChevIcon size={14} className="tool-card-chev" />
      </div>

      {isOpen && (
        <div className="tool-card-body">
          {message.streaming && !message.text ? (
            <div className="shimmer" />
          ) : (
            <>
              <div className="tool-section-title">Reasoning trace</div>
              <div className="tool-output thinking-output">{message.text}</div>
            </>
          )}
        </div>
      )}
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

const WIDGET_MINIMIZED_KEY = "oracle-keep:widgets-minimized";

function WidgetPanel({ widgets }: { widgets: Map<string, string[]> }) {
  const [minimized, setMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WIDGET_MINIMIZED_KEY) === "true";
    } catch {
      return false;
    }
  });

  if (widgets.size === 0) return null;

  const toggle = () => {
    const next = !minimized;
    setMinimized(next);
    try {
      localStorage.setItem(WIDGET_MINIMIZED_KEY, String(next));
    } catch {
      // localStorage unavailable — state still works in-memory
    }
  };

  return (
    <div className="widget-panel">
      <div className="widget-panel-head">
        <span className="widget-panel-label">
          Widgets
          {minimized && (
            <span className="widget-panel-count">{widgets.size}</span>
          )}
        </span>
        <button
          className="icon-btn widget-panel-toggle"
          onClick={toggle}
          aria-label={minimized ? "Expand widgets" : "Minimize widgets"}
          title={minimized ? "Expand widgets" : "Minimize widgets"}
        >
          <ChevIcon
            size={13}
            className={`widget-panel-chev ${minimized ? "" : "is-open"}`}
          />
        </button>
      </div>
      {!minimized && Array.from(widgets.entries()).map(([key, lines]) => (
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

export default function Chat({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { toggle: toggleSidebar } = useSidebar();
  const [messages, dispatch] = useReducer(reducer, []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [statuses, setStatuses] = useState<Map<string, string>>(new Map());
  const [widgets, setWidgets] = useState<Map<string, string[]>>(new Map());
  const [sessionMeta, setSessionMeta] = useState<SessionMeta>({ commands: [] });
  // Slash command autocomplete state.
  const [slashMenu, setSlashMenu] = useState<{ open: boolean; index: number }>(
    { open: false, index: 0 },
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const convoScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerInnerRef = useRef<HTMLDivElement>(null);

  // Fixed position for the slash menu portal. Recomputed whenever the menu
  // opens so it tracks the composer if the window is resized between opens.
  const [slashMenuPos, setSlashMenuPos] = useState<{
    bottom: number;
    left: number;
    width: number;
  } | null>(null);

  // Streaming state — refs avoid stale closures without triggering re-renders.
  const currentThinkingId = useRef<string | null>(null);
  const currentAssistantId = useRef<string | null>(null);
  const currentToolGroupId = useRef<string | null>(null);
  const currentToolCallId = useRef<string | null>(null);
  const currentCompactionId = useRef<string | null>(null);

  // Measure the composer-inner position whenever the slash menu opens so the
  // portal can be placed precisely above it regardless of the overflow chain.
  useEffect(() => {
    if (!slashMenu.open || !composerInnerRef.current) return;
    const rect = composerInnerRef.current.getBoundingClientRect();
    setSlashMenuPos({
      bottom: window.innerHeight - rect.top + 6,
      left: rect.left,
      width: rect.width,
    });
  }, [slashMenu.open]);

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
      thinkingIdRef: currentThinkingId,
      toolGroupIdRef: currentToolGroupId,
      toolCallIdRef: currentToolCallId,
      compactionIdRef: currentCompactionId,
      onNavigate: (url: string) => router.push(url),
    });

    async function init() {
      // Load conversation history.
      try {
        const r = await fetch(`/api/s/${sessionId}/history`);
        const { items }: { items: HistoryItem[] } = await r.json();
        if (items?.length > 0) {
          dispatch({ type: "HISTORY_LOADED", messages: historyToMessages(items) });
          setShowResumeBanner(true);
        }
      } catch {
        // History load failure is non-fatal.
      }

      // Check whether the agent is already processing (page was closed mid-turn).
      try {
        const statusRes = await fetch(`/api/s/${sessionId}/status`);
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

        const reconnect = await fetch(`/api/s/${sessionId}/chat`);
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
  }, [sessionId, router]);

  // Hydrate widget state on mount so refreshes and cross-device loads restore the panel.
  useEffect(() => {
    fetch(`/api/s/${sessionId}/widgets`)
      .then((r) => r.json())
      .then((snapshot: Record<string, string[]>) => {
        const entries = Object.entries(snapshot);
        if (entries.length > 0) {
          setWidgets(new Map(entries));
        }
      })
      .catch(() => {/* widgets stay empty — non-fatal */});
  }, [sessionId]);

  // Fetch session metadata (commands list, etc.) so the autocomplete is ready
  // as soon as the page loads. The extension populates this on session_start,
  // so the data is typically available immediately after the first prompt.
  useEffect(() => {
    fetch(`/api/s/${sessionId}/meta`)
      .then((r) => r.json())
      .then((meta: SessionMeta) => {
        if (meta?.commands) setSessionMeta(meta);
      })
      .catch(() => {/* meta stays at defaults — non-fatal */});
  }, [sessionId]);

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

  // Derive the filtered command list from the current input and session meta.
  // Returns entries only while the input starts with "/" and has no space
  // (once the user adds a space they're typing command arguments, not a name).
  const slashCandidates = (() => {
    if (!input.startsWith("/") || input.includes(" ")) return [];
    const query = input.slice(1).toLowerCase();
    return sessionMeta.commands.filter(
      (c) => c.name.toLowerCase().includes(query),
    );
  })();

  // Keep the selected index in bounds whenever the candidate list changes.
  const clampedIndex = Math.min(slashMenu.index, Math.max(0, slashCandidates.length - 1));

  /** Apply the selected slash command: replace input with the full command. */
  const applySlashCommand = useCallback(
    (name: string) => {
      setInput(`/${name} `);
      setSlashMenu({ open: false, index: 0 });
      requestAnimationFrame(resizeTextarea);
      textareaRef.current?.focus();
    },
    [resizeTextarea],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setBusy(true);
    setShowResumeBanner(false);
    requestAnimationFrame(resizeTextarea);

    // Reset streaming state.
    currentThinkingId.current = null;
    currentAssistantId.current = null;
    currentToolGroupId.current = null;
    currentToolCallId.current = null;
    currentCompactionId.current = null;

    dispatch({ type: "ADD_USER", id: uid(), text });

    try {
      const res = await fetch(`/api/s/${sessionId}/chat`, {
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
        thinkingIdRef: currentThinkingId,
        toolGroupIdRef: currentToolGroupId,
        toolCallIdRef: currentToolCallId,
        compactionIdRef: currentCompactionId,
        onNavigate: (url: string) => router.push(url),
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
  }, [sessionId, router, input, busy, resizeTextarea]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Route keyboard events through the slash menu when it's open.
      if (slashMenu.open && slashCandidates.length > 0) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashMenu((s) => ({
            ...s,
            index: (clampedIndex - 1 + slashCandidates.length) % slashCandidates.length,
          }));
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashMenu((s) => ({
            ...s,
            index: (clampedIndex + 1) % slashCandidates.length,
          }));
          return;
        }
        if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
          e.preventDefault();
          applySlashCommand(slashCandidates[clampedIndex].name);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashMenu({ open: false, index: 0 });
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage, slashMenu.open, slashCandidates, clampedIndex, applySlashCommand],
  );

  return (
    <div className="app">
      <ToastList toasts={toasts} />
      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="tb-left">
          <button
            className="icon-btn"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <MenuIcon size={18} />
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
              {messages.map((msg) => {
                switch (msg.kind) {
                  case "thinking":
                    return (
                      <ThinkingCard
                        key={msg.id}
                        message={msg}
                        onToggle={() =>
                          dispatch({ type: "TOGGLE_THINKING", id: msg.id })
                        }
                      />
                    );
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
            <div className="composer-inner" ref={composerInnerRef}>
              {/* Slash menu is rendered via a portal into document.body so it
                  escapes the ancestor overflow chain entirely. Only mounts
                  after the first open (slashMenuPos is set) to avoid SSR
                  issues with document. */}
              {slashMenu.open && slashCandidates.length > 0 && slashMenuPos !== null &&
                createPortal(
                  <div
                    className="slash-menu"
                    role="listbox"
                    aria-label="Slash commands"
                    style={{
                      position: "fixed",
                      bottom: slashMenuPos.bottom,
                      left: slashMenuPos.left,
                      width: slashMenuPos.width,
                    }}
                  >
                    {slashCandidates.map((cmd, i) => (
                      <button
                        key={cmd.name}
                        role="option"
                        aria-selected={i === clampedIndex}
                        className={`slash-item${i === clampedIndex ? " is-active" : ""}`}
                        onMouseDown={(e) => {
                          // Prevent textarea blur before we can apply the command.
                          e.preventDefault();
                          applySlashCommand(cmd.name);
                        }}
                      >
                        <span className="slash-item-name">/{cmd.name}</span>
                        {cmd.description && (
                          <span className="slash-item-desc">{cmd.description}</span>
                        )}
                      </button>
                    ))}
                  </div>,
                  document.body,
                )}
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
                    const val = e.target.value;
                    setInput(val);
                    resizeTextarea();
                    // Open the menu when the input is a bare "/" prefix with no args.
                    const isSlashing = val.startsWith("/") && !val.includes(" ");
                    setSlashMenu((s) => ({
                      open: isSlashing,
                      index: isSlashing ? s.index : 0,
                    }));
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
