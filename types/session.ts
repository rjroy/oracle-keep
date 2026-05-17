// Shared session types — used by both server (lib/) and client (components/).
// No SDK imports — this file must be safe to import on either side.

// ── Registry types ────────────────────────────────────────────────────────────

export type SessionRecord = {
  id: string;
  cwd: string;
  label: string;
  addedAt: string; // ISO 8601
  sessionFile?: string; // Path to the pi .jsonl session file, written after first init
};

export type SessionRegistry = {
  sessions: SessionRecord[];
};

export type SessionListItem = SessionRecord & { isProcessing: boolean };

// ── Session config ───────────────────────────────────────────────────────────

export type SessionConfig = {
  /** Model identifier passed to createAgentSession. Empty string lets the SDK choose. */
  model: string;
};

// ── Session metadata (Oracle Keep extension → client) ─────────────────────────

/** A single slash command surfaced from the pi session. */
export type CommandEntry = {
  name: string;
  description: string;
  /** Where the command came from. */
  source: "extension" | "prompt" | "skill" | "oracle-keep";
};

/**
 * Live metadata about a session that the Oracle Keep extension discovers and
 * the server makes available to the client.
 *
 * Add new fields here as the extension-to-client channel grows. The /meta
 * endpoint returns the whole object, so clients get new fields automatically.
 */
export type SessionMeta = {
  commands: CommandEntry[];
};
