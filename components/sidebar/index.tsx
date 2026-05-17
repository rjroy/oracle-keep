"use client";

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { SessionListItem, SessionRecord } from "@/types/session";
import { useSidebar } from "@/components/sidebar-context";
import { useSessions } from "./useSessions";
import CollapsedSessionAvatar from "./CollapsedSessionAvatar";
import SessionItem from "./SessionItem";
import AddSessionForm from "./AddSessionForm";

export default function Sidebar({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeSessionId = pathname?.match(/^\/s\/([^/]+)/)?.[1] ?? undefined;
  const { collapsed, toggle } = useSidebar();
  const { sessions, refreshSessions } = useSessions();

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Add session state
  const [addingSession, setAddingSession] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input when it appears.
  useEffect(() => {
    if (renamingId !== null) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  // Focus add input when it appears.
  useEffect(() => {
    if (addingSession) addInputRef.current?.focus();
  }, [addingSession]);

  // ── Rename handlers ──────────────────────────────────────────────────────────

  function startRename(entry: SessionListItem) {
    setConfirmingId(null);
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
      if (res.ok) await refreshSessions();
    } catch {
      // Rename failed silently; list resyncs on next poll.
    }
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  function handleRenameKeyDown(e: KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") { e.preventDefault(); commitRename(id); }
    else if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
  }

  // ── Delete handlers ──────────────────────────────────────────────────────────

  async function forgetSession(entry: SessionListItem) {
    try {
      const res = await fetch(`/api/sessions/${entry.id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        if (entry.id === activeSessionId) router.push("/");
        await refreshSessions();
      }
    } catch {
      // Delete failed; list resyncs on next poll.
    }
  }

  // ── Add session handlers ─────────────────────────────────────────────────────

  const showAddSession = useCallback(() => {
    setAddingSession(true);
    setAddValue("");
    setAddError(null);
  }, []);

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
    if (e.key === "Enter") { e.preventDefault(); submitAddSession(); }
    else if (e.key === "Escape") { e.preventDefault(); cancelAddSession(); }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <nav className={`rail${collapsed ? " collapsed" : ""}`} aria-label="Sessions">
      {!collapsed && <div className="rail-eyebrow">Sessions</div>}

      <div className="rail-scroll">
        {collapsed ? (
          sessions.map((entry) => (
            <CollapsedSessionAvatar
              key={entry.id}
              entry={entry}
              isActive={entry.id === activeSessionId}
              onClick={() => router.push(`/s/${entry.id}`)}
            />
          ))
        ) : (
          <>
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
              <SessionItem
                key={entry.id}
                entry={entry}
                isActive={entry.id === activeSessionId}
                onNavigate={() => router.push(`/s/${entry.id}`)}
                onStartRename={() => startRename(entry)}
                renameInputRef={renameInputRef}
                rename={{
                  isRenaming: renamingId === entry.id,
                  value: renameValue,
                  onChange: setRenameValue,
                  onCommit: () => commitRename(entry.id),
                  onCancel: cancelRename,
                  onKeyDown: (e) => handleRenameKeyDown(e, entry.id),
                }}
                deleteConfirm={{
                  isConfirming: confirmingId === entry.id,
                  onRequest: () => setConfirmingId(entry.id),
                  onCancel: () => setConfirmingId(null),
                  onConfirm: () => { setConfirmingId(null); forgetSession(entry); },
                }}
              />
            ))}
          </>
        )}
      </div>

      <div
        className="rail-foot"
        style={{ flexDirection: "column", alignItems: "stretch" }}
      >
        {collapsed ? (
          <button
            title="Add session"
            aria-label="Add session"
            onClick={() => { toggle(); setTimeout(() => setAddingSession(true), 150); }}
            style={{
              width: 32,
              height: 32,
              borderRadius: "9999px",
              border: "1px dashed var(--rule)",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--fg-3)",
              fontSize: "18px",
              alignSelf: "center",
              padding: 0,
            }}
          >
            +
          </button>
        ) : addingSession ? (
          <AddSessionForm
            value={addValue}
            error={addError}
            inputRef={addInputRef}
            onChange={setAddValue}
            onKeyDown={handleAddKeyDown}
            onSubmit={submitAddSession}
            onCancel={cancelAddSession}
          />
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
              overflow: "hidden",
              textWrap: "nowrap",
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
