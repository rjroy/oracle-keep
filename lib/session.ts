import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { createWebUIContext, type UIEnqueue, type WebUIContext } from "./ui-context";

export const CWD = process.env.ORACLE_CWD ?? process.cwd();

// ── Types ──────────────────────────────────────────────────────────────────────

export type BufferedEvent = { type: string; data: Record<string, unknown> };

// ── Singleton ──────────────────────────────────────────────────────────────────
// Stored on globalThis so it survives Next.js hot-module reloads in development.
declare global {
  // eslint-disable-next-line no-var
  var __oracleKeep:
    | {
        sessionPromise: Promise<AgentSession>;
        isProcessing: boolean;
        /** All events emitted during the current turn. Cleared at turn start. */
        eventBuffer: BufferedEvent[];
        /** Active SSE subscribers keyed by an arbitrary ID. */
        subscribers: Map<string, UIEnqueue>;
        uiContext: WebUIContext | null;
      }
    | undefined;
}

function singleton() {
  if (!globalThis.__oracleKeep) {
    console.log("\n  Oracle Keep");
    console.log(`  Working directory : ${CWD}`);
    console.log("  Starting agent session…\n");

    // broadcastEvent is defined below; the closure captures globalThis.__oracleKeep
    // lazily, so it's safe to reference before the singleton field is assigned.
    const uiContext = createWebUIContext(
      () => (type: string, data: Record<string, unknown> = {}) =>
        broadcastEvent(type, data),
    );

    const sessionPromise = createAgentSession({
      sessionManager: SessionManager.continueRecent(CWD),
      cwd: CWD,
    }).then(async ({ session, modelFallbackMessage }) => {
      if (modelFallbackMessage) console.log(`  Note: ${modelFallbackMessage}`);
      await session.bindExtensions({ uiContext });
      console.log(`  Session          : ${session.sessionFile ?? "(in-memory)"}`);
      console.log("  Agent ready.\n");
      return session;
    });

    globalThis.__oracleKeep = {
      sessionPromise,
      isProcessing: false,
      eventBuffer: [],
      subscribers: new Map(),
      uiContext,
    };
  }
  return globalThis.__oracleKeep;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getSession(): Promise<AgentSession> {
  return singleton().sessionPromise;
}

export function isProcessing(): boolean {
  return singleton().isProcessing;
}

export function setProcessing(value: boolean): void {
  singleton().isProcessing = value;
}

/**
 * Broadcast an event to all active subscribers and append it to the buffer.
 * Call clearEventBuffer() before starting a new turn so the buffer only
 * contains events for the current turn.
 */
export function broadcastEvent(
  type: string,
  data: Record<string, unknown> = {},
): void {
  const s = singleton();
  s.eventBuffer.push({ type, data });
  for (const fn of s.subscribers.values()) {
    fn(type, data);
  }
}

/** Register an SSE subscriber. Use a stable id so it can be removed later. */
export function addSubscriber(id: string, fn: UIEnqueue): void {
  singleton().subscribers.set(id, fn);
}

/** Remove a subscriber. Safe to call even if the id was never registered. */
export function removeSubscriber(id: string): void {
  singleton().subscribers.delete(id);
}

/**
 * Returns a snapshot of the current turn's event buffer.
 * Safe to call from any context.
 */
export function getEventBuffer(): BufferedEvent[] {
  return [...singleton().eventBuffer];
}

/** Clear the event buffer. Call before starting a new agent turn. */
export function clearEventBuffer(): void {
  singleton().eventBuffer = [];
}

export function getWidgetSnapshot(): Record<string, string[]> {
  return globalThis.__oracleKeep?.uiContext?.getWidgetSnapshot() ?? {};
}
