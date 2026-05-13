import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import type { AgentSession } from "@mariozechner/pi-coding-agent";

export const CWD = process.env.ORACLE_CWD ?? process.cwd();

// ── Singleton ──────────────────────────────────────────────────────────────────
// Stored on globalThis so it survives Next.js hot-module reloads in development.
declare global {
  // eslint-disable-next-line no-var
  var __oracleKeep:
    | { sessionPromise: Promise<AgentSession>; isProcessing: boolean }
    | undefined;
}

function singleton() {
  if (!globalThis.__oracleKeep) {
    console.log("\n  Oracle Keep");
    console.log(`  Working directory : ${CWD}`);
    console.log("  Starting agent session…\n");

    const sessionPromise = createAgentSession({
      sessionManager: SessionManager.continueRecent(CWD),
      cwd: CWD,
    }).then(({ session, modelFallbackMessage }) => {
      if (modelFallbackMessage) console.log(`  Note: ${modelFallbackMessage}`);
      console.log(`  Session          : ${session.sessionFile ?? "(in-memory)"}`);
      console.log("  Agent ready.\n");
      return session;
    });

    globalThis.__oracleKeep = { sessionPromise, isProcessing: false };
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
