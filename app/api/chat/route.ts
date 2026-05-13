import { getSession, isProcessing, setProcessing } from "@/lib/session";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function encode(type: string, data: Record<string, unknown> = {}): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

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
  setProcessing(true);

  const stream = new ReadableStream({
    async start(controller) {
      // Safely enqueue — client may disconnect before we finish.
      const enqueue = (type: string, data: Record<string, unknown> = {}) => {
        try {
          controller.enqueue(encode(type, data));
        } catch {
          // Controller already closed (client disconnected).
        }
      };

      const unsubscribe = session.subscribe((event) => {
        switch (event.type) {
          case "message_update": {
            const ae = event.assistantMessageEvent;
            if (ae.type === "text_delta")
              enqueue("text", { delta: ae.delta });
            if (ae.type === "thinking_delta")
              enqueue("thinking", { delta: ae.delta });
            break;
          }
          case "tool_execution_start":
            enqueue("tool_start", {
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
            if (text) enqueue("tool_update", { id: event.toolCallId, text });
            break;
          }
          case "tool_execution_end":
            enqueue("tool_end", {
              id: event.toolCallId,
              name: event.toolName,
              isError: event.isError ?? false,
            });
            break;
          case "compaction_start":
            enqueue("compaction_start");
            break;
          case "compaction_end":
            enqueue("compaction_end");
            break;
        }
      });

      try {
        await session.prompt(message);
        enqueue("done");
      } catch (err) {
        enqueue("error", {
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        unsubscribe();
        setProcessing(false);
        controller.close();
      }
    },

    async cancel() {
      // Client disconnected mid-stream — abort the agent turn.
      const session = await getSession();
      await session.abort();
      setProcessing(false);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
