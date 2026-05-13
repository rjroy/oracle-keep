---
title: "Implementation plan: multi-session chat"
date: 2026-05-13
status: approved
tags: [plan, sessions, routing, sidebar, persistence]
modules: [session, chat, routing, sidebar, registry]
related: [.lore/work/specs/multi-session.md]
---

# Plan: Multi-Session Chat

## Spec Reference

**Spec**: `.lore/work/specs/multi-session.md`

Requirements addressed:

- REQ-MULTI-1: Session model (id, cwd, label, addedAt) → Steps 1, 2
- REQ-MULTI-2: Lazy agent init, resident in memory → Step 3
- REQ-MULTI-3: Same URL shares one agent; different URLs are independent → Step 3
- REQ-MULTI-4: Registry persisted as JSON, survives restart → Step 2
- REQ-MULTI-5: Registry stores metadata only; pi session files untouched → Step 2
- REQ-MULTI-6: Sessions reachable at `/s/[id]` → Steps 5, 6
- REQ-MULTI-7: `/` redirects to first session or shows empty state → Step 6
- REQ-MULTI-8: Empty state with disabled composer → Steps 6, 7
- REQ-MULTI-9: Sidebar lists sessions with busy indicator, polling at 10s → Steps 4, 7
- REQ-MULTI-10: Active session visually distinguished → Step 7
- REQ-MULTI-11: Inline "Add session" affordance → Step 7
- REQ-MULTI-12: Server validates path; success navigates, failure shows inline error → Steps 4, 7
- REQ-MULTI-13: Per-entry "forget" action removes from registry → Steps 4, 7
- REQ-MULTI-14: Forgetting active session redirects to `/` → Steps 4, 7
- REQ-MULTI-15: All existing chat features work per session → Steps 3, 5, 8
- REQ-MULTI-16: Busy state scoped per session → Step 3
- REQ-MULTI-17: Inline label rename; blank resets to path segment default → Steps 4, 7

## Codebase Context

- **`lib/session.ts`**: `globalThis.__oracleKeep` singleton with one `sessionPromise`, one `isProcessing` bool, one event buffer, one subscriber map. `CWD` is a module-level constant from `ORACLE_CWD` env. This whole file needs to become a session-keyed map.
- **`lib/history.ts`**: Pure transformation, no session concept. No changes needed.
- **`lib/ui-context.ts`**: Already session-agnostic — takes a `getEnqueue` callback. One instance will be created per session.
- **`app/api/`**: Four flat routes with no session ID. All call into the singleton. Will be superseded by dynamic routes under `/api/s/[id]/` and new session management routes.
- **`app/page.tsx`**: Single server component. Becomes redirect/empty-state logic.
- **`components/Chat.tsx`**: ~700 lines, all session logic hardcoded to flat `/api/` URLs. Gets a `sessionId` prop; all fetch URLs update to `/api/s/[sessionId]/...`. Left rail placeholder is replaced by `<Sidebar>`.
- **`types/chat.ts`**: Four-variant `HistoryItem` union only. Session types will go in a new `types/session.ts`.
- **`server.js`**: Standalone parallel implementation. Deleted in Step 0 — it would break with the restructured API and is not the deployment target.

## Implementation Steps

### Step 0: Delete server.js

**Files**: `server.js`
**Addresses**: Housekeeping (no spec requirement)
**Expertise**: none

Delete `server.js`. It is a standalone parallel implementation that predates the Next.js app. It would break with the restructured API routes, is not the deployment target, and leaving it around creates confusion.

Verify with `git status` that nothing references it in package.json scripts or other config. If a script references it, update the script to remove the reference.

### Step 1: Session types

**Files**: `types/session.ts`
**Addresses**: REQ-MULTI-1, REQ-MULTI-5
**Expertise**: none

Create `types/session.ts` with no SDK imports (safe on both sides of the client/server boundary):

```typescript
export type SessionRecord = {
  id: string;
  cwd: string;
  label: string;
  addedAt: string; // ISO 8601
};

export type SessionRegistry = {
  sessions: SessionRecord[];
};
```

