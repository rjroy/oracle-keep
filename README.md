# Oracle Keep

> A web chat interface for the Pi coding agent

Oracle Keep is a local browser-based chat interface that wraps `createAgentSession` from [`@earendil-works/pi-coding-agent`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent). It provides a conversational UI for interacting with the Pi coding agent directly from your terminal's working directory.

## Features

- **Interactive Chat Interface**: Full conversation history with streaming responses
- **Session Persistence**: Sessions survive server restarts using the `.pi/agent/sessions/` storage
- **Tool Execution**: View agent tool calls and their results in real-time
- **Context Management**: Automatic compaction when context window is approaching limits
- **Markdown Rendering**: Beautifully formatted responses with code snippets
- **Dark Theme**: Oracle-inspired aesthetic with custom CSS styling

## Quick Start

### Prerequisites

- Node.js 20+ with `bun` installed
- A configured working directory (default: current directory)

### Installation

```bash
# Install dependencies
bun install

# Start development server
bun dev
```

### Usage

```bash
# Development mode (hot reload)
bun dev

# Build for production
bun run build

# Start production server
bun run start
```

Visit `http://localhost:3000` to chat with the agent.

## Project Structure

```
app/
  api/
    chat/route.ts     # SSE streaming endpoint
    history/route.ts  # Conversation history endpoint
  globals.css         # Custom dark theme styles
  layout.tsx
  page.tsx
components/
  chat/               # Chat UI components
  sidebar/            # Sidebar components
  icons.tsx
lib/
  history.ts         # Build conversation history
  oracle-extension.ts # Pi session configuration
  registry.ts        # Tool registry
  session.ts         # Pi session singleton
  ui-context.ts      # UI context for agent
types/
  chat.ts            # Shared TypeScript types
__tests__/
  lib/               # Unit tests (mirrors lib/ structure)
.lore/               # Documentation artifacts
```

## Development

### Run Tests

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Target coverage >= 80% for lib/
```

### Type Check

```bash
npm run typecheck

# Runs tsc on both app code and test code
```

### Lint

```bash
npm run lint

# Target: zero errors
```

### Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start development server |
| `bun build` | Build for production |
| `bun start` | Start production server |
| `bun test` | Run unit tests |
| `bun test --coverage` | Run tests with coverage |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript type checking |

## Architecture

### Session Management

The application uses a singleton session pattern via `globalThis.__oracleKeep` to persist the Pi agent session across hot-module reloads in development:

```typescript
// lib/session.ts
globalThis.__oracleKeep ??= createAgentSession({
  cwd: process.env.ORACLE_CWD ?? process.cwd(),
  tools: registry,
})
```

### Streaming Protocol

The chat uses Server-Sent Events (SSE) for real-time updates:

1. Client sends `POST /api/chat` with `Authorization` token
2. Server creates a `ReadableStream` with SSE framing
3. Client receives incremental updates:
   - User messages
   - Assistant text (incremental streaming)
   - Tool call groups
   - Individual tool results
   - Context compaction events

### State Machine

Chat state is managed via `useReducer` covering all streaming scenarios:

- User message submission
- Assistant text streaming
- Tool execution lifecycle
- Context compaction banners
- Error handling

## Testing Guide

Before committing changes, run all verification checks:

```bash
# 1. Tests (all must pass)
bun test

# 2. Coverage (lib/ must be >= 80%)
bun test --coverage

# 3. Type checking (zero errors)
npm run typecheck

# 4. Linting (zero errors)
npm run lint
```

### Test Setup Notes

- Test files live in `__tests__/lib/`, mirroring the `lib/` structure
- Tests use `bun:test` instead of vitest/jest
- Mock `@earendil-works/pi-coding-agent` in any test importing `lib/session.ts`
- API routes require integration tests; not covered by unit tests

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ORACLE_CWD` | Working directory for the Pi agent | `process.cwd()` |

## Known Limitations

- **No Extension UI Support**: `ctx.ui.confirm()`, `ctx.ui.select()` are currently no-ops. Requires migration to RPC mode (`pi --mode rpc`) for full UI interaction.
- **Local Use Only**: No authentication; not suitable for network exposure.
- **DangerouslySetInnerHTML**: Markdown rendered via `marked` uses `dangerouslySetInnerHTML`. Safe for local use, not for public deployment.
- **No Tailwind**: Custom CSS (no Tailwind utilities yet).

## Browser Compatibility

Oracle Keep runs in any modern browser supporting:
- Server-Sent Events (SSE)
- ReadableStream
- ES2020+ features

## Related Projects

- [`@earendil-works/pi-coding-agent`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) - The Pi SDK this integrates with
- [`@earendil-works/pi`](https://github.com/earendil-works/pi) - The Pi monorepo (agent core, AI layer, TUI)

## License

Private / Internal Use Only

---

## Contributing

Please read [AGENTS.md](./AGENTS.md) for the full agent development workflow and verification steps.
