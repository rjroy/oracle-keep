# Oracle Keep — Agent Guidelines

This file documents the verification steps every agent must run before declaring work complete.

## Required Checks

Run all three before marking any task done. They are fast and non-destructive.

```bash
# Tests with coverage
bun test --coverage

# TypeScript — app code and test code are checked separately
npm run typecheck

# Lint
npm run lint
```

### Passing criteria

- `bun test`: all tests pass, no failures
- `bun test --coverage`: line coverage stays at or above 80% across `lib/`
- `npm run typecheck`: zero errors (runs `tsc --noEmit` for app code, then again with `__tests__/tsconfig.json` for tests)
- `npm run lint`: zero errors (pre-existing warnings in `components/Chat.tsx` about `<img>` vs `<Image>` are known and acceptable until that component is updated)

## Project Structure

```
app/          Next.js routes and API handlers
components/   React components
lib/          Server-side logic (history, session, ui-context)
types/        Shared TypeScript types — no SDK imports, safe on both sides
__tests__/    Unit tests (bun test)
  lib/        Mirrors lib/ structure
  tsconfig.json  Separate tsconfig that adds bun-types
```

## Test Setup

- Runner: `bun test`
- Test files live in `__tests__/` and mirror the `lib/` directory structure
- Tests use `bun:test` — import from `"bun:test"`, not from `vitest` or `jest`
- `@mariozechner/pi-coding-agent` must be mocked in any test that imports `lib/session.ts` — see `__tests__/lib/session.test.ts` for the pattern
- The API routes (`app/api/`) require Next.js infrastructure and are not covered by unit tests; they need integration tests if added

## TypeScript Setup

The root `tsconfig.json` excludes `__tests__/`. Test files are checked via `__tests__/tsconfig.json`, which extends root and adds `bun-types`. The `typecheck` script runs both in sequence.

## ESLint Setup

Config: `eslint.config.mjs` (flat config, ESLint 9)
Extends: `eslint-config-next` (includes TypeScript and React rules)
Scope: `app/`, `lib/`, `types/`, `components/`
Tests are not linted — bun test files use patterns (`mock.module` hoisting) that confuse ESLint.

## Adding New Code

When adding logic to `lib/`:
1. Add a corresponding test file in `__tests__/lib/`
2. Aim for 100% line coverage on pure functions; accept lower on code that requires heavy infrastructure mocking
3. Run all three checks before committing
