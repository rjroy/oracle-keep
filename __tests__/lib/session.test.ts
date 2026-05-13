import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock the SDK before any imports that pull in session.ts.
// Bun hoists mock.module() calls so the mock is in place when session.ts loads.
mock.module("@mariozechner/pi-coding-agent", () => ({
  createAgentSession: async () => ({
    session: {
      bindExtensions: async () => {},
      sessionFile: "test.session",
    },
    modelFallbackMessage: null,
  }),
  SessionManager: { continueRecent: () => ({}) },
}));

import {
  isProcessing,
  setProcessing,
  broadcastEvent,
  addSubscriber,
  removeSubscriber,
  getEventBuffer,
  clearEventBuffer,
  getSession,
} from "../../lib/session";
import type { BufferedEvent } from "../../lib/session";

// ── Helpers ────────────────────────────────────────────────────────────────────

type OracleKeep = {
  sessionPromise: Promise<unknown>;
  isProcessing: boolean;
  eventBuffer: BufferedEvent[];
  subscribers: Map<string, (type: string, data?: Record<string, unknown>) => void>;
};

function installFakeKeep(overrides: Partial<OracleKeep> = {}): OracleKeep {
  const fakeKeep: OracleKeep = {
    sessionPromise: Promise.resolve({}),
    isProcessing: false,
    eventBuffer: [],
    subscribers: new Map(),
    ...overrides,
  };
  (globalThis as { __oracleKeep?: OracleKeep }).__oracleKeep = fakeKeep;
  return fakeKeep;
}

// ── Reset globalThis.__oracleKeep before each test ────────────────────────────
beforeEach(() => {
  installFakeKeep();
});

// ── isProcessing / setProcessing ──────────────────────────────────────────────

describe("isProcessing / setProcessing", () => {
  test("isProcessing returns false initially", () => {
    expect(isProcessing()).toBe(false);
  });

  test("setProcessing(true) makes isProcessing return true", () => {
    setProcessing(true);
    expect(isProcessing()).toBe(true);
  });

  test("setProcessing(false) makes isProcessing return false", () => {
    installFakeKeep({ isProcessing: true });
    setProcessing(false);
    expect(isProcessing()).toBe(false);
  });

  test("multiple toggles reflect the last value set", () => {
    setProcessing(true);
    setProcessing(false);
    setProcessing(true);
    expect(isProcessing()).toBe(true);
  });
});

// ── eventBuffer ───────────────────────────────────────────────────────────────

describe("eventBuffer", () => {
  test("getEventBuffer returns empty array initially", () => {
    expect(getEventBuffer()).toEqual([]);
  });

  test("broadcastEvent appends to the buffer", () => {
    broadcastEvent("text", { delta: "hello" });
    expect(getEventBuffer()).toEqual([{ type: "text", data: { delta: "hello" } }]);
  });

  test("broadcastEvent defaults data to empty object", () => {
    broadcastEvent("done");
    expect(getEventBuffer()).toEqual([{ type: "done", data: {} }]);
  });

  test("getEventBuffer returns a snapshot, not a live reference", () => {
    const snapshot = getEventBuffer();
    broadcastEvent("text", { delta: "x" });
    expect(snapshot).toHaveLength(0);
    expect(getEventBuffer()).toHaveLength(1);
  });

  test("clearEventBuffer empties the buffer", () => {
    broadcastEvent("text", { delta: "a" });
    broadcastEvent("done");
    clearEventBuffer();
    expect(getEventBuffer()).toEqual([]);
  });

  test("clearEventBuffer is safe when buffer is already empty", () => {
    expect(() => clearEventBuffer()).not.toThrow();
    expect(getEventBuffer()).toEqual([]);
  });
});

// ── subscribers ───────────────────────────────────────────────────────────────

describe("addSubscriber / removeSubscriber / broadcastEvent dispatch", () => {
  test("broadcastEvent calls all registered subscribers", () => {
    const received1: Array<[string, Record<string, unknown>]> = [];
    const received2: Array<[string, Record<string, unknown>]> = [];

    addSubscriber("a", (type, data = {}) => received1.push([type, data]));
    addSubscriber("b", (type, data = {}) => received2.push([type, data]));

    broadcastEvent("text", { delta: "hi" });

    expect(received1).toEqual([["text", { delta: "hi" }]]);
    expect(received2).toEqual([["text", { delta: "hi" }]]);
  });

  test("removeSubscriber stops the subscriber from receiving events", () => {
    const received: string[] = [];
    addSubscriber("s", (type) => received.push(type));
    broadcastEvent("text");
    removeSubscriber("s");
    broadcastEvent("done");

    expect(received).toEqual(["text"]);
  });

  test("removeSubscriber is safe when id was never registered", () => {
    expect(() => removeSubscriber("nonexistent")).not.toThrow();
  });

  test("replacing a subscriber id updates the reference", () => {
    const received: string[] = [];
    addSubscriber("x", () => received.push("first"));
    addSubscriber("x", () => received.push("second"));
    broadcastEvent("ping");
    expect(received).toEqual(["second"]);
  });

  test("broadcastEvent with no subscribers is safe", () => {
    expect(() => broadcastEvent("done")).not.toThrow();
  });
});

// ── getSession ────────────────────────────────────────────────────────────────

describe("getSession", () => {
  test("resolves to the agent session", async () => {
    // Clear the fake keep so singleton() runs its full init path via the mock.
    (globalThis as { __oracleKeep?: OracleKeep }).__oracleKeep = undefined;
    const session = await getSession();
    expect(session).toBeDefined();
  });
});
