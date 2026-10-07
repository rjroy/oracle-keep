---
title: Multi-session chat
date: 2026-05-13
status: draft
tags: [sessions, routing, sidebar, persistence]
modules: [session, chat, routing, sidebar]
req-prefix: MULTI
legacy_source_type: spec
---

# Spec: Multi-Session Chat

## Overview

Oracle Keep currently supports exactly one session tied to the directory passed via `--cwd` at startup. This feature allows multiple sessions — each backed by its own pi agent and working directory — to coexist in the same running server. Sessions are listed in the sidebar, routed by URL, and persisted to disk so they survive server restarts.

## Entry Points

- Navigating to `/` with no sessions registered (first run or empty registry)
- Navigating to `/` with sessions already registered
- Clicking a session in the sidebar
- Navigating directly to `/s/[id]` by URL

## Requirements

**Session model**

- REQ-MULTI-1: A session is a persistent association between a unique ID and a filesystem directory (cwd). It has a label (defaults to the last path segment of cwd, e.g. `/a/b/c` → `c`), a creation timestamp, and an ID.
- REQ-MULTI-2: Each session maintains its own pi agent instance. Agents are lazy-loaded on first use for a session and remain resident in memory until the server stops. There is no eviction policy in this version.
- REQ-MULTI-3: Two clients connecting to the same session URL share one agent. Two clients connecting to different session URLs operate independently.

**Persistence**

- REQ-MULTI-4: The session registry is persisted to a JSON file on the server. It survives server restarts; all registered sessions are available again after restart.
- REQ-MULTI-5: The registry stores metadata only (id, cwd, label, addedAt). Pi session files (conversation history, compaction state) are managed by the existing `SessionManager` and are not affected by registry operations.

**Routing**

- REQ-MULTI-6: Each session is reachable at `/s/[id]`. This URL can be bookmarked, shared, or opened in a new tab.
- REQ-MULTI-7: The root route `/` redirects to the first session if the registry is non-empty, or shows the empty state if not.

**Empty state**

- REQ-MULTI-8: When no sessions are registered, the chat area shows a prompt explaining that no sessions exist and directing the user to add one via the sidebar. The composer is disabled in this state.

**Sidebar**

- REQ-MULTI-9: The sidebar lists all registered sessions. Each entry shows the session's label and indicates whether the session's agent is currently busy.
- REQ-MULTI-10: The currently active session (matching the URL) is visually distinguished.
- REQ-MULTI-11: The sidebar provides an "Add session" affordance. Activating it reveals an inline text input for a directory path and a confirm action.
- REQ-MULTI-12: When a new session is submitted, the server validates that the path exists and is a directory. On success, the session is added to the registry and the client navigates to the new session's URL. On failure, an inline error is shown.
- REQ-MULTI-13: Each session entry has a "forget" action. Forgetting removes the session from the registry. It does not delete the underlying pi session files.
- REQ-MULTI-14: If the user is viewing a session that gets forgotten, they are redirected to `/`.

**Chat**

- REQ-MULTI-15: All existing chat features (history load, streaming, tools, thinking blocks, compaction) work independently per session.
- REQ-MULTI-16: The busy state (agent processing a turn) is scoped to each session independently. One session being busy does not prevent another session from accepting messages.

**Labels**

- REQ-MULTI-17: Session labels are editable. The sidebar provides an inline rename affordance on each session entry. Saving an empty label resets it to the last path segment default.

## Exit Points

| Exit | Triggers When | Target |
|------|---------------|--------|
| Open session | User clicks session in sidebar | `/s/[id]` |
| Add session success | Valid path submitted | `/s/[new-id]` |
| Forget active session | User forgets the session they're viewing | `/` |
| Empty state | Registry is empty | `/` (empty state) |

## Out of Scope (this version)
- Destructive delete (removing pi session files from disk)
- Session reordering
- Idle session eviction
- Session export or archiving

## Success Criteria

- [ ] A newly added session's label defaults to the last segment of the path
- [ ] Renaming a session label persists across page reload
- [ ] Saving a blank label resets it to the last path segment default
- [ ] Starting the server with a saved registry restores all sessions in the sidebar
- [ ] Navigating to `/s/[id]` loads the correct session history and connects to the correct agent
- [ ] Two browser tabs on the same `/s/[id]` both see the same stream
- [ ] Two browser tabs on different `/s/[id]` URLs operate independently (one busy does not block the other)
- [ ] Adding a session with a valid path creates it and navigates there
- [ ] Adding a session with an invalid path shows an inline error without navigating
- [ ] Forgetting a session removes it from the sidebar; if it was active, redirects to `/`
- [ ] Session registry survives a server restart; all sessions reappear in the sidebar

## AI Validation

**Defaults apply:**
- Unit tests with mocked filesystem/session dependencies
- 80%+ line coverage on new `lib/` code (matching existing project threshold)
- TypeScript typecheck passes, lint clean

**Custom:**
- Registry persistence: test that writing then reading the registry file round-trips correctly
- Lazy init: test that two sessions with different CWDs produce independent agent states

## Constraints

- Server is Node.js / Next.js with no database; JSON file is the persistence layer.
- The pi `SessionManager.continueRecent(cwd)` API is used per-session; its behavior is not changed.
- Client routing uses Next.js App Router dynamic segments.
- No authentication — any client with network access can manage sessions.

## Context

Conversation context: lazy memory model (agents stay resident, no eviction). URL-based routing so each tab can independently hold a different session. First-load empty state in the chat area rather than auto-redirecting somewhere.