No tests needed — pure types.

### Step 2: Registry module

**Files**: `lib/registry.ts`, `__tests__/lib/registry.test.ts`
**Addresses**: REQ-MULTI-1, REQ-MULTI-4, REQ-MULTI-5, REQ-MULTI-12, REQ-MULTI-13, REQ-MULTI-17
**Expertise**: none

`lib/registry.ts` manages the JSON registry file. Registry path defaults to `~/.oracle-keep/registry.json`, overridable via `ORACLE_REGISTRY_PATH` env var. Use a `globalThis.__oracleKeepRegistry` singleton to survive HMR (same pattern as current `session.ts`).

Internal (not exported):
- `loadRegistry(): Promise<SessionRegistry>` — reads file; returns `{ sessions: [] }` if missing. Called only by `getRegistry` on cold start; external callers must not bypass the singleton.

Functions to export:
- `saveRegistry(registry: SessionRegistry): Promise<void>` — writes atomically (write to temp, rename)
- `getRegistry(): Promise<SessionRegistry>` — reads from the in-memory singleton when already loaded; reads the file only on cold start (when the singleton is absent). This is the authoritative in-memory state; `addSession`, `forgetSession`, and `updateLabel` update it and then call `saveRegistry`.
- `addSession(cwd: string): Promise<SessionRecord>` — generates ID (`crypto.randomUUID()`), derives default label from last path segment (normalize trailing slashes first), appends to registry, saves
- `forgetSession(id: string): Promise<void>` — removes entry, saves
- `updateLabel(id: string, label: string): Promise<SessionRecord | undefined>` — updates label (blank input resets to last segment of cwd), saves, returns the updated `SessionRecord`. Returns `undefined` if the ID is not found; the caller is responsible for mapping that to a 404.
- `findSession(id: string): Promise<SessionRecord | undefined>`

ID generation: `crypto.randomUUID()` (Node built-in, no dependency).

Test coverage required for:
- `addSession`: creates entry, label defaults to last path segment, ID is unique
- `forgetSession`: removes correct entry, leaves others untouched
- `updateLabel`: updates label; blank input resets to last segment of cwd; returns updated record
- `getRegistry` / `saveRegistry`: round-trips correctly (write then read)
- `findSession`: returns record or undefined

Mock the filesystem via dependency injection: each function accepts an optional `fs?: typeof import('fs/promises')` parameter defaulting to the real `fs/promises`. This keeps tests off disk without patching module imports.

### Step 3: Refactor lib/session.ts into a session map

**Files**: `lib/session.ts`, `__tests__/lib/session.test.ts`
**Addresses**: REQ-MULTI-2, REQ-MULTI-3, REQ-MULTI-15, REQ-MULTI-16
**Expertise**: none

Replace the single `globalThis.__oracleKeep` object with `globalThis.__oracleKeepSessions: Map<string, SessionState>`.

`SessionState` is the current singleton's fields, scoped to one session:
```typescript
type SessionState = {
  sessionPromise: Promise<AgentSession>;
  isProcessing: boolean;
  eventBuffer: BufferedEvent[];
  subscribers: Map<string, UIEnqueue>;
  uiContext: WebUIContext;
};
```

Remove the module-level `CWD` constant entirely.

Replace each exported function with a session-keyed variant:
- `getSession(id, cwd)` → lazily creates `SessionState` for that `(id, cwd)` pair if not present. Uses `SessionManager.continueRecent(cwd)` as before.
- `isProcessingSession(id)` → reads `isProcessing` from the session's state
- `setProcessingSession(id, value)` → sets it
- `broadcastEventToSession(id, event)` → fans out to that session's subscribers and buffer
- `addSubscriberToSession(id, ...)` / `removeSubscriberFromSession(id, ...)`
- `getEventBufferForSession(id)` / `clearEventBufferForSession(id)`
- `getWidgetSnapshotForSession(id)`

Keep the same `globalThis` HMR guard, but wrap the map instead of the singleton.

