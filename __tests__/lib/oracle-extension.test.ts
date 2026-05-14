import { describe, test, expect } from "bun:test";
import { createOracleExtension } from "../../lib/oracle-extension";
import type { MetaCallback } from "../../lib/oracle-extension";

// ── Minimal ExtensionAPI stub ─────────────────────────────────────────────────

type EventHandler = (...args: unknown[]) => void | Promise<void>;

function makeExtensionAPI(commands: { name: string; description?: string; source: "extension" | "prompt" | "skill" }[]) {
  const handlers: Record<string, EventHandler[]> = {};
  const onCalls: Array<[string, EventHandler]> = [];
  const api = {
    on(event: string, handler: EventHandler) {
      onCalls.push([event, handler]);
      handlers[event] ??= [];
      handlers[event].push(handler);
    },
    getCommands: () => commands,
    /** Test helper: fire a registered event. */
    async emit(event: string, ...args: unknown[]) {
      for (const h of handlers[event] ?? []) await h(...args);
    },
    /** Test helper: inspect which events were registered. */
    registeredEvents(): string[] {
      return onCalls.map(([e]) => e);
    },
  };
  return api;
}

// ── createOracleExtension ─────────────────────────────────────────────────────

describe("createOracleExtension", () => {
  test("registers a session_start handler", () => {
    const pi = makeExtensionAPI([]);
    const factory = createOracleExtension(() => {});
    factory(pi as never);
    expect(pi.registeredEvents()).toContain("session_start");
  });

  test("calls onMeta with commands on session_start", async () => {
    const received: Parameters<MetaCallback>[] = [];
    const pi = makeExtensionAPI([
      { name: "unipi:lossless-compact", description: "Immediate compaction", source: "extension" },
      { name: "my-cmd", source: "extension" },
    ]);

    const factory = createOracleExtension((update) => received.push([update]));
    factory(pi as never);
    await pi.emit("session_start");

    expect(received).toHaveLength(1);
    const [update] = received[0];
    expect(update.commands).toHaveLength(2);
    expect(update.commands![0]).toEqual({
      name: "unipi:lossless-compact",
      description: "Immediate compaction",
      source: "extension",
    });
  });

  test("maps missing description to empty string", async () => {
    const received: Parameters<MetaCallback>[] = [];
    const pi = makeExtensionAPI([
      { name: "no-desc", source: "extension" },
    ]);

    const factory = createOracleExtension((update) => received.push([update]));
    factory(pi as never);
    await pi.emit("session_start");

    expect(received[0][0].commands![0].description).toBe("");
  });

  test("passes source field through unchanged", async () => {
    const received: Parameters<MetaCallback>[] = [];
    const pi = makeExtensionAPI([
      { name: "a", source: "prompt" },
      { name: "b", source: "skill" },
      { name: "c", source: "extension" },
    ]);

    const factory = createOracleExtension((update) => received.push([update]));
    factory(pi as never);
    await pi.emit("session_start");

    const cmds = received[0][0].commands!;
    expect(cmds.map((c) => c.source)).toEqual(["prompt", "skill", "extension"]);
  });

  test("calls onMeta with empty commands when no commands are registered", async () => {
    const received: Parameters<MetaCallback>[] = [];
    const pi = makeExtensionAPI([]);

    const factory = createOracleExtension((update) => received.push([update]));
    factory(pi as never);
    await pi.emit("session_start");

    expect(received[0][0].commands).toEqual([]);
  });

  test("onMeta is not called before session_start fires", () => {
    const received: Parameters<MetaCallback>[] = [];
    const pi = makeExtensionAPI([{ name: "cmd", source: "extension" }]);

    const factory = createOracleExtension((update) => received.push([update]));
    factory(pi as never);
    // session_start not emitted yet
    expect(received).toHaveLength(0);
  });

  test("separate factory instances use separate callbacks", async () => {
    const receivedA: Parameters<MetaCallback>[] = [];
    const receivedB: Parameters<MetaCallback>[] = [];

    const piA = makeExtensionAPI([{ name: "a", source: "extension" }]);
    const piB = makeExtensionAPI([{ name: "b", source: "extension" }]);

    createOracleExtension((u) => receivedA.push([u]))(piA as never);
    createOracleExtension((u) => receivedB.push([u]))(piB as never);

    await piA.emit("session_start");
    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);

    await piB.emit("session_start");
    expect(receivedB).toHaveLength(1);
    expect(receivedA).toHaveLength(1); // unchanged
  });
});
