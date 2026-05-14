import { describe, test, expect, beforeEach } from "bun:test";
import {
  addSession,
  forgetSession,
  updateLabel,
  findSession,
  setSessionFile,
  getRegistry,
  saveRegistry,
  type FsLike,
} from "../../lib/registry";
import type { SessionRegistry } from "../../types/session";

// ── Fake filesystem ────────────────────────────────────────────────────────────

const makeFs = (initialContent?: string): FsLike => {
  let stored: string | undefined = initialContent;
  return {
    readFile: async (_path: string, _encoding: BufferEncoding) => {
      if (stored === undefined) {
        const e: NodeJS.ErrnoException = new Error("ENOENT");
        e.code = "ENOENT";
        throw e;
      }
      return stored;
    },
    writeFile: async (_path: string, content: string, _encoding: BufferEncoding) => {
      stored = content;
    },
    rename: async (_src: string, _dst: string) => {
      /* no-op in tests */
    },
    mkdir: async (_path: string, _opts?: { recursive?: boolean }) => {
      /* no-op */
      return undefined;
    },
  };
};

// ── Test isolation ─────────────────────────────────────────────────────────────

beforeEach(() => {
  globalThis.__oracleKeepRegistry = undefined;
});

// ── addSession ─────────────────────────────────────────────────────────────────

describe("addSession", () => {
  test("creates entry with correct cwd, label defaults to last path segment, id is non-empty", async () => {
    const fs = makeFs();
    const record = await addSession("/home/user/projects/my-app", fs);

    expect(record.cwd).toBe("/home/user/projects/my-app");
    expect(record.label).toBe("my-app");
    expect(record.id).toBeTruthy();
    expect(typeof record.id).toBe("string");
    expect(record.addedAt).toBeTruthy();
  });

  test("trailing slash on cwd derives correct label", async () => {
    const fs = makeFs();
    const record = await addSession("/a/b/c/", fs);
    expect(record.label).toBe("c");
  });

  test("appends to existing sessions", async () => {
    const initial: SessionRegistry = {
      sessions: [
        { id: "existing-id", cwd: "/foo", label: "foo", addedAt: "2024-01-01T00:00:00.000Z" },
      ],
    };
    const fs = makeFs(JSON.stringify(initial));
    await addSession("/bar", fs);

    globalThis.__oracleKeepRegistry = undefined;
    const registry = await getRegistry(fs);
    expect(registry.sessions).toHaveLength(2);
    expect(registry.sessions[0].id).toBe("existing-id");
    expect(registry.sessions[1].cwd).toBe("/bar");
  });
});

// ── forgetSession ──────────────────────────────────────────────────────────────

describe("forgetSession", () => {
  test("removes the correct entry and leaves others untouched", async () => {
    const fs = makeFs();
    const a = await addSession("/a", fs);
    globalThis.__oracleKeepRegistry = undefined;
    const b = await addSession("/b", fs);
    globalThis.__oracleKeepRegistry = undefined;
    const c = await addSession("/c", fs);

    globalThis.__oracleKeepRegistry = undefined;
    await forgetSession(b.id, fs);

    globalThis.__oracleKeepRegistry = undefined;
    const registry = await getRegistry(fs);
    expect(registry.sessions).toHaveLength(2);
    expect(registry.sessions.map((s) => s.id)).toEqual([a.id, c.id]);
  });

  test("no-op when id does not exist", async () => {
    const fs = makeFs();
    await addSession("/a", fs);
    globalThis.__oracleKeepRegistry = undefined;
    await forgetSession("nonexistent", fs);

    globalThis.__oracleKeepRegistry = undefined;
    const registry = await getRegistry(fs);
    expect(registry.sessions).toHaveLength(1);
  });
});

// ── updateLabel ────────────────────────────────────────────────────────────────

describe("updateLabel", () => {
  test("updates the label for an existing session", async () => {
    const fs = makeFs();
    const record = await addSession("/home/user/projects/foo", fs);
    globalThis.__oracleKeepRegistry = undefined;

    const updated = await updateLabel(record.id, "My Custom Label", fs);
    expect(updated).toBeDefined();
    expect(updated!.label).toBe("My Custom Label");
    expect(updated!.id).toBe(record.id);
  });

  test("blank label resets to last segment of cwd", async () => {
    const fs = makeFs();
    const record = await addSession("/home/user/projects/bar", fs);
    globalThis.__oracleKeepRegistry = undefined;

    // Set a custom label first
    await updateLabel(record.id, "custom", fs);
    globalThis.__oracleKeepRegistry = undefined;

    // Reset with blank
    const reset = await updateLabel(record.id, "", fs);
    expect(reset).toBeDefined();
    expect(reset!.label).toBe("bar");
  });

  test("blank label with only whitespace resets to last segment of cwd", async () => {
    const fs = makeFs();
    const record = await addSession("/a/b/c", fs);
    globalThis.__oracleKeepRegistry = undefined;

    const reset = await updateLabel(record.id, "   ", fs);
    expect(reset!.label).toBe("c");
  });

  test("returns undefined for unknown id", async () => {
    const fs = makeFs();
    const result = await updateLabel("nonexistent-id", "label", fs);
    expect(result).toBeUndefined();
  });

  test("persists updated label through a registry reload", async () => {
    const fs = makeFs();
    const record = await addSession("/x/y/z", fs);
    globalThis.__oracleKeepRegistry = undefined;

    await updateLabel(record.id, "renamed", fs);
    globalThis.__oracleKeepRegistry = undefined;

    const found = await findSession(record.id, fs);
    expect(found!.label).toBe("renamed");
  });
});

