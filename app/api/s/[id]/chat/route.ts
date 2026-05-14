import {
  getSession,
  isProcessingSession,
  setProcessingSession,
  broadcastEventToSession,
  addSubscriberToSession,
  removeSubscriberFromSession,
  getEventBufferForSession,
  clearEventBufferForSession,
} from "@/lib/session";
import { findSession, addSession } from "@/lib/registry";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function encode(type: string, data: Record<string, unknown> = {}): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

/** Unique ID for subscriber registration. */
function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const sseHeaders = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

/**
 * Build an SSE stream for a session that replays the current turn's event
 * buffer then subscribes for future events. Closes when it receives "done"
 * or "error", or when the client disconnects.
 */
function buildEventStream(id: string): ReadableStream {
  const streamId = uid();

  return new ReadableStream({
    start(controller) {
      const enqueue = (type: string, data: Record<string, unknown> = {}) => {
        try {
          controller.enqueue(encode(type, data));
        } catch {
          // Controller already closed (client disconnected).
        }
      };

      // Register subscriber BEFORE replaying the buffer so no events are lost
      // between replay and live dispatch. JS is single-threaded so no race.
      addSubscriberToSession(id, streamId, (type, data = {}) => {
        enqueue(type, data);
        if (type === "done" || type === "error") {
          removeSubscriberFromSession(id, streamId);
          try { controller.close(); } catch { /* already closed */ }
        }
      });

      // Replay events that fired before this stream connected.
      for (const evt of getEventBufferForSession(id)) {
        enqueue(evt.type, evt.data);
      }

      // If the turn already finished, close now (done is in the buffer).
      if (!isProcessingSession(id)) {
        removeSubscriberFromSession(id, streamId);
        try { controller.close(); } catch { /* already closed */ }
      }
    },

    cancel() {
      // Client disconnected — unsubscribe but do NOT abort the agent turn.
      removeSubscriberFromSession(id, streamId);
    },
  });
}

// ── GET — reconnect to an in-progress or just-completed turn ──────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const record = await findSession(id);
  if (!record) return Response.json({ error: "Session not found" }, { status: 404 });
  return new Response(buildEventStream(id), { headers: sseHeaders });
}

// ── POST — start a new agent turn ─────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const record = await findSession(id);
  if (!record) return Response.json({ error: "Session not found" }, { status: 404 });

  if (isProcessingSession(id)) {
    return Response.json(
      { error: "Agent is busy — please wait for the current response to finish." },
      { status: 409 },
    );
  }

  let message: string;
  try {
    const body = await req.json();
    message = body.message;
    if (!message || typeof message !== "string") throw new Error("missing message");
  } catch {
    return Response.json(
      { error: "Body must be JSON { message: string }" },
      { status: 400 },
    );
  }

  // ── Slash commands ────────────────────────────────────────────────────────
  // Handled before touching the agent — these are UI-level commands, not
  // messages to be sent to the LLM.
  if (message.trim() === "/new") {
    const newRecord = await addSession(record.cwd);
    // Pre-warm the new session with fresh:true so it creates a new .jsonl
    // rather than continuing the most recent one.
    getSession(newRecord.id, newRecord.cwd, { fresh: true }).catch(() => {});
    // Single-event stream: tell the client to navigate, then close.
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encode("navigate", { url: `/s/${newRecord.id}` }));
        controller.close();
      },
    });
    return new Response(stream, { headers: sseHeaders });
  }

  const session = await getSession(id, record.cwd, { sessionFile: record.sessionFile });

  // Prepare a fresh turn: mark busy and clear the previous turn's buffer.
  setProcessingSession(id, true);
  clearEventBufferForSession(id);

  // Subscribe to pi session events and route them through broadcastEventToSession
  // so they land in the buffer AND reach all active SSE subscribers.
  const unsubscribeSession = session.subscribe((event) => {
    switch (event.type) {
      case "message_update": {
        const ae = event.assistantMessageEvent;
        if (ae.type === "text_delta")
          broadcastEventToSession(id, "text", { delta: ae.delta });
        if (ae.type === "thinking_delta")
          broadcastEventToSession(id, "thinking", { delta: ae.delta });
        break;
      }
      case "tool_execution_start":
        broadcastEventToSession(id, "tool_start", {
          id: event.toolCallId,
          name: event.toolName,
          label: event.toolName,
        });
        break;
      case "tool_execution_update": {
        const partial = event.partialResult as
          | { content?: Array<{ type: string; text?: string }> }
          | null
          | undefined;
        const text =
          partial?.content
            ?.filter((b) => b.type === "text")
            .map((b) => b.text ?? "")
            .join("") ?? "";
        if (text) broadcastEventToSession(id, "tool_update", { id: event.toolCallId, text });
        break;
      }
      case "tool_execution_end":
        broadcastEventToSession(id, "tool_end", {
          id: event.toolCallId,
          name: event.toolName,
          isError: event.isError ?? false,
        });
        break;
      case "compaction_start":
        broadcastEventToSession(id, "compaction_start");
        break;
      case "compaction_end":
        broadcastEventToSession(id, "compaction_end");
        break;
    }
  });

  // Fire the agent turn independently — not awaited here, so the Response is
  // returned immediately and the turn runs to completion even if the client
  // disconnects.
  session.prompt(message)
    .then(() => broadcastEventToSession(id, "done"))
    .catch((err) =>
      broadcastEventToSession(id, "error", {
        message: err instanceof Error ? err.message : String(err),
      }),
    )
    .finally(() => {
      unsubscribeSession();
      setProcessingSession(id, false);
    });

  return new Response(buildEventStream(id), { headers: sseHeaders });
}
