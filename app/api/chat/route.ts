import {
  getSession,
  isProcessing,
  setProcessing,
  broadcastEvent,
  addSubscriber,
  removeSubscriber,
  getEventBuffer,
  clearEventBuffer,
} from "@/lib/session";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function encode(type: string, data: Record<string, unknown> = {}): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

/** Unique ID for subscriber registration. */
function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Build an SSE stream that replays the current turn's event buffer then
 * subscribes for future events. Closes itself when it receives "done" or
 * "error", or when the client disconnects.
 */
function buildEventStream(): ReadableStream {
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
      addSubscriber(streamId, (type, data = {}) => {
        enqueue(type, data);
        if (type === "done" || type === "error") {
          removeSubscriber(streamId);
          try { controller.close(); } catch { /* already closed */ }
        }
      });

      // Replay events that fired before this stream connected.
      for (const evt of getEventBuffer()) {
        enqueue(evt.type, evt.data);
      }

      // If the turn already finished, close now (done is in the buffer).
      if (!isProcessing()) {
        removeSubscriber(streamId);
        try { controller.close(); } catch { /* already closed */ }
      }
    },

    cancel() {
      // Client disconnected — unsubscribe but do NOT abort the agent turn.
      removeSubscriber(streamId);
    },
  });
}

// ── POST — start a new agent turn ─────────────────────────────────────────────

export async function POST(req: Request) {
  if (isProcessing()) {
    return Response.json(
      { error: "Agent is busy — please wait for the current response to finish." },
      { status: 409 }
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
      { status: 400 }
    );
  }

  const session = await getSession();

  // Prepare a fresh turn: mark busy and clear the previous turn's buffer.
  setProcessing(true);
  clearEventBuffer();

  // Subscribe to pi session events and route them through broadcastEvent so
  // they land in the buffer AND reach all active SSE subscribers.
  const unsubscribeSession = session.subscribe((event) => {
    switch (event.type) {
      case "message_update": {
        const ae = event.assistantMessageEvent;
        if (ae.type === "text_delta")
          broadcastEvent("text", { delta: ae.delta });
        if (ae.type === "thinking_delta")
          broadcastEvent("thinking", { delta: ae.delta });
        break;
      }
      case "tool_execution_start":
        broadcastEvent("tool_start", {
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
        if (text) broadcastEvent("tool_update", { id: event.toolCallId, text });
        break;
      }
      case "tool_execution_end":
        broadcastEvent("tool_end", {
          id: event.toolCallId,
          name: event.toolName,
          isError: event.isError ?? false,
        });
        break;
      case "compaction_start":
        broadcastEvent("compaction_start");
        break;
      case "compaction_end":
        broadcastEvent("compaction_end");
        break;
    }
  });

  // Fire the agent turn independently — not awaited here, so the Response is
  // returned immediately and the turn runs to completion even if the client
  // disconnects.
  session.prompt(message)
    .then(() => broadcastEvent("done"))
    .catch((err) =>
      broadcastEvent("error", {
        message: err instanceof Error ? err.message : String(err),
      })
    )
    .finally(() => {
      unsubscribeSession();
      setProcessing(false);
    });

  return new Response(buildEventStream(), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ── GET — reconnect to an in-progress or just-completed turn ──────────────────

export async function GET() {
  return new Response(buildEventStream(), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
