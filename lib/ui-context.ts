/**
 * Web implementation of ExtensionUIContext.
 *
 * Fire-and-forget methods (notify, setStatus, setWidget, etc.) push SSE events
 * to whatever stream is currently active via a caller-supplied getEnqueue().
 *
 * Component-factory setWidget: calls the factory with a mock tui/theme, captures
 * the render() function, and re-pushes on requestRender() calls.
 *
 * Phase 3 dialog methods (select, confirm, input) are stubbed — returns defaults.
 * TUI-only methods (setEditorComponent, custom, setFooter, etc.) are no-ops.
 */

import type { ExtensionUIContext } from "@mariozechner/pi-coding-agent";

// Pushed over SSE by the web UI context.
export type UIEnqueue = (type: string, data?: Record<string, unknown>) => void;

// Minimal plain-text theme mock. The todo overlay calls theme.fg(color, text)
// for tree decorators and headings — we return the text unchanged so the
// rendered lines are readable plain text without ANSI codes.
const plainTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  italic: (text: string) => text,
  underline: (text: string) => text,
  inverse: (text: string) => text,
  strikethrough: (text: string) => text,
  getFgAnsi: () => "",
  getBgAnsi: () => "",
  getColorMode: () => "truecolor" as const,
  getThinkingBorderColor: () => (s: string) => s,
  getBashModeBorderColor: () => (s: string) => s,
};

// Width used when calling render() on component-factory widgets.
const WIDGET_RENDER_WIDTH = 80;

type WidgetEntry = {
  render: (width: number) => string[];
  dispose?: () => void;
};

/**
 * Create a web-aware ExtensionUIContext.
 *
 * @param getEnqueue  Returns the active SSE enqueue fn, or null when no stream
 *                    is open. Calls made with null are silently dropped.
 */
export type WebUIContext = ExtensionUIContext & {
  getWidgetSnapshot(): Record<string, string[]>;
};

export function createWebUIContext(getEnqueue: () => UIEnqueue | null): WebUIContext {
  // Active component-factory widgets, keyed by widget key.
  const widgets = new Map<string, WidgetEntry>();

  function pushWidget(key: string, lines: string[] | null) {
    getEnqueue()?.("widget", { key, lines });
  }

  const ctx: any = {
    // ── Fire-and-forget ────────────────────────────────────────────────────────

    notify(message: string, type: "info" | "warning" | "error" = "info") {
      getEnqueue()?.("notify", { message, level: type });
    },

    setStatus(key: string, text: string | undefined) {
      getEnqueue()?.("status", { key, text: text ?? null });
    },

    setWorkingMessage(message?: string) {
      getEnqueue()?.("working_message", { message: message ?? null });
    },

    setWorkingVisible(visible: boolean) {
      getEnqueue()?.("working_visible", { visible });
    },

    setWidget(key: string, content: any, _options?: unknown) {
      if (content == null) {
        // Clear — dispose any active component factory widget.
        const entry = widgets.get(key);
        entry?.dispose?.();
        widgets.delete(key);
        pushWidget(key, null);
      } else if (Array.isArray(content)) {
        // String-array form — push directly.
        widgets.set(key, { render: () => content as string[] });
        pushWidget(key, content as string[]);
      } else if (typeof content === "function") {
        // Component-factory form — call with mock tui/theme, render immediately,
        // re-render on requestRender() calls.
        let entry: WidgetEntry | null = null;

        const mockTui = {
          requestRender() {
            if (entry) pushWidget(key, entry.render(WIDGET_RENDER_WIDTH));
          },
        };

        const component = (content as (tui: unknown, theme: unknown) => { render: (w: number) => string[]; dispose?: () => void })(
          mockTui,
          plainTheme,
        );

        entry = {
          render: (width: number) => component.render(width),
          dispose: component.dispose,
        };

        widgets.set(key, entry);
        pushWidget(key, entry.render(WIDGET_RENDER_WIDTH));
      }
    },

    // ── TUI-only / no-op stubs ─────────────────────────────────────────────────

    setWorkingIndicator: () => {},
    setHiddenThinkingLabel: () => {},
    setTitle: () => {},
    setFooter: () => {},
    setHeader: () => {},
    setEditorText: () => {},
    getEditorText: () => "",
    pasteToEditor: () => {},
    addAutocompleteProvider: () => {},
    setToolsExpanded: () => {},
    getToolsExpanded: () => false,
    setEditorComponent: () => {},
    getEditorComponent: () => undefined,
    onTerminalInput: () => () => {},
    getAllThemes: () => [],
    getTheme: () => undefined,
    setTheme: () => ({ success: false, error: "themes not supported in web mode" }),
    theme: plainTheme,

    // ── Snapshot ───────────────────────────────────────────────────────────────

    getWidgetSnapshot(): Record<string, string[]> {
      const out: Record<string, string[]> = {};
      for (const [key, entry] of widgets.entries()) {
        out[key] = entry.render(WIDGET_RENDER_WIDTH);
      }
      return out;
    },

    // ── Phase 3: dialogs (not yet implemented) ─────────────────────────────────

    select: async () => undefined,
    confirm: async () => false,
    input: async () => undefined,
    editor: async () => undefined,
    custom: async () => { throw new Error("custom() not supported in web mode"); },
  };

  return ctx as WebUIContext;
}
