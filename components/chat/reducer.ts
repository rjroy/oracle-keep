import type { Message, Action, ToolEntry } from "./types";

export function reducer(state: Message[], action: Action): Message[] {
  switch (action.type) {
    case "HISTORY_LOADED":
      return action.messages;

    case "ADD_USER":
      return [...state, { id: action.id, kind: "user", text: action.text }];

    case "ADD_ASSISTANT":
      return [
        ...state,
        { id: action.id, kind: "assistant", text: "", streaming: true },
      ];

    case "APPEND_TEXT":
      return state.map((m) =>
        m.id === action.id && m.kind === "assistant"
          ? { ...m, text: m.text + action.delta }
          : m
      );

    case "FINALIZE_ASSISTANT":
      return state.map((m) =>
        m.id === action.id && m.kind === "assistant"
          ? { ...m, streaming: false }
          : m
      );

    case "ADD_TOOL_GROUP":
      return [...state, { id: action.id, kind: "tool_group", tools: [] }];

    case "ADD_TOOL":
      return state.map((m) =>
        m.id === action.groupId && m.kind === "tool_group"
          ? { ...m, tools: [...m.tools, action.tool] }
          : m
      );

    case "SET_TOOL_OUTPUT":
      return state.map((m) =>
        m.id === action.groupId && m.kind === "tool_group"
          ? {
              ...m,
              tools: m.tools.map((t: ToolEntry) =>
                t.id === action.toolId ? { ...t, output: action.text } : t
              ),
            }
          : m
      );

    case "FINALIZE_TOOL":
      return state.map((m) =>
        m.id === action.groupId && m.kind === "tool_group"
          ? {
              ...m,
              tools: m.tools.map((t: ToolEntry) =>
                t.id === action.toolId
                  ? { ...t, status: action.isError ? "error" : "ok" }
                  : t
              ),
            }
          : m
      );

    case "TOGGLE_TOOL":
      return state.map((m) =>
        m.id === action.groupId && m.kind === "tool_group"
          ? {
              ...m,
              tools: m.tools.map((t: ToolEntry) =>
                t.id === action.toolId ? { ...t, expanded: !t.expanded } : t
              ),
            }
          : m
      );

    case "ADD_THINKING":
      return [
        ...state,
        { id: action.id, kind: "thinking", text: "", streaming: true, expanded: false },
      ];

    case "APPEND_THINKING":
      return state.map((m) =>
        m.id === action.id && m.kind === "thinking"
          ? { ...m, text: m.text + action.delta }
          : m
      );

    case "FINALIZE_THINKING":
      return state.map((m) =>
        m.id === action.id && m.kind === "thinking"
          ? { ...m, streaming: false }
          : m
      );

    case "TOGGLE_THINKING":
      return state.map((m) =>
        m.id === action.id && m.kind === "thinking"
          ? { ...m, expanded: !m.expanded }
          : m
      );

    case "ADD_COMPACTION":
      return [...state, { id: action.id, kind: "compaction", done: false }];

    case "FINALIZE_COMPACTION":
      return state.map((m) =>
        m.id === action.id && m.kind === "compaction"
          ? { ...m, done: true }
          : m
      );

    case "REMOVE":
      return state.filter((m) => m.id !== action.id);

    case "ADD_ERROR":
      return [...state, { id: action.id, kind: "error", text: action.text }];

    default:
      return state;
  }
}
