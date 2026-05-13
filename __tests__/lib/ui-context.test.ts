import { describe, test, expect } from "bun:test";
import { createWebUIContext } from "../../lib/ui-context";

// ── Helpers ────────────────────────────────────────────────────────────────────

type Event = { type: string; data: Record<string, unknown> };

function makeContext() {
  const events: Event[] = [];
  const enqueue = (type: string, data: Record<string, unknown> = {}) => {
    events.push({ type, data });
  };
  const ctx = createWebUIContext(() => enqueue);
  return { ctx, events };
}

// A minimal Component that satisfies the SDK's Component interface.
function mockComponent(lines: string[]) {
  return {
    render: (_width: number) => lines,
    invalidate: () => {},
  };
}

// ── Fire-and-forget methods ────────────────────────────────────────────────────

describe("createWebUIContext — fire-and-forget", () => {
  test("notify pushes 'notify' event with message and level", () => {
    const { ctx, events } = makeContext();
    ctx.notify("hello world", "warning");
    expect(events).toEqual([{ type: "notify", data: { message: "hello world", level: "warning" } }]);
  });

  test("notify defaults to 'info' level", () => {
    const { ctx, events } = makeContext();
    ctx.notify("info message");
    expect(events[0]).toEqual({ type: "notify", data: { message: "info message", level: "info" } });
  });

  test("setStatus pushes 'status' event with key and text", () => {
    const { ctx, events } = makeContext();
    ctx.setStatus("my-key", "loading…");
    expect(events[0]).toEqual({ type: "status", data: { key: "my-key", text: "loading…" } });
  });

  test("setStatus with undefined sends null for text", () => {
    const { ctx, events } = makeContext();
    ctx.setStatus("my-key", undefined);
    expect(events[0]).toEqual({ type: "status", data: { key: "my-key", text: null } });
  });

  test("setWorkingMessage pushes 'working_message' event", () => {
    const { ctx, events } = makeContext();
    ctx.setWorkingMessage("thinking…");
    expect(events[0]).toEqual({ type: "working_message", data: { message: "thinking…" } });
  });

  test("setWorkingMessage with no arg sends null message", () => {
    const { ctx, events } = makeContext();
    ctx.setWorkingMessage();
    expect(events[0]).toEqual({ type: "working_message", data: { message: null } });
  });

  test("setWorkingVisible pushes 'working_visible' event", () => {
    const { ctx, events } = makeContext();
    ctx.setWorkingVisible(true);
    expect(events[0]).toEqual({ type: "working_visible", data: { visible: true } });
  });
});

// ── setWidget ──────────────────────────────────────────────────────────────────

describe("createWebUIContext — setWidget", () => {
  test("string-array form pushes widget event with lines", () => {
    const { ctx, events } = makeContext();
    ctx.setWidget("my-widget", ["line 1", "line 2"]);
    expect(events[0]).toEqual({ type: "widget", data: { key: "my-widget", lines: ["line 1", "line 2"] } });
  });

  test("undefined clears the widget (pushes null lines)", () => {
    const { ctx, events } = makeContext();
    ctx.setWidget("my-widget", undefined);
    expect(events[0]).toEqual({ type: "widget", data: { key: "my-widget", lines: null } });
  });

  test("undefined calls dispose on an existing factory widget", () => {
    const { ctx } = makeContext();
    let disposed = false;
    ctx.setWidget("w", (_tui, _theme) => ({
      ...mockComponent(["rendered"]),
      dispose: () => { disposed = true; },
    }));
    ctx.setWidget("w", undefined);
    expect(disposed).toBe(true);
  });

  test("component factory is called and rendered immediately at width 80", () => {
    const { ctx, events } = makeContext();
    ctx.setWidget("w", (_tui, _theme) => mockComponent(["width=80"]));
    expect(events[0]).toEqual({ type: "widget", data: { key: "w", lines: ["width=80"] } });
  });

  test("requestRender in factory re-pushes the rendered output", () => {
    const { ctx, events } = makeContext();
    let tui: { requestRender: () => void };
    ctx.setWidget("w", (mockTui, _theme) => {
      tui = mockTui as { requestRender: () => void };
      return mockComponent(["re-rendered"]);
    });
    events.length = 0; // clear the initial render
    tui!.requestRender();
    expect(events[0]).toEqual({ type: "widget", data: { key: "w", lines: ["re-rendered"] } });
  });

  test("replacing a factory widget with undefined disposes the old one", () => {
    const { ctx } = makeContext();
    let firstDisposed = false;
    ctx.setWidget("w", (_tui, _theme) => ({
      ...mockComponent(["first"]),
      dispose: () => { firstDisposed = true; },
    }));
    ctx.setWidget("w", undefined);
    expect(firstDisposed).toBe(true);
  });
});

// ── getEnqueue returning null ──────────────────────────────────────────────────

describe("createWebUIContext — null enqueue", () => {
  test("methods do not throw when getEnqueue returns null", () => {
    const ctx = createWebUIContext(() => null);
    expect(() => ctx.notify("x")).not.toThrow();
    expect(() => ctx.setStatus("k", "v")).not.toThrow();
    expect(() => ctx.setWorkingMessage("m")).not.toThrow();
    expect(() => ctx.setWorkingVisible(true)).not.toThrow();
    expect(() => ctx.setWidget("w", ["line"])).not.toThrow();
    expect(() => ctx.setWidget("w", undefined)).not.toThrow();
    expect(() => ctx.setWidget("w", (_tui, _theme) => mockComponent(["x"]))).not.toThrow();
  });
});

