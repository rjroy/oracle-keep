import { getRegistry } from "@/lib/registry";

export default async function NotFound() {
  const registry = await getRegistry();
  return (
    <main className="stage">
      <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
        <h2>Page not found</h2>
        <p style={{ color: "var(--fg-2)", marginTop: "0.5rem" }}>
          The page you are looking for does not exist.
        </p>
        <p style={{ color: "var(--fg-2)", marginTop: "0.5rem" }}>
          {
            registry.sessions.length > 0
              ? "Try selecting a session from the sidebar."
              : "Add a session using the sidebar to get started."
          }
        </p>
      </div>
    </main>
  );
}