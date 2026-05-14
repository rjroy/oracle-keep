import type { KeyboardEvent, RefObject } from "react";

export default function AddSessionForm({
  value,
  error,
  inputRef,
  onChange,
  onKeyDown,
  onSubmit,
  onCancel,
}: {
  value: string;
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="/path/to/project"
        aria-label="Directory path for new session"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--radius)",
          color: "var(--fg-1)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-sm)",
          padding: "6px 10px",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--brand)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule)"; }}
      />
      {error && (
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-xs)",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          onClick={onSubmit}
          style={{
            flex: 1,
            background: "var(--brand)",
            border: "1px solid var(--brand-hover)",
            borderRadius: "var(--radius)",
            color: "var(--fg-on-ember)",
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-sm)",
            padding: "5px 0",
            cursor: "pointer",
          }}
        >
          Add
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            background: "transparent",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius)",
            color: "var(--fg-2)",
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-sm)",
            padding: "5px 0",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
