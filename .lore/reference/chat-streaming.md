---
title: Chat Streaming Invariants
date: 2026-05-14
status: current
tags: [chat, streaming, SSE, sessions]
modules: [lib/session, app/api/s/[id]/chat]
---

# Session Binding

Every session is bound to a single working directory for its lifetime. A session started in `./my-projects` will never query files outside that directory. Even if the browser navigates to `http://localhost/s/xyz`, that session file lives in `./my-projects/*.jsonl`. The client only shows the working directory label from `record.cwd`, never guesses it.

**Affected code**: `lib/registry.ts:deriveLabel()`, `lib/oracle-extension.ts:session_start`, `app/api/s/[id]/chat/route.ts`.

---

## `/new` Command Behavior

The `/new` command does not send a message to the agent. It creates a fresh `.jsonl` file.

- Code performs: `getSession(id, cwd, { fresh: true })` -> single `navigate` event -> stream closes
- No assistant message is sent
- Only one SSE subscriber receives one event

---

## Disconnection Behavior

Client disconnects (tab close, network drop) -> session continues running in the background.

- `cancel()` handler removes the subscriber but does NOT call `session.abort()`
- `session.prompt()` runs asynchronously and fires `.done()` when complete even if client is gone
- Metadata discovered by the agent (tool registrations) persist across disconnects/reconnects

---

## Event Replay Guarantee

SSE streams replay ALL events from the event buffer before subscribing. A subscriber registered on mount immediately receives replayed events, then subscribes for live fire-and-forget dispatch. This guarantee prevents missing events between page refresh and stream connection.

---

## Tool Output Model

Tool results stream as accumulated snapshots, never deltas. Tool updates always replace output in the UI rather than appending. An initial empty output is sent, then full content arrives, then future full snapshots. Client-side reducers handle `tool-update` by replacing, never appending.

---

## Fire-and-Forget Model

The agent turn runs independently regardless of client connection state. The response returns immediately, the turn runs to completion, and `.done()` fires when complete even if the client disconnected. This means metadata (tool registrations, command lists) persist across disconnects until the agent naturally ends or compacts.

---

## Buffer Replay Before Subscribe

Subscriber registration happens BEFORE buffer replay, so no events are lost between replay and live dispatch. A reader might assume only streaming events are received; the code shows buffer replay is mandatory. This invariant applies to all GET/POST stream connections.

---

## Compaction Banner Visibility

When automatic compaction runs, a temporary UI banner renders for 3 seconds only:
- `compaction_start` -> render pill + spinner
- After 3s -> render "✓ Context compacted"
- After 3s -> remove from DOM entirely

Automatic compaction triggers when context tokens exceed `contextWindow - 16384`. The user never chooses when it runs.
