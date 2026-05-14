import { ChevIcon } from "@/components/icons";
import type { Message } from "./types";

export default function ThinkingCard({
  message,
  onToggle,
}: {
  message: Message & { kind: "thinking" };
  onToggle: () => void;
}) {
  const isOpen = message.expanded;
  const wordCount = message.text.trim().split(/\s+/).filter(Boolean).length;
  const summary = message.streaming
    ? "reasoning…"
    : wordCount > 0
      ? `${wordCount} words`
      : "no content";

  return (
    <div className={`thinking-card ${isOpen ? "is-open" : ""} ${message.streaming ? "is-active" : ""}`}>
      <div
        className="thinking-card-head"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <div className="thinking-icon-wrap">✦</div>
        <div className="tool-card-body-wrap">
          <div className="tool-card-name">Thinking</div>
          <div className="tool-card-sub">{summary}</div>
        </div>
        <span className={`tool-card-status ${message.streaming ? "pending" : "done"}`}>
          {message.streaming ? "reasoning" : "complete"}
        </span>
        <ChevIcon size={14} className="tool-card-chev" />
      </div>

      {isOpen && (
        <div className="tool-card-body">
          {message.streaming && !message.text ? (
            <div className="shimmer" />
          ) : (
            <>
              <div className="tool-section-title">Reasoning trace</div>
              <div className="tool-output thinking-output">{message.text}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
