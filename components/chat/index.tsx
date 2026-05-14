"use client";

import {
  useReducer,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { HistoryItem } from "@/types/chat";
import type { SessionMeta } from "@/types/session";
import {
  MenuIcon,
  SunIcon,
  MoonIcon,
  SendIcon,
  LanternIcon,
  Flourish,
} from "@/components/icons";
import { useSidebar } from "@/components/sidebar-context";

import { reducer } from "./reducer";
import { uid, historyToMessages } from "./helpers";
import { processEventStream } from "./stream";
import type { StreamHandlers } from "./stream";
import type { Toast } from "./types";
import UserMessage from "./UserMessage";
import AssistantMessage from "./AssistantMessage";
import ThinkingCard from "./ThinkingCard";
import ToolGroup from "./ToolCard";
import CompactionMarker from "./CompactionMarker";
import ToastList from "./ToastList";
import StatusBar from "./StatusBar";
import WidgetPanel from "./WidgetPanel";

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
