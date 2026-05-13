import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { createWebUIContext, type UIEnqueue, type WebUIContext } from "./ui-context";

// ── Types ──────────────────────────────────────────────────────────────────────

export type BufferedEvent = { type: string; data: Record<string, unknown> };

type SessionState = {
  sessionPromise: Promise<AgentSession>;
  isProcessing: boolean;
  /** All events emitted during the current turn. Cleared at turn start. */
  eventBuffer: BufferedEvent[];
  /** Active SSE subscribers keyed by an arbitrary ID. */
  subscribers: Map<string, UIEnqueue>;
  uiContext: WebUIContext;
};

// ── HMR-safe sessions map ──────────────────────────────────────────────────────
// Stored on globalThis so it survives Next.js hot-module reloads in development.
declare global {
  var __oracleKeepSessions: Map<string, SessionState> | undefined;
}

function getSessionsMap(): Map<string, SessionState> {
  if (!globalThis.__oracleKeepSessions) {
    globalThis.__oracleKeepSessions = new Map();
  }
  return globalThis.__oracleKeepSessions;
}

// ── Session init ───────────────────────────────────────────────────────────────

function createSessionState(id: string, cwd: string): SessionState {
  console.log("\n  Oracle Keep");
  console.log(`  Session          : ${id}`);
  console.log(`  Working directory: ${cwd}`);
  console.log("  Starting agent session…\n");

  // uiContext is created before state is stored in the map because the
  // broadcastEventToSession closure captures `id` directly — no circular
  // reference through the map entry itself.
  const uiContext = createWebUIContext(
    () => (type: string, data: Record<string, unknown> = {}) =>
      broadcastEventToSession(id, type, data),
  );

  const sessionPromise = createAgentSession({
    sessionManager: SessionManager.continueRecent(cwd),
    cwd,
  }).then(async ({ session, modelFallbackMessage }) => {
    if (modelFallbackMessage) console.log(`  Note: ${modelFallbackMessage}`);
    await session.bindExtensions({ uiContext });
    console.log(`  Session file     : ${session.sessionFile ?? "(in-memory)"}`);
    console.log("  Agent ready.\n");
    return session;
  });

  return {
    sessionPromise,
    isProcessing: false,
    eventBuffer: [],
    subscribers: new Map(),
    uiContext,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Lazily creates a SessionState for the (id, cwd) pair if one does not yet
 * exist, then returns the promise that resolves to the AgentSession.
 * Subsequent calls with the same id always return the same session.
 */
export function getSession(id: string, cwd: string): Promise<AgentSession> {
  const map = getSessionsMap();
  if (!map.has(id)) {
    map.set(id, createSessionState(id, cwd));
  }
  return map.get(id)!.sessionPromise;
}

/**
 * Returns false for sessions not yet in the map — a session that has never
 * received a message is never processing by definition.
 */
export function isProcessingSession(id: string): boolean {
  return getSessionsMap().get(id)?.isProcessing ?? false;
}

export function setProcessingSession(id: string, value: boolean): void {
  const state = getSessionsMap().get(id);
  if (state) state.isProcessing = value;
}

/**
 * Broadcast an event to all subscribers of a session and append it to that
 * session's buffer. Events from one session never reach another session's
 * subscribers.
 */
export function broadcastEventToSession(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
): void {
  const state = getSessionsMap().get(id);
  if (!state) return;
  state.eventBuffer.push({ type, data });
  for (const fn of state.subscribers.values()) {
    fn(type, data);
  }
}

/** Register an SSE subscriber on a session. Use a stable subscriberId. */
export function addSubscriberToSession(
  id: string,
  subscriberId: string,
  fn: UIEnqueue,
): void {
  const state = getSessionsMap().get(id);
  if (state) state.subscribers.set(subscriberId, fn);
}

/** Remove a subscriber from a session. Safe even if id or subscriberId never existed. */
export function removeSubscriberFromSession(
  id: string,
  subscriberId: string,
): void {
  getSessionsMap().get(id)?.subscribers.delete(subscriberId);
}

/** Returns a snapshot of the session's current event buffer. */
export function getEventBufferForSession(id: string): BufferedEvent[] {
  return [...(getSessionsMap().get(id)?.eventBuffer ?? [])];
}

/** Clears the event buffer for a session. Call before starting a new agent turn. */
export function clearEventBufferForSession(id: string): void {
  const state = getSessionsMap().get(id);
  if (state) state.eventBuffer = [];
}

/** Returns the widget snapshot for a session, or {} if the session is not in the map. */
export function getWidgetSnapshotForSession(id: string): Record<string, string[]> {
  return getSessionsMap().get(id)?.uiContext.getWidgetSnapshot() ?? {};
}