// ── No-op stubs ────────────────────────────────────────────────────────────────

describe("createWebUIContext — no-op stubs", () => {
  test("getEditorText returns empty string", () => {
    const { ctx } = makeContext();
    expect(ctx.getEditorText()).toBe("");
  });

  test("getToolsExpanded returns false", () => {
    const { ctx } = makeContext();
    expect(ctx.getToolsExpanded()).toBe(false);
  });

  test("getAllThemes returns empty array", () => {
    const { ctx } = makeContext();
    expect(ctx.getAllThemes()).toEqual([]);
  });

  test("getTheme returns undefined for any name", () => {
    const { ctx } = makeContext();
    expect(ctx.getTheme("dark")).toBeUndefined();
  });

  test("setTheme returns failure response", () => {
    const { ctx } = makeContext();
    const result = ctx.setTheme("dark");
    expect(result).toMatchObject({ success: false });
    expect(typeof result.error).toBe("string");
  });

  test("onTerminalInput returns an unsubscribe function", () => {
    const { ctx } = makeContext();
    // TerminalInputHandler must return { consume?, data? } | undefined
    const unsub = ctx.onTerminalInput((_data: string) => undefined);
    expect(typeof unsub).toBe("function");
  });

  test("remaining TUI-only no-op stubs do not throw", () => {
    // These stubs exist for TUI compatibility — verify they're callable without error.
    // Cast to any because the stubs accept any input; we're testing existence, not types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyCtx = makeContext().ctx as any;
    expect(() => anyCtx.setWorkingIndicator()).not.toThrow();
    expect(() => anyCtx.setHiddenThinkingLabel()).not.toThrow();
    expect(() => anyCtx.setTitle("title")).not.toThrow();
    expect(() => anyCtx.setFooter(() => mockComponent([]))).not.toThrow();
    expect(() => anyCtx.setHeader(() => mockComponent([]))).not.toThrow();
    expect(() => anyCtx.setEditorText("text")).not.toThrow();
    expect(() => anyCtx.pasteToEditor("text")).not.toThrow();
    expect(() => anyCtx.setToolsExpanded(true)).not.toThrow();
    expect(() => anyCtx.setEditorComponent(undefined)).not.toThrow();
    expect(anyCtx.getEditorComponent()).toBeUndefined();
  });
});

// ── Dialog stubs ──────────────────────────────────────────────────────────────

describe("createWebUIContext — dialog stubs", () => {
  test("select() resolves to undefined", async () => {
    const { ctx } = makeContext();
    expect(await ctx.select("Choose", [])).toBeUndefined();
  });

  test("confirm() resolves to false", async () => {
    const { ctx } = makeContext();
    expect(await ctx.confirm("Confirm", "Are you sure?")).toBe(false);
  });

  test("input() resolves to undefined", async () => {
    const { ctx } = makeContext();
    expect(await ctx.input("Enter value")).toBeUndefined();
  });

  test("editor() resolves to undefined", async () => {
    const { ctx } = makeContext();
    expect(await ctx.editor("Edit")).toBeUndefined();
  });

  test("custom() rejects with an error", async () => {
    const { ctx } = makeContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((ctx as any).custom()).rejects.toThrow();
  });
});

// ── plainTheme pass-through ────────────────────────────────────────────────────

describe("createWebUIContext — theme", () => {
  test("theme.fg returns text unchanged", () => {
    const { ctx } = makeContext();
    expect(ctx.theme.fg("accent", "hello")).toBe("hello");
  });

  test("theme.bold returns text unchanged", () => {
    const { ctx } = makeContext();
    expect(ctx.theme.bold("hello")).toBe("hello");
  });

  test("theme.italic returns text unchanged", () => {
    const { ctx } = makeContext();
    expect(ctx.theme.italic("hello")).toBe("hello");
  });

  test("theme.getColorMode returns 'truecolor'", () => {
    const { ctx } = makeContext();
    expect(ctx.theme.getColorMode()).toBe("truecolor");
  });

  test("theme.getFgAnsi returns empty string", () => {
    const { ctx } = makeContext();
    expect(ctx.theme.getFgAnsi("accent")).toBe("");
  });

  test("theme.getThinkingBorderColor returns pass-through function", () => {
    const { ctx } = makeContext();
    const fn = ctx.theme.getThinkingBorderColor("high");
    expect(fn("border")).toBe("border");
  });

  test("remaining theme methods pass text through", () => {
    const { ctx } = makeContext();
    expect(ctx.theme.bg("selectedBg", "text")).toBe("text");
    expect(ctx.theme.underline("text")).toBe("text");
    expect(ctx.theme.inverse("text")).toBe("text");
    expect(ctx.theme.strikethrough("text")).toBe("text");
    expect(ctx.theme.getBgAnsi("selectedBg")).toBe("");
    const bashFn = ctx.theme.getBashModeBorderColor();
    expect(bashFn("x")).toBe("x");
  });
});
