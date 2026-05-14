import { ChevIcon } from "@/components/icons";
import type { Message, ToolEntry } from "./types";

function ToolCard({
  tool,
  onToggle,
}: {
  tool: ToolEntry;
  onToggle: () => void;
}) {
  const isActive = tool.status === "running";
  const isOpen = tool.expanded;
  const statusClass =
    tool.status === "running"
      ? "pending"
      : tool.status === "ok"
        ? "done"
        : "error";
  const statusLabel =
    tool.status === "running"
      ? "in progress"
      : tool.status === "ok"
        ? "returned"
        : "failed";

  return (
    <div
      className={`tool-card ${isOpen ? "is-open" : ""} ${isActive ? "is-active" : ""}`}
    >
      <div
        className="tool-card-head"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <div className="tool-icon-wrap">⚙</div>
        <div className="tool-card-body-wrap">
          <div className="tool-card-name">{tool.label}</div>
          <div className="tool-card-sub">
            {isActive
              ? "working…"
              : tool.output
                ? tool.output.slice(0, 80)
                : "no output"}
          </div>
        </div>
        <span className={`tool-card-status ${statusClass}`}>{statusLabel}</span>
        <ChevIcon size={14} className="tool-card-chev" />
      </div>

      {isOpen && (
        <div className="tool-card-body">
          {isActive ? (
            <div className="shimmer" />
          ) : tool.output ? (
            <>
              <div className="tool-section-title">Output</div>
              <div className="tool-output">{tool.output}</div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function ToolGroup({
  message,
  onToggle,
}: {
  message: Message & { kind: "tool_group" };
  onToggle: (toolId: string) => void;
}) {
  return (
    <div className="tool-group">
      {message.tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} onToggle={() => onToggle(tool.id)} />
      ))}
    </div>
  );
}
