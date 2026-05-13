import { redirect } from "next/navigation";
import { getRegistry } from "@/lib/registry";

export default async function Home() {
  const registry = await getRegistry();
  if (registry.sessions.length > 0) {
    redirect(`/s/${registry.sessions[0].id}`);
  }
  // Empty state — no sessions registered yet.
  return (
    <main className="stage">
      <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
        <h2>No sessions yet</h2>
        <p style={{ color: "var(--fg-2)", marginTop: "0.5rem" }}>
          Add a session using the sidebar to get started.
        </p>
      </div>
      <div className="composer">
        <div className="composer-inner">
          <div className="composer-box">
            <textarea
              className="composer-input"
              placeholder="Add a session in the sidebar to get started…"
              disabled
              rows={1}
              style={{ cursor: "not-allowed", opacity: 0.5 }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
