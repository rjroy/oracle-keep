# Oracle Keep — Session Notes

## What It Is

Oracle Keep is a web chat interface for the pi coding agent. It wraps `createAgentSession` from `@earendil-works/pi-coding-agent` and exposes it as a local browser UI. The agent operates on a configured working directory (`ORACLE_CWD` env var, defaults to `process.cwd()`).

---

## What We Built

### Started from a single-file server

Original: `server.js` — a bare Node.js HTTP server with inline HTML, CSS, and JavaScript. No TypeScript, no framework.

### Session persistence (server restart + page refresh)

**Server restart:** Switched `SessionManager.create(CWD)` to `SessionManager.continueRecent(CWD)`. Pi saves sessions to `~/.pi/agent/sessions/` organized by working directory. On restart, the most recent session is resumed automatically.

**Page refresh:** Added `/api/history` endpoint. Server-side `buildHistory()` walks `session.messages` (the live `AgentMessage[]`), indexes `ToolResultMessage` objects by `toolCallId`, and flattens everything into a serializable `HistoryItem[]`. Client fetches this on mount and renders it using the same display logic as live streaming.

### Compaction visibility

Pi auto-compacts when `contextTokens > contextWindow - 16384`. It was happening silently — no indication to the user, just a mysterious delay. Added `compaction_start` / `compaction_end` event forwarding from the session subscriber to the SSE stream. Client shows a pill-shaped banner with a spinner while it runs, then "✓ Context compacted" for 3 seconds before removing itself.

### Migrated to Next.js 15

Converted from the single-file server to a proper Next.js App Router project.

**File structure:**
```
app/
  layout.tsx
  globals.css          # ported original CSS, no Tailwind yet
  page.tsx
  api/
    chat/route.ts      # POST — SSE streaming
    history/route.ts   # GET — conversation history for page-load restore
components/
  Chat.tsx             # full chat UI, client component, useReducer state machine
lib/
  session.ts           # pi session singleton (globalThis pattern for HMR safety)
  history.ts           # buildHistory() — AgentMessage[] → HistoryItem[]
types/
  chat.ts              # HistoryItem type — no SDK imports, safe on both sides
```

**Session singleton:** Uses `globalThis.__oracleKeep` so the pi session survives Next.js hot-module reloads in development without reinitializing.

**Streaming:** Route handler returns a `ReadableStream` with SSE framing. Includes a `cancel()` handler that calls `session.abort()` if the client disconnects mid-stream.

**Chat state:** `useReducer` with explicit action types covering the full streaming state machine: user messages, assistant text (incremental), tool groups, individual tool calls, compaction banners, and errors. Streaming state tracked via refs (`currentAssistantId`, `currentToolGroupId`, `currentToolCallId`, `currentCompactionId`) to avoid stale closures.

### Bug discovered and fixed during migration

Tool output streaming was silently broken in the original. The original code checked `event.delta` on `tool_execution_update`, but the actual event shape has `partialResult` (not `delta`). The field never existed so no tool output ever reached the client — the collapsible output area was always empty.

Fixed in the Next.js version: extract text from `partialResult.content`, send as `{ type: "tool_update", text }` (full accumulated snapshot, not a delta). Client replaces output on each update rather than appending.

### Duplicate key bug

`ToolEntry` was using `tool.name` as the React key. An agent turn that calls `read` twice creates two entries with key `"read"`, triggering React's duplicate key warning and undefined behavior. Fixed by threading `toolCallId` through the wire protocol (`id` field on `tool_start`, `tool_update`, `tool_end`) and using it as the React key and reducer lookup.

---

## Known Limitations / Next Steps

**Extension UI support (`ctx.hasUI`):** Extensions that call `ctx.ui.confirm()`, `ctx.ui.select()`, etc. are silently no-ops. The SDK doesn't expose a hook for this — it requires switching from `createAgentSession()` to RPC mode (`pi --mode rpc` as a child process). RPC mode implements an `extension_ui_request` / `extension_ui_response` sub-protocol. This is the planned next step once the Next.js foundation is stable.

**Tailwind:** CSS is currently the ported original custom stylesheet (CSS variables, dark oracle theme). No Tailwind yet.

**No auth:** Oracle Keep is a local tool with no authentication. Not suitable for network exposure.

**`marked` rendering:** Using `dangerouslySetInnerHTML` for assistant markdown output. Safe for a local single-user tool, not for public deployment.

---

## Key Dependencies

| Package | Role |
|---------|------|
| `@earendil-works/pi-coding-agent` | Pi SDK — session, tools, compaction |
| `@earendil-works/pi-agent-core` | `AgentMessage` type (not re-exported from main package) |
| `next` 15 | Framework |
| `react` 19 | UI |
| `marked` 15 | Markdown rendering in chat bubbles |
