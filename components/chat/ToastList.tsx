import type { Toast } from "./types";

export default function ToastList({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-list">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.level}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
