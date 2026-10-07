# Oracle Keep — Agent Guidelines

This file documents the verification steps every agent must run before declaring work complete.

## Branching

All work must happen on a branch. `master` is locked on the server and only accepts PRs — direct pushes are rejected.

```bash
git checkout -b your-branch-name
```

Create a PR when the work is complete.

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
- `@earendil-works/pi-coding-agent` must be mocked in any test that imports `lib/session.ts` — see `__tests__/lib/session.test.ts` for the pattern
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

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
