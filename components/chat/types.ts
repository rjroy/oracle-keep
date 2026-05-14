// UI-only types for the Chat component tree.
// Types shared with the server live in types/chat.ts.

export type Toast = {
  id: string;
  message: string;
  level: "info" | "warning" | "error";
};

export type ToolEntry = {
  id: string;
  name: string;
  label: string;
  output: string;
  status: "running" | "ok" | "error";
  expanded: boolean;
};

export type Message =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string; streaming: boolean }
  | { id: string; kind: "thinking"; text: string; streaming: boolean; expanded: boolean }
  | { id: string; kind: "tool_group"; tools: ToolEntry[] }
  | { id: string; kind: "compaction"; done: boolean }
  | { id: string; kind: "error"; text: string };

export type Action =
  | { type: "HISTORY_LOADED"; messages: Message[] }
  | { type: "ADD_USER"; id: string; text: string }
  | { type: "ADD_ASSISTANT"; id: string }
  | { type: "APPEND_TEXT"; id: string; delta: string }
  | { type: "FINALIZE_ASSISTANT"; id: string }
  | { type: "ADD_TOOL_GROUP"; id: string }
  | { type: "ADD_TOOL"; groupId: string; tool: ToolEntry }
  | { type: "SET_TOOL_OUTPUT"; groupId: string; toolId: string; text: string }
  | { type: "FINALIZE_TOOL"; groupId: string; toolId: string; isError: boolean }
  | { type: "TOGGLE_TOOL"; groupId: string; toolId: string }
  | { type: "ADD_THINKING"; id: string }
  | { type: "APPEND_THINKING"; id: string; delta: string }
  | { type: "FINALIZE_THINKING"; id: string }
  | { type: "TOGGLE_THINKING"; id: string }
  | { type: "ADD_COMPACTION"; id: string }
  | { type: "FINALIZE_COMPACTION"; id: string }
  | { type: "REMOVE"; id: string }
  | { type: "ADD_ERROR"; id: string; text: string };
