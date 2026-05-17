import os from "os";
import path from "path";
import fsPromises from "fs/promises";
import type { FsLike } from "./registry";
import type { SessionConfig } from "../types/session";

// ── Config path ────────────────────────────────────────────────────────────────

function configPath(): string {
  const raw = process.env.ORACLE_CONFIG_PATH ?? "~/.oracle-keep/config.json";
  return raw.startsWith("~") ? path.join(os.homedir(), raw.slice(1)) : raw;
}

// ── Singleton ──────────────────────────────────────────────────────────────────
// Stored on globalThis so it survives Next.js hot-module reloads in development.
declare global {
  var __oracleKeepConfig: SessionConfig | undefined;
}

// ── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SessionConfig = {
  model: "",
};

// ── Internal helpers ───────────────────────────────────────────────────────────

async function loadConfig(fs?: FsLike): Promise<SessionConfig> {
  const fsi = fs ?? fsPromises;
  try {
    const raw = await fsi.readFile(configPath(), "utf-8");
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<SessionConfig>) };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_CONFIG };
    }
    throw err;
  }
}

// ── Exported API ───────────────────────────────────────────────────────────────

export async function getConfig(fs?: FsLike): Promise<SessionConfig> {
  if (!globalThis.__oracleKeepConfig) {
    globalThis.__oracleKeepConfig = await loadConfig(fs);
  }
  return globalThis.__oracleKeepConfig;
}

export async function saveConfig(config: SessionConfig, fs?: FsLike): Promise<void> {
  const fsi = fs ?? fsPromises;
  const filePath = configPath();
  const dir = path.dirname(filePath);
  const tmp = `${filePath}.tmp`;

  await fsi.mkdir(dir, { recursive: true });
  await fsi.writeFile(tmp, JSON.stringify(config, null, 2), "utf-8");
  await fsi.rename(tmp, filePath);

  // Keep singleton in sync so subsequent getConfig() calls return current state.
  globalThis.__oracleKeepConfig = config;
}

export async function setModel(model: string, fs?: FsLike): Promise<void> {
  const config = await getConfig(fs);
  await saveConfig({ ...config, model }, fs);
}
