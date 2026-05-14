import { createAgentSession, DefaultResourceLoader, getAgentDir, SessionManager } from "@mariozechner/pi-coding-agent";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { createOracleExtension } from "./oracle-extension";
import type { ExtensionFactory } from "./oracle-extension";
import type { SessionMeta } from "@/types/session";
import { createWebUIContext, type UIEnqueue, type WebUIContext } from "./ui-context";
import { setSessionFile } from "./registry";

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
  /** Metadata discovered by the Oracle Keep extension after session_start. */
  meta: SessionMeta;
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

function createSessionState(
  id: string,
  cwd: string,
  opts: { fresh?: boolean; sessionFile?: string; extensionFactory?: ExtensionFactory } = {},
): SessionState {
  console.log("\n  Oracle Keep");
  console.log(`  Session          : ${id}`);
  console.log(`  Working directory: ${cwd}`);
  console.log("  Starting agent session…\n");

  const uiContext = createWebUIContext(
    () => (type: string, data: Record<string, unknown> = {}) =>
      broadcastEventToSession(id, type, data),
  );

  // Pick the right SessionManager strategy:
  //   - pinned path  → open that specific file (survives restarts correctly)
  //   - fresh        → create a new file (for /new)
  //   - otherwise    → continue the most recent file
  let manager: SessionManager;
  if (opts.sessionFile) {
    manager = SessionManager.open(opts.sessionFile);
  } else if (opts.fresh) {
    manager = SessionManager.create(cwd);
  } else {
    manager = SessionManager.continueRecent(cwd);
  }

  const oracleFactory: ExtensionFactory = opts.extensionFactory ?? createOracleExtension((update) => {
    const state = getSessionsMap().get(id);
    if (state) Object.assign(state.meta, update);
  });

  const loader = new DefaultResourceLoader({
    cwd,
    agentDir: getAgentDir(),
    extensionFactories: [oracleFactory],
  });
  // loader.reload() discovers and validates extensions before session creation.
  // Awaited inside the promise chain so createSessionState stays synchronous.
  const sessionPromise = loader.reload().then(() =>
    createAgentSession({
      resourceLoader: loader,
      sessionManager: manager,
      cwd,
    })
  ).then(async ({ session, modelFallbackMessage }) => {
    if (modelFallbackMessage) console.log(`  Note: ${modelFallbackMessage}`);
    await session.bindExtensions({ uiContext });
    const file = session.sessionFile;
    console.log(`  Session file     : ${file ?? "(in-memory)"}`);
    console.log("  Agent ready.\n");
    // Pin this session to its .jsonl file so restarts use open() not continueRecent().
    if (file) setSessionFile(id, file).catch(() => {/* non-fatal */});
    return session;
  });

  return {
    sessionPromise,
    isProcessing: false,
    eventBuffer: [],
    subscribers: new Map(),
    uiContext,
    meta: { commands: [] },
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Lazily creates a SessionState for the (id, cwd) pair if one does not yet
 * exist, then returns the promise that resolves to the AgentSession.
 * Subsequent calls with the same id always return the same session.
 */
export function getSession(
  id: string,
  cwd: string,
  opts: { fresh?: boolean; sessionFile?: string; extensionFactory?: ExtensionFactory } = {},
): Promise<AgentSession> {
  const map = getSessionsMap();
  if (!map.has(id)) {
    map.set(id, createSessionState(id, cwd, opts));
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

/**
 * Returns the session metadata discovered by the Oracle Keep extension,
 * or a default empty-state object if the session is not yet in the map.
 */
export function getSessionMeta(id: string): SessionMeta {
  return getSessionsMap().get(id)?.meta ?? { commands: [] };
}
