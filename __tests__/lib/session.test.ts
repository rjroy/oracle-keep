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
  setEnqueue,
  clearEnqueue,
  getSession,
} from "../../lib/session";

// ── Reset globalThis.__oracleKeep before each test ────────────────────────────
// This gives each test an isolated, predictable starting state.

type OracleKeep = {
  sessionPromise: Promise<unknown>;
  isProcessing: boolean;
  enqueue: ((type: string, data?: Record<string, unknown>) => void) | null;
};

function installFakeKeep(overrides: Partial<OracleKeep> = {}): OracleKeep {
  const fakeKeep: OracleKeep = {
    sessionPromise: Promise.resolve({}),
    isProcessing: false,
    enqueue: null,
    ...overrides,
  };
  (globalThis as { __oracleKeep?: OracleKeep }).__oracleKeep = fakeKeep;
  return fakeKeep;
}

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

// ── setEnqueue / clearEnqueue ─────────────────────────────────────────────────

describe("setEnqueue / clearEnqueue", () => {
  test("setEnqueue stores the function on the singleton", () => {
    const fn = () => {};
    setEnqueue(fn);
    const keep = (globalThis as { __oracleKeep: OracleKeep }).__oracleKeep;
    expect(keep.enqueue).toBe(fn);
  });

  test("clearEnqueue sets enqueue to null", () => {
    const fn = () => {};
    setEnqueue(fn);
    clearEnqueue();
    const keep = (globalThis as { __oracleKeep: OracleKeep }).__oracleKeep;
    expect(keep.enqueue).toBeNull();
  });

  test("clearEnqueue is safe when enqueue is already null", () => {
    expect(() => clearEnqueue()).not.toThrow();
    const keep = (globalThis as { __oracleKeep: OracleKeep }).__oracleKeep;
    expect(keep.enqueue).toBeNull();
  });

  test("replacing enqueue with a new function updates the reference", () => {
    const fn1 = () => {};
    const fn2 = () => {};
    setEnqueue(fn1);
    setEnqueue(fn2);
    const keep = (globalThis as { __oracleKeep: OracleKeep }).__oracleKeep;
    expect(keep.enqueue).toBe(fn2);
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
