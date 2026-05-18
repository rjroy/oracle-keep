# Contributing to Oracle Keep

This document guides agents (you) through the development workflow for this Next.js project.

## Before You Start

Always run the **Required Checks** after any changes before committing:

```bash
# 1. All tests must pass
bun test

# 2. Test coverage must be >= 80% for lib/
bun test --coverage

# 3. TypeScript must have zero errors
npm run typecheck

# 4. Linting must have zero errors
npm run lint
```

## Project Layout

```
app/
  api/           Next.js API routes (server components, SSR)
  globals.css    Custom styles (dark theme)
  layout.tsx     Root layout
  page.tsx       Home route
components/
  chat/          Chat UI components
  sidebar/       Sidebar components
lib/
  session.ts     Pi session singleton via globalThis pattern
  history.ts     History building logic
  registry.ts    Tool registry
  ui-context.ts  UI context for agent
  oracle-extension.ts # Pi extension configuration
types/           Shared types (no SDK imports - safe for client/server)
__tests__/       Unit tests (bun:test)
  lib/           Mirrors lib/ structure with test files
.lore/           Documentation artifacts (specs, designs, notes)
```

## TypeScript Rules

### Type Discipline

- **Never use `any`** - Use unknown and cast only when necessary
- **Prefer `unknown` over `any`** for user inputs, event handlers, callbacks
- **No `never` assertions** - If you have `never` in your code, investigate
- Use readonly properties for immutability
- Use strict null checks (`noImplicitAny: true`)

### No SDK Imports in types/

Files in `types/` must NOT import from `@earendil-works/pi-coding-agent`. This keeps the types module safe for both client and server rendering. If you need SDK types, import in `lib/` or `lib/session.ts` instead.

### Example Type Usage

```typescript
// ❌ Bad: Using any
function handleUpdate(data: any) {
  return data.text;
}

// ✅ Good: Using unknown with controlled narrowing
function handleUpdate(text: unknown) {
  if (typeof text !== "string") {
    throw new Error("Expected string");
  }
  return text;
}

// ✅ Good: Using specific types
interface ToolResult {
  id: string;
  name: string;
  content: string;
}
```

### Type Definition Conventions

```typescript
// types/chat.ts
export interface HistoryItem {
  id: string;
  type: "user-message" | "assistant-message" | "tool-start" | "tool-end";
  content: string;
  createdAt: number;
}
```

- Use PascalCase for interfaces/classes
- Use `export interface` for shared types
- Keep types in alphabetical order within a file

## Library Usage (lib/)

You have access to the following Pi SDK modules:

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "@earendil-works/pi-agent-core"; // not re-exported

// Session singleton (for HMR safety)
globalThis.__oracleKeep ??= createAgentSession({
  cwd: process.env.ORACLE_CWD ?? process.cwd(),
  tools: registry,
});

// Use globalThis.__oracleKeep for any logic needing the session
```

### Pure Functions vs Stateful Code

- **lib/history.ts** - Pure functions that transform data
- **lib/session.ts** - Stateful singleton (no tests possible due to globalThis)
- **lib/registry.ts** - Pure functions and constants only
- **lib/ui-context.ts** - Context state (may need testing via indirect approach)

### Testing Patterns

1. **Pure functions** - Import from `bun:test`, 100% coverage required
2. **Session-dependent code** - Mock the globalThis import:
   ```typescript
   // __tests__/lib/session.test.ts
   import * as sessionModule from "bun:test/mock.module" as typeof import.meta.url;
   
   it("does not throw", () => {
     delete globalThis.__oracleKeep;
     // test logic here
   });
   ```
3. **Side effects** - Accept <80% coverage if justified

### Session Mock Pattern

```typescript
// __tests__/lib/session.test.ts
import { jest } from "@jest/globals"; // or bun:test equivalent
import * as sessionModule from "bun:test/mock.module";

// In tests requiring mocked session:
beforeEach(() => {
  delete globalThis.__oracleKeep;
});
```

## Testing Rules

### File Structure

```
__tests__/
  lib/
    history.test.ts      # mirrors lib/history.ts
    registry.test.ts     # mirrors lib/registry.ts
    session.test.ts      # mirrors lib/session.ts (with mock)
```

### Coverage Requirements

- **lib/** - Must stay at 80%+ line coverage
- **app/** - Not measured (infrastructure code)
- **components/** - Not measured (requires Next.js infra)

### Running Tests

```bash
# Full test suite
bun test

# With coverage (check lib/ is >= 80%)
bun test --coverage

# Specific file
bun test __tests__/lib/history.test.ts
```

### Test Quality

- Use meaningful test names (describe the scenario, not the code path)
- Test happy path + edge cases + error conditions
- Don't test implementation details, test behavior
- Each test should pass or fail independently

## Component Structure (components/)

### Server vs Client Components

```tsx
// ✅ Server component (default)
export default async function Page() {
  const data = await fetchData(); // Server-side only
  return <ComponentClient className="dark-mode" />;
}

// ✅ Client component
export function ComponentClient({ className }) {
  const [state, setState] = useState("");
  return <div className={className}>{state}</div>;
}
```

### Component Naming

- `Page` for route pages
- `ComponentName` for reusable pieces
- `ComponentNameButton` for compound components

### State Management

Use `useReducer` over `useState` for complex state machines:

```tsx
import { useReducer } from "react";

