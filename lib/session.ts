import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { createWebUIContext, type UIEnqueue, type WebUIContext } from "./ui-context";

export const CWD = process.env.ORACLE_CWD ?? process.cwd();

// ── Singleton ──────────────────────────────────────────────────────────────────
// Stored on globalThis so it survives Next.js hot-module reloads in development.
declare global {
  var __oracleKeep:
    | { sessionPromise: Promise<AgentSession>; isProcessing: boolean; enqueue: UIEnqueue | null; uiContext: WebUIContext | null }
    | undefined;
}

function singleton() {
  if (!globalThis.__oracleKeep) {
    console.log("\n  Oracle Keep");
    console.log(`  Working directory : ${CWD}`);
    console.log("  Starting agent session…\n");

    const uiContext = createWebUIContext(() => globalThis.__oracleKeep?.enqueue ?? null);

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

    globalThis.__oracleKeep = { sessionPromise, isProcessing: false, enqueue: null, uiContext };
  }
  return globalThis.__oracleKeep;
}

export function getSession(): Promise<AgentSession> {
  return singleton().sessionPromise;
}

export function isProcessing(): boolean {
  return singleton().isProcessing;
}

export function setProcessing(value: boolean): void {
  singleton().isProcessing = value;
}

export function setEnqueue(fn: UIEnqueue): void {
  const s = globalThis.__oracleKeep;
  if (s) s.enqueue = fn;
}

export function clearEnqueue(): void {
  const s = globalThis.__oracleKeep;
  if (s) s.enqueue = null;
}

export function getWidgetSnapshot(): Record<string, string[]> {
  return globalThis.__oracleKeep?.uiContext?.getWidgetSnapshot() ?? {};
}

