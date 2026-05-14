/**
 * Oracle Keep host extension.
 *
 * An inline extension factory that runs inside the pi session. It has full
 * access to ExtensionAPI — it can listen to lifecycle events, call
 * pi.getCommands(), and register Oracle Keep-specific commands.
 *
 * Communication back to the web layer happens exclusively through the
 * MetaCallback. The factory has no knowledge of sessions, HTTP, or SSE —
 * those are the session module's concern.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { CommandEntry, SessionMeta } from "@/types/session";

/**
 * Called by the extension whenever it has new metadata to surface.
 * The session module merges the partial update into its stored SessionMeta.
 */
export type MetaCallback = (update: Partial<SessionMeta>) => void;

/** Factory type: a function that receives ExtensionAPI and wires up behavior. */
export type ExtensionFactory = (pi: ExtensionAPI) => void;

/**
 * Build the Oracle Keep extension factory.
 *
 * @param onMeta  Receives metadata updates as the session discovers them.
 *                Called at least once on session_start with the full command list.
 */
export function createOracleExtension(onMeta: MetaCallback): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    // session_start fires after all extensions have registered — so
    // pi.getCommands() returns the complete list including compactor and
    // any other loaded extension commands.
    pi.on("session_start", async () => {
      const commands: CommandEntry[] = [
        ...pi.getCommands().map((c) => ({
          name: c.name,
          description: c.description ?? "",
          source: c.source,
        })),
        // Oracle Keep app-level commands not registered through pi's extension
        // system. These are handled directly in the API route.
        {
          name: "new",
          description: "Start a fresh consultation",
          source: "oracle-keep" as const,
        },
      ];
      onMeta({ commands });
    });

    // Future Oracle Keep-specific commands can be registered here, e.g.:
    // pi.registerCommand("oracle:export", { ... })
  };
}
