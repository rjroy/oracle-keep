# Pi Extensions in Oracle-Keep

Investigation notes and implementation plan.

## What Extensions Are

TypeScript modules loaded from `~/.pi/agent/extensions/` (global) or `.pi/extensions/` (project-local). They attach to the agent lifecycle via eight capabilities: custom tools, event hooks, custom commands, gate/intercept, session persistence, custom providers, message injection, and UI.

## Current State

`createAgentSession()` already discovers and loads extensions. Oracle-Keep discards `extensionsResult` from the return value, and never calls `session.bindExtensions()`.

Consequence:

- **Non-UI features already run.** Event hooks (`tool_call` gating, `before_agent_start` system prompt injection), custom tools, session persistence, provider registration — all operate at the agent layer. Drop a file in `~/.pi/agent/extensions/` and it fires today.
- **UI calls silently no-op.** `ctx.ui.select/confirm/input/notify/setStatus` all return defaults (`undefined`, `false`) because `ExtensionRunner` has no `uiContext`. `ctx.hasUI` is false.

## The SDK Hook

`AgentSession.bindExtensions()` is the bridge:

```ts
session.bindExtensions({
  uiContext: myWebUIContext,  // implements ExtensionUIContext
});
```

`ExtensionUIContext` splits into two categories:

**Fire-and-forget**: `notify`, `setStatus`, `setWorkingMessage`, `setWorkingVisible` — no return value, extension doesn't wait.

**Async dialogs**: `select`, `confirm`, `input` — return a Promise the extension awaits. Extension is blocked until the user responds.

## Implementation Plan (in order of complexity)

### Phase 1 — Non-UI extensions (already works, validate)

Verify that a minimal extension file in `.pi/extensions/` actually runs against the Oracle-Keep session. Confirm custom tools appear, event hooks fire, `ctx.hasUI` is false.

No code changes required. Smoke test only.

### Phase 2 — Fire-and-forget UI

**What**: `notify()`, `setStatus()`, `setWorkingMessage()`, `setWorkingVisible()`

**How**:
1. Retain the session's `extensionRunner` after `createAgentSession()`
2. Call `session.bindExtensions({ uiContext })` with an implementation that emits new SSE event types
3. Add to `/api/chat` stream: `notify`, `status` event types
4. Add toast/status rendering to `Chat.tsx`

New SSE events:
```
data: {"type":"notify","message":"...","level":"info|warning|error"}
data: {"type":"status","key":"my-ext","text":"..."}   // text: null to clear
```

No response needed from client.

### Phase 3 — Async dialogs

**What**: `confirm()`, `select()`, `input()`

**How**:
1. Add a `Map<string, (value: any) => void>` to the server singleton for pending UI promises
2. When extension calls a dialog method: create a pending entry, emit `ui_request` over the active SSE stream, await the promise
3. Add `/api/ui-response` POST route: receives `{ requestId, response }`, resolves the pending promise
4. Add `ui_request` SSE event handling to `Chat.tsx`: render modal dialogs, POST response on user action

New SSE event:
```
data: {"type":"ui_request","requestId":"abc123","kind":"confirm","title":"...","message":"..."}
data: {"type":"ui_request","requestId":"abc123","kind":"select","title":"...","options":["A","B"]}
data: {"type":"ui_request","requestId":"abc123","kind":"input","title":"...","placeholder":"..."}
```

Client POST:
```
POST /api/ui-response
{ "requestId": "abc123", "response": true }
```

**Complication**: SSE stream is per-turn (opens on POST `/api/chat`, closes after `done`). Async dialogs called mid-tool-execution work fine — stream is alive. Dialogs called outside a turn (e.g., `session_start`) have nowhere to send.

For now: accept that out-of-turn dialogs go nowhere. The primary use case (permission gates during tool execution) is in-turn.

### Phase 4 — Out-of-turn notifications (future)

Requires a persistent connection. Options: WebSocket, server-sent notification queue the client polls on mount.

Deferred — low value until someone actually builds an extension that needs it.

## Installed Extensions

One hand-written extension, three installed via `pi install` (stored in global node_modules alongside pi, referenced from `~/.pi/agent/settings.json` under `"packages"`):

| Extension | Location | UI usage |
|-----------|----------|----------|
| `dotfiles.ts` | `~/.pi/agent/extensions/dotfiles.ts` | None — `resources_discover` + `before_agent_start` only |
| `@pi-unipi/compactor` | global node_modules | `ctx.ui.notify()` on session start |
| `pi-subagents` | global node_modules | `ctx.hasUI` guards on `setToolsExpanded` and status display |
| `pi-web-access` | global node_modules | `ctx.ui.notify()`, `ctx.ui.setWidget()`, `ctx.ui.select()` (async dialog for browsing stored results) |

`pi-web-access` is the only one hitting Phase 3 (async dialogs). It also uses `setWidget()` for a live "web activity" panel during searches — that's Phase 2 but requires the client to render arbitrary widget content, not just a toast. It also gates `resolveWorkflow()` on `ctx.hasUI` to decide whether to open the search curator.

## Key Files

- `lib/session.ts` — `createAgentSession` call; needs to retain session and call `bindExtensions`
- `app/api/chat/route.ts` — SSE stream; needs new event types emitted from `uiContext`
- `app/api/ui-response/route.ts` — new route for Phase 3 dialog responses
- `components/Chat.tsx` — client-side rendering for notifications and dialogs

## References

- `AgentSession.bindExtensions(bindings: ExtensionBindings)` — `dist/core/agent-session.d.ts:466`
- `ExtensionUIContext` interface — `dist/core/extensions/types.d.ts`
- `ExtensionRunner.setUIContext()` — called internally by `bindExtensions`
- `ctx.hasUI` — false when no uiContext is bound
