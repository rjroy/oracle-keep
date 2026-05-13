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
  getSession,
  isProcessingSession,
  setProcessingSession,
  broadcastEventToSession,
  addSubscriberToSession,
  removeSubscriberFromSession,
  getEventBufferForSession,
  clearEventBufferForSession,
  getWidgetSnapshotForSession,
} from "../../lib/session";
import type { BufferedEvent } from "../../lib/session";

// ── Reset global sessions map before each test to prevent state bleed ─────────

beforeEach(() => {
  globalThis.__oracleKeepSessions = undefined;
});

// ── getSession ────────────────────────────────────────────────────────────────

describe("getSession", () => {
  test("two calls with the same id return the same promise", async () => {
    const p1 = getSession("sess-1", "/path/a");
    const p2 = getSession("sess-1", "/path/a");
    expect(p1).toBe(p2);
  });

  test("calls with different ids return different promises", async () => {
    const p1 = getSession("sess-a", "/path/a");
    const p2 = getSession("sess-b", "/path/b");
    expect(p1).not.toBe(p2);
  });

  test("resolves to the mocked agent session", async () => {
    const session = await getSession("sess-init", "/some/path");
    expect(session).toBeDefined();
  });
});

// ── isProcessingSession / setProcessingSession ────────────────────────────────

describe("isProcessingSession / setProcessingSession", () => {
  test("returns false for a session id not yet in the map", () => {
    expect(isProcessingSession("never-created")).toBe(false);
  });

  test("returns false initially after session is created", async () => {
    await getSession("sess-2", "/path");
    expect(isProcessingSession("sess-2")).toBe(false);
  });

  test("setProcessingSession(id, true) makes isProcessingSession return true", async () => {
    await getSession("sess-3", "/path");
    setProcessingSession("sess-3", true);
    expect(isProcessingSession("sess-3")).toBe(true);
  });

  test("setProcessingSession(id, false) makes isProcessingSession return false", async () => {
    await getSession("sess-4", "/path");
    setProcessingSession("sess-4", true);
    setProcessingSession("sess-4", false);
    expect(isProcessingSession("sess-4")).toBe(false);
  });

  test("setProcessingSession on id-a does not affect id-b", async () => {
    await getSession("sess-iso-a", "/path/a");
    await getSession("sess-iso-b", "/path/b");
    setProcessingSession("sess-iso-a", true);
    expect(isProcessingSession("sess-iso-b")).toBe(false);
  });

  test("setProcessingSession on unknown id does not throw", () => {
    expect(() => setProcessingSession("ghost", true)).not.toThrow();
  });
});

// ── eventBuffer ───────────────────────────────────────────────────────────────

describe("getEventBufferForSession / clearEventBufferForSession", () => {
  test("returns empty array for session not in map", () => {
    expect(getEventBufferForSession("no-such")).toEqual([]);
  });

  test("returns empty array initially after session is created", async () => {
    await getSession("buf-sess", "/path");
    expect(getEventBufferForSession("buf-sess")).toEqual([]);
  });

  test("broadcastEventToSession appends to the buffer", async () => {
    await getSession("buf-2", "/path");
    broadcastEventToSession("buf-2", "text", { delta: "hello" });
    expect(getEventBufferForSession("buf-2")).toEqual([
      { type: "text", data: { delta: "hello" } },
    ]);
  });

  test("broadcastEventToSession defaults data to empty object", async () => {
    await getSession("buf-3", "/path");
    broadcastEventToSession("buf-3", "done");
    const buf = getEventBufferForSession("buf-3");
    expect(buf).toEqual([{ type: "done", data: {} }]);
  });

  test("getEventBufferForSession returns a snapshot, not a live reference", async () => {
    await getSession("buf-4", "/path");
    const snapshot = getEventBufferForSession("buf-4");
    broadcastEventToSession("buf-4", "text", { delta: "x" });
    expect(snapshot).toHaveLength(0);
    expect(getEventBufferForSession("buf-4")).toHaveLength(1);
  });

  test("clearEventBufferForSession empties the buffer", async () => {
    await getSession("buf-5", "/path");
    broadcastEventToSession("buf-5", "text", { delta: "a" });
    broadcastEventToSession("buf-5", "done");
    clearEventBufferForSession("buf-5");
    expect(getEventBufferForSession("buf-5")).toEqual([]);
  });

  test("clearEventBufferForSession is safe when session not in map", () => {
    expect(() => clearEventBufferForSession("ghost")).not.toThrow();
  });
});

