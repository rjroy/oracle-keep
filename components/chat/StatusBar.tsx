export default function StatusBar({ statuses }: { statuses: Map<string, string> }) {
  if (statuses.size === 0) return null;
  return (
    <div className="ext-status-bar">
      {Array.from(statuses.entries()).map(([key, text]) => (
        <span key={key} className="ext-status-item">{text}</span>
      ))}
    </div>
  );
}