Two specifics to get right:
- `isProcessingSession(id)` must return `false` (not throw) for sessions not yet in the Map. A session that hasn't been used is not processing by definition. `GET /api/sessions` calls this for every registered session on every poll, including sessions that haven't received a message since server start.
- The `getEnqueue` callback passed to `createWebUIContext` must close over the session `id` and call `broadcastEventToSession(id, ...)`. Each `SessionState` gets its own `uiContext` instance with its own closure — events from one session must not reach another session's subscribers.

Remove the module-level `CWD` constant. `ORACLE_CWD` is no longer read anywhere after this step.

Test coverage required for:
- Two calls to `getSession` with the same ID return the same state object (same session)
- Two calls to `getSession` with different IDs return independent state objects (REQ-MULTI-3, REQ-MULTI-16)
- `isProcessingSession` returns `false` for a session not yet in the Map
- `setProcessingSession` and `isProcessingSession` affect only the targeted session

### Step 4: Session management API routes

**Files**: `app/api/sessions/route.ts`, `app/api/sessions/[id]/route.ts`
**Addresses**: REQ-MULTI-4, REQ-MULTI-12, REQ-MULTI-13, REQ-MULTI-17
**Expertise**: none

`GET /api/sessions` — reads registry, enriches each session with `isProcessing` from session-store, returns:
```typescript
type SessionListItem = SessionRecord & { isProcessing: boolean };
```

`POST /api/sessions` — body: `{ cwd: string }`. Validates path exists and is a directory using `fs.stat`. On success, calls `addSession(cwd)`, returns `201` with the new `SessionRecord`. On failure (path invalid or not a directory), returns `400` with `{ error: string }`.

`PATCH /api/sessions/[id]` — body: `{ label: string }`. Calls `updateLabel(id, label)`. If the result is `undefined`, returns `404`. Otherwise returns `200` with the updated `SessionRecord`.

`DELETE /api/sessions/[id]` — calls `findSession(id)` first; returns `404` if not found. On success, calls `forgetSession(id)` and returns `204`.

These are API routes only — no unit tests (follows existing project pattern for `app/api/` routes).

### Step 5: Per-session API routes

**Files**: 
- `app/api/s/[id]/chat/route.ts`
- `app/api/s/[id]/history/route.ts`
- `app/api/s/[id]/status/route.ts`
- `app/api/s/[id]/widgets/route.ts`
**Addresses**: REQ-MULTI-6, REQ-MULTI-15
**Expertise**: none

Port each existing API route to a `[id]`-scoped version. Changes in each:
- Extract `id` from `params`
- Look up `cwd` via `findSession(id)`; return `404` if session not registered
- Replace all calls to the old singleton API with the session-keyed variants from Step 3 (`getSession(id, cwd)`, `isProcessingSession(id)`, etc.)

The route logic itself (SSE streaming, event buffer replay, history serialization) is unchanged in structure. Every call into the session.ts API surface changes: `getSession`, `isProcessing`, `setProcessing`, `broadcastEvent`, `addSubscriber`, `removeSubscriber`, `getEventBuffer`, `clearEventBuffer`, and `getWidgetSnapshot` all receive an `id` argument in the new API. The chat route alone has ~9 such call sites. Treat Step 5 as a full find-and-replace of the session.ts API surface, not just a session lookup addition.

The old flat routes (`app/api/chat/route.ts`, `app/api/history/route.ts`, `app/api/status/route.ts`, `app/api/widgets/route.ts`) are deleted in the same commit as the new routes are created. Don't leave both coexisting — the old routes still call the singleton API which no longer exists after Step 3.

No unit tests for API route handlers (consistent with project convention).

### Step 6: App Router pages

**Files**: `app/page.tsx`, `app/s/[id]/page.tsx`, `app/layout.tsx`
**Addresses**: REQ-MULTI-6, REQ-MULTI-7, REQ-MULTI-8
**Expertise**: none

**`app/page.tsx`** (server component): Load registry, redirect to `/s/[first.id]` if non-empty, else render a plain empty-state UI — informational text directing the user to add a session via the sidebar. No `<Chat>` component and no composer in this path. Remove the `ORACLE_CWD` read that currently lives here.

