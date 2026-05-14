import { useState } from "react";
import { ChevIcon } from "@/components/icons";

const WIDGET_MINIMIZED_KEY = "oracle-keep:widgets-minimized";

export default function WidgetPanel({ widgets }: { widgets: Map<string, string[]> }) {
  const [minimized, setMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WIDGET_MINIMIZED_KEY) === "true";
    } catch {
      return false;
    }
  });

  if (widgets.size === 0) return null;

  const toggle = () => {
    const next = !minimized;
    setMinimized(next);
    try {
      localStorage.setItem(WIDGET_MINIMIZED_KEY, String(next));
    } catch {
      // localStorage unavailable — state still works in-memory
    }
  };

  return (
    <div className="widget-panel">
      <div className="widget-panel-head">
        <span className="widget-panel-label">
          Widgets
          {minimized && (
            <span className="widget-panel-count">{widgets.size}</span>
          )}
        </span>
        <button
          className="icon-btn widget-panel-toggle"
          onClick={toggle}
          aria-label={minimized ? "Expand widgets" : "Minimize widgets"}
          title={minimized ? "Expand widgets" : "Minimize widgets"}
        >
          <ChevIcon
            size={13}
            className={`widget-panel-chev ${minimized ? "" : "is-open"}`}
          />
        </button>
      </div>
      {!minimized && Array.from(widgets.entries()).map(([key, lines]) => (
        <div key={key} className="widget-block">
          {lines.map((line, i) => (
            <div key={i} className="widget-line">{line}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
