import type { SessionListItem } from "@/types/session";

export default function CollapsedSessionAvatar({
  entry,
  isActive,
  onClick,
}: {
  entry: SessionListItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={entry.label}
      onClick={onClick}
      style={{
        position: "relative",
        width: 32,
        height: 32,
        borderRadius: "9999px",
        border: isActive ? "2px solid var(--brand)" : "1px solid var(--rule)",
        background: isActive ? "var(--brand-soft)" : "var(--bg)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontSize: "12px",
        color: "var(--fg-1)",
        flexShrink: 0,
        padding: 0,
      }}
    >
      {entry.label.charAt(0).toUpperCase()}
      {entry.isProcessing && (
        <span
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: "9999px",
            background: "var(--brand)",
            animation: "flicker 1.5s ease-in-out infinite",
          }}
        />
      )}
    </button>
  );
}
