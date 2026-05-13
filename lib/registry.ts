import os from "os";
import path from "path";
import fsPromises from "fs/promises";
import type { SessionRecord, SessionRegistry } from "../types/session";

// Minimal interface for filesystem operations — real fs/promises satisfies this
// structurally, and test fakes can implement it without matching all overloads.
export interface FsLike {
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  writeFile(path: string, data: string, encoding: BufferEncoding): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
}

// ── Registry path ──────────────────────────────────────────────────────────────

function registryPath(): string {
  const raw = process.env.ORACLE_REGISTRY_PATH ?? "~/.oracle-keep/registry.json";
  return raw.startsWith("~") ? path.join(os.homedir(), raw.slice(1)) : raw;
}

// ── Singleton ──────────────────────────────────────────────────────────────────
// Stored on globalThis so it survives Next.js hot-module reloads in development.
declare global {
  var __oracleKeepRegistry: SessionRegistry | undefined;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function loadRegistry(fs?: FsLike): Promise<SessionRegistry> {
  const fsi = fs ?? fsPromises;
  try {
    const raw = await fsi.readFile(registryPath(), "utf-8");
    return JSON.parse(raw) as SessionRegistry;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { sessions: [] };
    }
    throw err;
  }
}

function deriveLabel(cwd: string): string {
  const normalized = cwd.replace(/\/+$/, "");
  return path.basename(normalized);
}

// ── Exported API ───────────────────────────────────────────────────────────────

export async function saveRegistry(
  registry: SessionRegistry,
  fs?: FsLike,
): Promise<void> {
  const fsi = fs ?? fsPromises;
  const filePath = registryPath();
  const dir = path.dirname(filePath);
  const tmp = `${filePath}.tmp`;

  await fsi.mkdir(dir, { recursive: true });
  await fsi.writeFile(tmp, JSON.stringify(registry, null, 2), "utf-8");
  await fsi.rename(tmp, filePath);

  // Keep singleton in sync so subsequent getRegistry() calls return current state.
  globalThis.__oracleKeepRegistry = registry;
}

export async function getRegistry(fs?: FsLike): Promise<SessionRegistry> {
  if (!globalThis.__oracleKeepRegistry) {
    const loaded = await loadRegistry(fs);
    globalThis.__oracleKeepRegistry = loaded;
  }
  return globalThis.__oracleKeepRegistry;
}

export async function addSession(cwd: string, fs?: FsLike): Promise<SessionRecord> {
  const registry = await getRegistry(fs);
  const record: SessionRecord = {
    id: crypto.randomUUID(),
    cwd,
    label: deriveLabel(cwd),
    addedAt: new Date().toISOString(),
  };
  const updated: SessionRegistry = { sessions: [...registry.sessions, record] };
  await saveRegistry(updated, fs);
  return record;
}

export async function forgetSession(id: string, fs?: FsLike): Promise<void> {
  const registry = await getRegistry(fs);
  const updated: SessionRegistry = {
    sessions: registry.sessions.filter((s) => s.id !== id),
  };
  await saveRegistry(updated, fs);
}

export async function updateLabel(
  id: string,
  label: string,
  fs?: FsLike,
): Promise<SessionRecord | undefined> {
  const registry = await getRegistry(fs);
  const index = registry.sessions.findIndex((s) => s.id === id);
  if (index === -1) return undefined;

  const existing = registry.sessions[index];
  const newLabel = label.trim() === "" ? deriveLabel(existing.cwd) : label;
  const updated: SessionRecord = { ...existing, label: newLabel };

  const sessions = [...registry.sessions];
  sessions[index] = updated;
  await saveRegistry({ sessions }, fs);
  return updated;
}

export async function findSession(id: string, fs?: FsLike): Promise<SessionRecord | undefined> {
  const registry = await getRegistry(fs);
  return registry.sessions.find((s) => s.id === id);
}
