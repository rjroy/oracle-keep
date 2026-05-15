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
    </main>
  );
}
