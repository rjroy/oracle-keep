import type { KeyboardEvent, RefObject } from "react";
import type { SessionListItem } from "@/types/session";
import { PencilIcon } from "@/components/icons";

type RenameProps = {
  isRenaming: boolean;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
};

type DeleteProps = {
  isConfirming: boolean;
  onRequest: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function SessionItem({
  entry,
  isActive,
  rename,
  renameInputRef,
  deleteConfirm,
  onNavigate,
  onStartRename,
}: {
  entry: SessionListItem;
  isActive: boolean;
  rename: RenameProps;
  renameInputRef: RefObject<HTMLInputElement | null>;
  deleteConfirm: DeleteProps;
  onNavigate: () => void;
  onStartRename: () => void;
}) {
  return (
    <div
      className={`scroll-item${isActive ? " is-active" : ""}`}
      style={isActive ? { background: "var(--brand-soft)", borderColor: "var(--brand)" } : undefined}
      onClick={() => {
        if (!rename.isRenaming && !deleteConfirm.isConfirming) onNavigate();
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
        {entry.isProcessing && (
          <span
            aria-label="Processing"
            title="Processing"
            style={{
              color: "var(--brand)",
              fontSize: "10px",
              flexShrink: 0,
              animation: "flicker 1.5s ease-in-out infinite",
            }}
          >
            ●
          </span>
        )}

        {rename.isRenaming ? (
          <input
            ref={renameInputRef}
            value={rename.value}
            onChange={(e) => rename.onChange(e.target.value)}
            onBlur={rename.onCommit}
            onKeyDown={rename.onKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              minWidth: 0,
              background: "var(--bg)",
              border: "1px solid var(--brand)",
              borderRadius: "var(--radius-sm)",
              color: "var(--fg-1)",
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-sm)",
              padding: "2px 6px",
              outline: "none",
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-sm)",
              color: "var(--fg-1)",
            }}
          >
            {entry.label}
          </span>
        )}

        {!rename.isRenaming && (
          <button
            aria-label={`Rename session ${entry.label}`}
            title="Rename session"
            className="rail-edit-btn"
            onClick={(e) => { e.stopPropagation(); onStartRename(); }}
            style={{
              flexShrink: 0,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--fg-3)",
              padding: "0 2px",
              lineHeight: "1",
              borderRadius: "var(--radius-sm)",
              transition: "color var(--dur) var(--ease-out)",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--brand)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-3)"; }}
          >
            <PencilIcon size={12} />
          </button>
        )}

        <button
          aria-label={`Forget session ${entry.label}`}
          title="Forget session"
          onClick={(e) => { e.stopPropagation(); deleteConfirm.onRequest(); }}
          style={{
            flexShrink: 0,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--fg-3)",
            padding: "0 2px",
            fontSize: "14px",
            lineHeight: "1",
            borderRadius: "var(--radius-sm)",
            transition: "color var(--dur) var(--ease-out)",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-3)"; }}
        >
          ×
        </button>
      </div>

      {deleteConfirm.isConfirming && (
        <div
          style={{ display: "flex", alignItems: "center", gap: "6px", paddingTop: "6px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            style={{
              flex: 1,
              fontSize: "var(--text-sm)",
              color: "var(--danger)",
              fontFamily: "var(--font-serif)",
            }}
          >
            Remove session?
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); deleteConfirm.onCancel(); }}
            style={{
              flexShrink: 0,
              background: "transparent",
              border: "1px solid var(--rule)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              color: "var(--fg-2)",
              fontSize: "var(--text-sm)",
              fontFamily: "var(--font-serif)",
              padding: "2px 8px",
              lineHeight: "1.4",
            }}
          >
            Cancel
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteConfirm.onConfirm(); }}
            style={{
              flexShrink: 0,
              background: "var(--danger)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              color: "#fff",
              fontSize: "var(--text-sm)",
              fontFamily: "var(--font-serif)",
              padding: "2px 8px",
              lineHeight: "1.4",
            }}
          >
            Remove
          </button>
        </div>
      )}

      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--fg-3)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.cwd}
      </span>
    </div>
  );
}
