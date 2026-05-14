import { useState, useEffect, useCallback } from "react";
import type { SessionListItem } from "@/types/session";

const POLL_INTERVAL_MS = 10_000;

export function useSessions(): {
  sessions: SessionListItem[];
  refreshSessions: () => Promise<void>;
} {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);

  // Manual refresh: called after mutations (rename, delete, add).
  // setSessions is a stable useState setter — safe to omit from deps.
  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data: SessionListItem[] = await res.json();
        setSessions(data);
      }
    } catch {
      // Non-fatal — stale list stays visible until next poll.
    }
  }, []);

  // Initial load + polling. The async function is defined inside the effect so
  // the linter (react-hooks/set-state-in-effect) treats setState as internal.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/sessions");
        if (res.ok && !cancelled) {
          const data: SessionListItem[] = await res.json();
          if (!cancelled) setSessions(data);
        }
      } catch {
        // Non-fatal.
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { sessions, refreshSessions };
}
