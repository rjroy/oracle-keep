// Shared types used by both server (lib/history.ts) and client (components/Chat.tsx).
// No SDK imports here — this file must be safe to import on either side.

export type HistoryItem =
  | { type: "user"; text: string }
  | { type: "thinking"; text: string }
  | { type: "assistant_text"; text: string }
  | { type: "tool"; name: string; output: string; isError: boolean };