type ChatState = {
  userMessages: HistoryItem[];
  assistantMessages: HistoryItem[];
  toolCalls: ToolEntry[];
  isStreaming: boolean;
  error: string | null;
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  // ...
}
```

## Git Workflow

All work happens on branches. `master` is locked.

```bash
# Create branch
git checkout -b feature/your-feature-name

# Make changes
# (run required checks before committing)

# Commit
git commit -m "feat: add new chat streaming handler"

# Push and create PR
git push origin feature/your-feature-name
```

### Commit Messages

Use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code change that neither fixes nor adds feature
- `test:` - Adding tests
- `chore:` - Maintenance

## Code Quality

### File Size & Complexity

- **Files <200 lines** preferred
- **Single responsibility** per file
- **No large switch statements** - use object/pattern matching
- **Avoid deeply nested code** - extract to functions

### Naming Conventions

```typescript
// ✅ Good names
const userId: string = "123";
const isUserOnline: boolean = true;
const calculateTotal: () => number = () => {...};

// ❌ Vague names
const data = getUser();
const x = calculate();
const process = handleEvent();
```

### Error Handling

```typescript
// ✅ Specific errors
class ChatNotFoundError extends Error {
  constructor() {
    super("Chat not found");
    this.name = "ChatNotFoundError";
  }
}

// ✅ Handle async errors
try {
  await session.send();
} catch (error) {
  logger.error(error as Error);
  return onError(error);
}
```

## Documentation

### When to Write Docs

- New features or APIs
- Complex logic that isn't obvious
- Workflows that need explanation
- Known limitations

### Documentation Locations

- **README.md** - High-level overview for users
- **AGENTS.md** - Agent workflow and verification steps
- **CONTRIBUTING.md** - Coding standards (this file)
- **.lore/** - Technical specs, designs, session notes
  - `reference/` - Stable docs
  - `work/` - In-progress work
  - `sessions/` - Development notes

### Doc Style

- Write for the audience (user vs developer vs agent)
- Use code blocks for examples
- Keep sections focused
- Link to related docs

## API Routes (app/api/)

### Route Handler Structure

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const sessionId = request.headers.get("Authorization");
  
  if (!sessionId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Create SSE stream
  const stream = generateStream(sessionId);
  
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

### Common Responses

```typescript
// Success
return NextResponse.json({ id: "123", name: "hello" });

// Error
return NextResponse.json(
  { error: "Message not found" },
  { status: 404 }
);

// SSE error frame (stream only)
stream.controller.error(new Error("Chat not found"));
```

## CSS Styling

Currently using custom CSS (no Tailwind). Follow these patterns:

```css
/* globals.css */
:root {
  /* Define CSS variables */
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --accent: #60a5fa;
}

/* Dark theme defaults */
body {
  background: var(--bg-primary);
  color: var(--text-primary);
}
```

## Security Notes

- **No authentication** - This is a local tool only
- **Never expose to network** - Not suitable for public use
- **`dangerouslySetInnerHTML`** - Safe for local use only
- **Handle API tokens** - Use `Authorization` header, never in URLs

## Common Tasks

### Adding a New Tool to the Agent

1. Define tool schema in `lib/registry.ts`
2. Add handler in `lib/oracle-extension.ts`
3. Update types if needed
4. Test: `bun test`

### Fixing a Bug

1. Create branch: `git checkout -b fix/short-description`
2. Write a test for the bug (before fixing)
3. Fix the code
4. Verify: `bun test`, `npm run typecheck`, `npm run lint`
5. Commit and PR

### Adding a New Component

```tsx
// components/chat/ChatInput.tsx
"use client";

import { useState } from "react";

export function ChatInput() {
  const [message, setMessage] = useState("");
  
  const handleSubmit = (e: React.FormEvent) => {
    // Handle submission
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button type="submit">Send</button>
    </form>
  );
}
```

1. Place in correct subdirectory
2. Export from index.ts if reusable
3. Add to layout/page as needed
4. Test in browser

## Performance Tips

- **Streams** - Use SSE for large responses (not bulk JSON)
- **Memoize** - Use `useMemo` for expensive recalculations
- **Debouncing** - Limit rapid stream events
- **Error boundaries** - Wrap client components in ErrorBoundary

## Accessibility

- Use semantic HTML (`<button>` not `<div onClick>`)
- Add `aria-label` when needed
- Ensure color contrast (check your CSS variables)
- Support keyboard navigation

## Final Checklist

Before committing:

- [ ] `bun test` passes
- [ ] `bun test --coverage` shows lib/ at 80%+
- [ ] `npm run typecheck` has zero errors
- [ ] `npm run lint` has zero errors
- [ ] Code comments explain "why", not "what"
- [ ] No `any` types (unless explicitly allowed)
- [ ] No overlapping/nested edits in a single file
- [ ] PR description explains the change
- [ ] Linked issue exists (if applicable)

## Getting Help

- Read `AGENTS.md` for agent workflow
- Check `.lore/` for technical decisions
- Review existing code in `lib/` and `app/api/`
- Look at test files in `__tests__/lib/` for patterns
