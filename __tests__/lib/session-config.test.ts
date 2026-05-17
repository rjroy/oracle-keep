import { describe, test, expect, beforeEach } from "bun:test";
import {
  getConfig,
  saveConfig,
  setModel,
} from "../../lib/session-config";
import type { FsLike } from "../../lib/registry";
import type { SessionConfig } from "../../types/session";

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
  globalThis.__oracleKeepConfig = undefined;
});

// ── getConfig ──────────────────────────────────────────────────────────────────

describe("getConfig", () => {
  test("returns default config when file does not exist", async () => {
    const fs = makeFs();
    const config = await getConfig(fs);
    expect(config).toEqual({ model: "" });
  });

  test("returns persisted config when file exists", async () => {
    const stored: SessionConfig = { model: "anthropic/claude-opus-4-5" };
    const fs = makeFs(JSON.stringify(stored));
    const config = await getConfig(fs);
    expect(config.model).toBe("anthropic/claude-opus-4-5");
  });

  test("merges missing keys with defaults when file is partial", async () => {
    const fs = makeFs("{}");
    const config = await getConfig(fs);
    expect(config.model).toBe("");
  });

  test("returns cached singleton on second call without re-reading", async () => {
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

    await getConfig(trackingFs);
    await getConfig(trackingFs);
    expect(readCount).toBe(1);
  });
});

// ── saveConfig ─────────────────────────────────────────────────────────────────

describe("saveConfig", () => {
  test("write then read back returns same data", async () => {
    const fs = makeFs();
    const original: SessionConfig = { model: "anthropic/claude-sonnet-4-5" };

    await saveConfig(original, fs);

    globalThis.__oracleKeepConfig = undefined;
    const restored = await getConfig(fs);
    expect(restored).toEqual(original);
  });

  test("updates singleton so subsequent getConfig reflects new state without re-reading", async () => {
    const fs = makeFs();
    const updated: SessionConfig = { model: "anthropic/claude-opus-4-5" };

    await saveConfig(updated, fs);

    // Do NOT clear singleton — getConfig should return updated state from memory.
    const config = await getConfig(fs);
    expect(config.model).toBe("anthropic/claude-opus-4-5");
  });
});

// ── setModel ───────────────────────────────────────────────────────────────────

describe("setModel", () => {
  test("persists the new model value", async () => {
    const fs = makeFs();
    await setModel("anthropic/claude-haiku-4-5", fs);

    globalThis.__oracleKeepConfig = undefined;
    const config = await getConfig(fs);
    expect(config.model).toBe("anthropic/claude-haiku-4-5");
  });

  test("can clear the model back to empty string", async () => {
    const fs = makeFs(JSON.stringify({ model: "anthropic/claude-opus-4-5" }));
    await setModel("", fs);

    globalThis.__oracleKeepConfig = undefined;
    const config = await getConfig(fs);
    expect(config.model).toBe("");
  });

  test("does not overwrite other config fields", async () => {
    // Future-proofing: if SessionConfig gains new fields, setModel should preserve them.
    const fs = makeFs(JSON.stringify({ model: "anthropic/claude-opus-4-5" }));
    await setModel("anthropic/claude-haiku-4-5", fs);

    globalThis.__oracleKeepConfig = undefined;
    const config = await getConfig(fs);
    expect(config.model).toBe("anthropic/claude-haiku-4-5");
  });
});