// ── findSession ────────────────────────────────────────────────────────────────

describe("findSession", () => {
  test("returns the record when found", async () => {
    const fs = makeFs();
    const record = await addSession("/some/path", fs);
    globalThis.__oracleKeepRegistry = undefined;

    const found = await findSession(record.id, fs);
    expect(found).toBeDefined();
    expect(found!.id).toBe(record.id);
    expect(found!.cwd).toBe("/some/path");
  });

  test("returns undefined when not found", async () => {
    const fs = makeFs();
    const result = await findSession("no-such-id", fs);
    expect(result).toBeUndefined();
  });
});

// ── getRegistry / saveRegistry round-trip ─────────────────────────────────────

describe("getRegistry / saveRegistry round-trip", () => {
  test("returns empty sessions when file does not exist", async () => {
    const fs = makeFs(); // no initial content → ENOENT
    const registry = await getRegistry(fs);
    expect(registry).toEqual({ sessions: [] });
  });

  test("write then read back returns same data", async () => {
    const fs = makeFs();
    const original: SessionRegistry = {
      sessions: [
        { id: "abc", cwd: "/project", label: "project", addedAt: "2024-06-01T00:00:00.000Z" },
      ],
    };

    await saveRegistry(original, fs);

    // Clear singleton to force re-read from fake fs
    globalThis.__oracleKeepRegistry = undefined;
    const restored = await getRegistry(fs);
    expect(restored).toEqual(original);
  });

  test("getRegistry returns cached singleton on second call without re-reading", async () => {
    let readCount = 0;
    const trackingFs: FsLike = {
      ...makeFs(),
      readFile: async (_p: string, _enc: BufferEncoding) => {
        readCount++;
        const e: NodeJS.ErrnoException = new Error("ENOENT");
        e.code = "ENOENT";
        throw e;
      },
    };

    await getRegistry(trackingFs);
    await getRegistry(trackingFs);
    expect(readCount).toBe(1);
  });

  test("saveRegistry updates singleton so subsequent getRegistry reflects new state", async () => {
    const fs = makeFs();
    const updated: SessionRegistry = {
      sessions: [{ id: "new", cwd: "/new", label: "new", addedAt: "2024-01-01T00:00:00.000Z" }],
    };

    await saveRegistry(updated, fs);

    // Do NOT clear singleton — getRegistry should return the updated state from memory
    const registry = await getRegistry(fs);
    expect(registry.sessions).toHaveLength(1);
    expect(registry.sessions[0].id).toBe("new");
  });
});

describe("setSessionFile", () => {
  beforeEach(() => { globalThis.__oracleKeepRegistry = undefined; });

  test("writes sessionFile onto the matching registry entry", async () => {
    const fs = makeFs();
    const record = await addSession("/some/path", fs);

    await setSessionFile(record.id, "/home/.pi/agent/sessions/path/session.jsonl", fs);

    const updated = await findSession(record.id, fs);
    expect(updated?.sessionFile).toBe("/home/.pi/agent/sessions/path/session.jsonl");
  });

  test("no-op when id does not exist", async () => {
    const fs = makeFs();
    await addSession("/some/path", fs);

    // Should not throw and registry should be unchanged
    await expect(setSessionFile("nonexistent", "/some/file.jsonl", fs)).resolves.toBeUndefined();
    const registry = await getRegistry(fs);
    expect(registry.sessions.every((s) => s.sessionFile === undefined)).toBe(true);
  });

  test("persists through a registry reload", async () => {
    const fs = makeFs();
    const record = await addSession("/some/path", fs);
    await setSessionFile(record.id, "/pinned/session.jsonl", fs);

    // Clear singleton to force a reload from the fake fs
    globalThis.__oracleKeepRegistry = undefined;
    const reloaded = await findSession(record.id, fs);
    expect(reloaded?.sessionFile).toBe("/pinned/session.jsonl");
  });
});
