import fs from "fs/promises";
import { NextResponse } from "next/server";
import { getRegistry, addSession } from "@/lib/registry";
import { isProcessingSession } from "@/lib/session";
import type { SessionListItem } from "@/types/session";

export async function GET(): Promise<Response> {
  const registry = await getRegistry();
  const items: SessionListItem[] = registry.sessions.map((s) => ({
    ...s,
    isProcessing: isProcessingSession(s.id),
  }));
  return NextResponse.json(items);
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as { cwd?: unknown };
  const cwd = body.cwd;

  if (typeof cwd !== "string" || cwd.trim() === "") {
    return NextResponse.json({ error: "cwd is required" }, { status: 400 });
  }

  try {
    const stat = await fs.stat(cwd);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "cwd is not a directory" }, { status: 400 });
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "cwd does not exist" }, { status: 400 });
    }
    throw err;
  }

  const record = await addSession(cwd);
  return NextResponse.json(record, { status: 201 });
}
