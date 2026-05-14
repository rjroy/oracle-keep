import type { Action, Toast } from "./types";
import { uid } from "./helpers";

export type StreamHandlers = {
  dispatch: React.Dispatch<Action>;
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
  setStatuses: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  setWidgets: React.Dispatch<React.SetStateAction<Map<string, string[]>>>;
  assistantIdRef: React.MutableRefObject<string | null>;
  thinkingIdRef: React.MutableRefObject<string | null>;
  toolGroupIdRef: React.MutableRefObject<string | null>;
  toolCallIdRef: React.MutableRefObject<string | null>;
  compactionIdRef: React.MutableRefObject<string | null>;
  onNavigate?: (url: string) => void;
};

// Shared by sendMessage (POST) and the reconnect path (GET). Reads events from
// `body` until the stream closes and dispatches them into the reducer.
export async function processEventStream(
  body: ReadableStream<Uint8Array>,
  handlers: StreamHandlers,
): Promise<void> {
  const {
    dispatch,
    setToasts,
    setStatuses,
    setWidgets,
    assistantIdRef,
    thinkingIdRef,
    toolGroupIdRef,
    toolCallIdRef,
    compactionIdRef,
  } = handlers;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line.slice(6));
      } catch {
        continue;
      }

      switch (event.type) {
        case "thinking": {
          if (!thinkingIdRef.current) {
            const id = uid();
            thinkingIdRef.current = id;
            dispatch({ type: "ADD_THINKING", id });
          }
          dispatch({
            type: "APPEND_THINKING",
            id: thinkingIdRef.current,
            delta: event.delta as string,
          });
          break;
        }
        case "text": {
          // Finalize any in-progress thinking block before the assistant speaks.
          if (thinkingIdRef.current) {
            dispatch({ type: "FINALIZE_THINKING", id: thinkingIdRef.current });
            thinkingIdRef.current = null;
          }
          if (!assistantIdRef.current) {
            const id = uid();
            assistantIdRef.current = id;
            toolGroupIdRef.current = null;
            dispatch({ type: "ADD_ASSISTANT", id });
          }
          dispatch({
            type: "APPEND_TEXT",
            id: assistantIdRef.current,
            delta: event.delta as string,
          });
          break;
        }
        case "tool_start": {
          if (assistantIdRef.current) {
            dispatch({ type: "FINALIZE_ASSISTANT", id: assistantIdRef.current });
            assistantIdRef.current = null;
          }
          if (!toolGroupIdRef.current) {
            const id = uid();
            toolGroupIdRef.current = id;
            dispatch({ type: "ADD_TOOL_GROUP", id });
          }
          toolCallIdRef.current = event.id as string;
          dispatch({
            type: "ADD_TOOL",
            groupId: toolGroupIdRef.current,
            tool: {
              id: event.id as string,
              name: event.name as string,
              label: (event.label as string) || (event.name as string),
              output: "",
              status: "running",
              expanded: false,
            },
          });
          break;
        }
        case "tool_update": {
          if (toolGroupIdRef.current && event.id) {
            dispatch({
              type: "SET_TOOL_OUTPUT",
              groupId: toolGroupIdRef.current,
              toolId: event.id as string,
              text: event.text as string,
            });
          }
          break;
        }
        case "tool_end": {
          if (toolGroupIdRef.current) {
            dispatch({
              type: "FINALIZE_TOOL",
              groupId: toolGroupIdRef.current,
              toolId: event.id as string,
              isError: event.isError as boolean,
            });
          }
          // Only clear the ref if it still points to this tool —
          // parallel tool calls may have already advanced it.
          if (toolCallIdRef.current === (event.id as string)) {
            toolCallIdRef.current = null;
          }
          break;
        }
        case "compaction_start": {
          const id = uid();
          compactionIdRef.current = id;
          dispatch({ type: "ADD_COMPACTION", id });
          break;
        }
        case "compaction_end": {
          if (compactionIdRef.current) {
            const id = compactionIdRef.current;
            dispatch({ type: "FINALIZE_COMPACTION", id });
            setTimeout(() => dispatch({ type: "REMOVE", id }), 3000);
            compactionIdRef.current = null;
          }
          break;
        }
        case "navigate": {
          handlers.onNavigate?.(event.url as string);
          break;
        }
        case "done": {
          // Finalize thinking if it never transitioned to text (thinking-only turn).
          if (thinkingIdRef.current) {
            dispatch({ type: "FINALIZE_THINKING", id: thinkingIdRef.current });
            thinkingIdRef.current = null;
          }
          if (assistantIdRef.current) {
            dispatch({
              type: "FINALIZE_ASSISTANT",
              id: assistantIdRef.current,
            });
          }
          break;
        }
        case "notify": {
          const id = uid();
          const level = (event.level as Toast["level"]) ?? "info";
          setToasts((prev) => [...prev, { id, message: event.message as string, level }]);
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
          break;
        }
        case "status": {
          const key = event.key as string;
          const text = event.text as string | null;
          setStatuses((prev) => {
            const next = new Map(prev);
            if (text == null) next.delete(key);
            else next.set(key, text);
            return next;
          });
          break;
        }
        case "widget": {
          const key = event.key as string;
          const lines = event.lines as string[] | null;
          setWidgets((prev) => {
            const next = new Map(prev);
            if (lines == null) next.delete(key);
            else next.set(key, lines);
            return next;
          });
          break;
        }
        case "working_message":
        case "working_visible":
          // Acknowledged — no web equivalent yet.
          break;
        case "error": {
          dispatch({
            type: "ADD_ERROR",
            id: uid(),
            text: event.message as string,
          });
          break;
        }
      }
    }
  }
}
