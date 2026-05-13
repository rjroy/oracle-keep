"use client";

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { SessionListItem, SessionRecord } from "@/types/session";

const POLL_INTERVAL_MS = 10_000;

export default function Sidebar({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeSessionId = pathname?.match(/^\/s\/([^/]+)/)?.[1] ?? undefined;
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingSession, setAddingSession] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Manual refresh: called after mutations (rename, delete, add).
  // setSessions is a stable useState setter — safe to omit from deps.
  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data: SessionListItem[] = await res.json();
        setSessions(data);
      }
    } catch {
      // Non-fatal — stale list stays visible until next poll.
    }
  }, []);

  // Initial load + polling. The async function is defined inside the effect so
  // the linter (react-hooks/set-state-in-effect) treats setState as internal.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/sessions");
        if (res.ok && !cancelled) {
          const data: SessionListItem[] = await res.json();
          if (!cancelled) setSessions(data);
        }
      } catch {
        // Non-fatal.
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Focus rename input when it appears.
  useEffect(() => {
    if (renamingId !== null) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  // Focus add input when it appears.
  useEffect(() => {
    if (addingSession) {
      addInputRef.current?.focus();
    }
  }, [addingSession]);

  function startRename(entry: SessionListItem) {
    setRenamingId(entry.id);
    setRenameValue(entry.label);
  }

  async function commitRename(id: string) {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed ?? "" }),
      });
      if (res.ok) {
        await refreshSessions();
      }
    } catch {
      // Rename failed silently; list resyncs on next poll.
    }
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  function handleRenameKeyDown(e: KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  }

  async function forgetSession(entry: SessionListItem) {
    try {
      const res = await fetch(`/api/sessions/${entry.id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        if (entry.id === activeSessionId) {
          router.push("/");
        }
        await refreshSessions();
      }
    } catch {
      // Delete failed; list resyncs on next poll.
    }
  }

  function showAddSession() {
    setAddingSession(true);
    setAddValue("");
    setAddError(null);
  }

  function cancelAddSession() {
    setAddingSession(false);
    setAddValue("");
    setAddError(null);
  }

  async function submitAddSession() {
    const trimmed = addValue.trim();
    if (!trimmed) return;
    setAddError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: trimmed }),
      });
      if (res.status === 201) {
        const newRecord: SessionRecord = await res.json();
        setAddingSession(false);
        setAddValue("");
        await refreshSessions();
        router.push(`/s/${newRecord.id}`);
      } else {
        const body: { error: string } = await res.json();
        setAddError(body.error ?? "Failed to add session.");
      }
    } catch {
      setAddError("Network error. Please try again.");
    }
  }

  function handleAddKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitAddSession();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelAddSession();
    }
  }

  return (
    <nav className="rail" aria-label="Sessions">
      <div className="rail-eyebrow">Sessions</div>

      <div className="rail-scroll">
        {sessions.length === 0 && (
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: "var(--text-sm)",
              color: "var(--fg-3)",
              padding: "8px 8px 0",
              margin: 0,
            }}
          >
            No sessions yet. Add one below to get started.
          </p>
        )}

        {sessions.map((entry) => (
          <div
            key={entry.id}
            className={`scroll-item${entry.id === activeSessionId ? " is-active" : ""}`}
            style={
              entry.id === activeSessionId
                ? { background: "var(--brand-soft)", borderColor: "var(--brand)" }
                : undefined
            }
            onClick={() => {
              if (renamingId !== entry.id) {
                router.push(`/s/${entry.id}`);
              }
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
              {entry.isProcessing && (
                <span
                  aria-label="Processing"
                  title="Processing"
                  style={{
                    color: "var(--brand)",
                    fontSize: "10px",
                    flexShrink: 0,
                    animation: "flicker 1.5s ease-in-out infinite",
                  }}
                >
                  ●
                </span>
              )}

              {renamingId === entry.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(entry.id)}
                  onKeyDown={(e) => handleRenameKeyDown(e, entry.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "var(--bg)",
                    border: "1px solid var(--brand)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--fg-1)",
                    fontFamily: "var(--font-serif)",
                    fontSize: "var(--text-sm)",
                    padding: "2px 6px",
                    outline: "none",
                  }}
                />
              ) : (
                <span
                  role="button"
                  tabIndex={0}
                  title="Click to rename"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") startRename(entry);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(entry);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-serif)",
                    fontSize: "var(--text-sm)",
                    color: "var(--fg-1)",
                    cursor: "text",
                  }}
                >
                  {entry.label}
                </span>
              )}

              <button
                aria-label={`Forget session ${entry.label}`}
                title="Forget session"
                onClick={(e) => {
                  e.stopPropagation();
                  forgetSession(entry);
                }}
                style={{
                  flexShrink: 0,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--fg-3)",
                  padding: "0 2px",
                  fontSize: "14px",
                  lineHeight: "1",
                  borderRadius: "var(--radius-sm)",
                  transition: "color var(--dur) var(--ease-out)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-3)";
                }}
              >
                ×
              </button>
            </div>

            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--fg-3)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {entry.cwd}
            </span>
          </div>
        ))}
      </div>

      <div
        className="rail-foot"
        style={{ flexDirection: "column", alignItems: "stretch" }}
      >
        {addingSession ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <input
              ref={addInputRef}
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="/path/to/project"
              aria-label="Directory path for new session"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                color: "var(--fg-1)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-sm)",
                padding: "6px 10px",
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--brand)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--rule)";
              }}
            />
            {addError && (
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-serif)",
                  fontSize: "var(--text-xs)",
                  color: "var(--danger)",
                }}
              >
                {addError}
              </p>
            )}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={submitAddSession}
                style={{
                  flex: 1,
                  background: "var(--brand)",
                  border: "1px solid var(--brand-hover)",
                  borderRadius: "var(--radius)",
                  color: "var(--fg-on-ember)",
                  fontFamily: "var(--font-serif)",
                  fontSize: "var(--text-sm)",
                  padding: "5px 0",
                  cursor: "pointer",
                }}
              >
                Add
              </button>
              <button
                onClick={cancelAddSession}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--radius)",
                  color: "var(--fg-2)",
                  fontFamily: "var(--font-serif)",
                  fontSize: "var(--text-sm)",
                  padding: "5px 0",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={showAddSession}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px dashed var(--rule)",
              borderRadius: "var(--radius)",
              color: "var(--fg-3)",
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: "var(--text-sm)",
              padding: "7px 10px",
              cursor: "pointer",
              textAlign: "center",
              transition: "all var(--dur) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.color = "var(--fg-1)";
              btn.style.borderColor = "var(--brand)";
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.color = "var(--fg-3)";
              btn.style.borderColor = "var(--rule)";
            }}
          >
            + Add session
          </button>
        )}
      </div>
    </nav>
  );
}