// ── subscribers ───────────────────────────────────────────────────────────────

describe("addSubscriberToSession / removeSubscriberFromSession / broadcastEventToSession", () => {
  test("broadcastEventToSession fans out to all registered subscribers", async () => {
    await getSession("sub-1", "/path");
    const received1: Array<[string, Record<string, unknown>]> = [];
    const received2: Array<[string, Record<string, unknown>]> = [];

    addSubscriberToSession("sub-1", "a", (type, data = {}) =>
      received1.push([type, data])
    );
    addSubscriberToSession("sub-1", "b", (type, data = {}) =>
      received2.push([type, data])
    );

    broadcastEventToSession("sub-1", "text", { delta: "hi" });

    expect(received1).toEqual([["text", { delta: "hi" }]]);
    expect(received2).toEqual([["text", { delta: "hi" }]]);
  });

  test("removeSubscriberFromSession stops the subscriber from receiving events", async () => {
    await getSession("sub-2", "/path");
    const received: string[] = [];
    addSubscriberToSession("sub-2", "s", (type) => received.push(type));
    broadcastEventToSession("sub-2", "text");
    removeSubscriberFromSession("sub-2", "s");
    broadcastEventToSession("sub-2", "done");
    expect(received).toEqual(["text"]);
  });

  test("removeSubscriberFromSession is safe when subscriberId was never registered", async () => {
    await getSession("sub-3", "/path");
    expect(() => removeSubscriberFromSession("sub-3", "nonexistent")).not.toThrow();
  });

  test("removeSubscriberFromSession is safe when session id not in map", () => {
    expect(() => removeSubscriberFromSession("ghost", "sub")).not.toThrow();
  });

  test("replacing a subscriberId updates the reference", async () => {
    await getSession("sub-4", "/path");
    const received: string[] = [];
    addSubscriberToSession("sub-4", "x", () => received.push("first"));
    addSubscriberToSession("sub-4", "x", () => received.push("second"));
    broadcastEventToSession("sub-4", "ping");
    expect(received).toEqual(["second"]);
  });

  test("broadcastEventToSession on unknown session id does not throw", () => {
    expect(() => broadcastEventToSession("ghost", "done")).not.toThrow();
  });

  test("addSubscriberToSession on unknown session id does not throw", () => {
    expect(() =>
      addSubscriberToSession("ghost", "s", () => {})
    ).not.toThrow();
  });
});

// ── session isolation ─────────────────────────────────────────────────────────

describe("session isolation", () => {
  test("events from session A do not reach session B subscribers", async () => {
    await getSession("iso-a", "/path/a");
    await getSession("iso-b", "/path/b");

    const receivedB: string[] = [];
    addSubscriberToSession("iso-b", "listener", (type) => receivedB.push(type));

    broadcastEventToSession("iso-a", "text", { delta: "secret" });

    expect(receivedB).toHaveLength(0);
  });

  test("event buffers are independent across sessions", async () => {
    await getSession("buf-iso-a", "/path/a");
    await getSession("buf-iso-b", "/path/b");

    broadcastEventToSession("buf-iso-a", "text", { delta: "a" });

    expect(getEventBufferForSession("buf-iso-a")).toHaveLength(1);
    expect(getEventBufferForSession("buf-iso-b")).toHaveLength(0);
  });
});

// ── getWidgetSnapshotForSession ───────────────────────────────────────────────

describe("getWidgetSnapshotForSession", () => {
  test("returns empty object for session not in map", () => {
    expect(getWidgetSnapshotForSession("no-such")).toEqual({});
  });

  test("returns object (possibly empty) for a created session", async () => {
    await getSession("widget-sess", "/path");
    const snapshot = getWidgetSnapshotForSession("widget-sess");
    expect(typeof snapshot).toBe("object");
  });
});

// ── BufferedEvent type ────────────────────────────────────────────────────────

describe("BufferedEvent type", () => {
  test("event objects match the BufferedEvent shape", async () => {
    await getSession("type-sess", "/path");
    broadcastEventToSession("type-sess", "text", { delta: "x" });
    const [evt] = getEventBufferForSession("type-sess") as BufferedEvent[];
    expect(evt.type).toBe("text");
    expect(evt.data).toEqual({ delta: "x" });
  });
});