**`app/s/[id]/page.tsx`** (server component): Validate that `id` exists in registry; call `notFound()` if not (the default Next.js 404 behavior is acceptable for this version — no `not-found.tsx` required). Load the session record. Render only `<Chat sessionId={id} />`. Do not render `<Sidebar>` here — it lives in layout.

**`app/layout.tsx`**: Update `RootLayout` to render `<Sidebar>` as a persistent shell element alongside `{children}`. Sidebar renders on all routes — session pages, `/`, and any 404. Also remove the `ORACLE_CWD` read if it exists in layout.

### Step 7: Sidebar component

**Files**: `components/Sidebar.tsx`
**Addresses**: REQ-MULTI-8, REQ-MULTI-9, REQ-MULTI-10, REQ-MULTI-11, REQ-MULTI-12, REQ-MULTI-13, REQ-MULTI-14, REQ-MULTI-17
**Expertise**: none

`<Sidebar sessionId?: string />` — client component.

Behavior:
- On mount, fetches `GET /api/sessions` and sets local state
- Polls `GET /api/sessions` every 10 seconds to update busy indicators (10-second polling is a plan decision — the spec requires a busy indicator but does not prescribe the update mechanism)
- Renders a list of session entries. Each entry:
  - Shows `label` and a busy indicator if `isProcessing`
  - Active entry (matching `sessionId` prop) is visually distinguished
  - Inline rename affordance: clicking the label reveals an input; blur/enter saves via `PATCH /api/sessions/[id]`; empty save resets to default (server handles this). On success, refresh the session list immediately (don't wait for the 10-second poll) so the reset label is visible right away.
  - "Forget" button calls `DELETE /api/sessions/[id]`; if the deleted session matches `sessionId`, uses `router.push('/')` to redirect (REQ-MULTI-14)
- "Add session" affordance at the bottom: clicking reveals an inline input for a path. Submitting calls `POST /api/sessions`. On success, navigates to `/s/[newId]`. On failure, shows the error inline without navigating (REQ-MULTI-12).
- Empty state: when sessions list is empty, shows the empty prompt (REQ-MULTI-8). The sidebar itself is still present so the "Add session" affordance is accessible.

Uses `useRouter` and `usePathname` from `next/navigation`.

No unit tests (component; tested manually via success criteria checklist).

### Step 8: Update Chat.tsx

**Files**: `components/Chat.tsx`
**Addresses**: REQ-MULTI-15
**Expertise**: none

- Add `sessionId: string` prop. Replace all hardcoded `/api/chat`, `/api/history`, `/api/status`, `/api/widgets` calls with `/api/s/${sessionId}/chat` etc.
- Remove the `cwd` prop (display logic moves to Sidebar or topbar in layout). Update call sites in `app/s/[id]/page.tsx`.
- Remove the left rail placeholder ("The archivist keeps no scrolls yet") — the `<Sidebar>` in layout takes over.
- The empty state (REQ-MULTI-8) is rendered in `app/page.tsx` and `Sidebar`, not in `Chat.tsx` — `Chat.tsx` can assume it always has a valid session.

### Step 9: Validate Against Spec

Launch a sub-agent that reads the spec at `.lore/work/specs/multi-session.md`, reviews the implementation across all modified files, and flags any requirements not met. Work through the success criteria checklist manually (two-tab test, busy independence, registry restart survival). This step is not optional.

## Delegation Guide

No steps require specialized expertise beyond general Next.js/TypeScript. Steps 1–3 (types, registry, session store) should be completed and tested before Steps 4–5 (API routes) begin. Steps 6–8 (frontend) can proceed once Steps 4–5 are in place.

Steps that can be parallelized once their dependencies are met:
- Steps 4 and 5 (session management API + per-session API) — both depend on Step 3, but are independent of each other
- Steps 6, 7, and 8 (pages, sidebar, Chat update) — all depend on Steps 4–5, but are independent of each other

## Open Questions

- The existing flat API routes (`/api/chat`, etc.) will be deleted in Step 5. Confirm there are no external callers (bookmarks, scripts) that depend on the old URLs before deleting.
