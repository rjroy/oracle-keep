import { NextResponse } from "next/server";
import { getSession, getWidgetSnapshotForSession } from "@/lib/session";
import { findSession } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const record = await findSession(id);
  if (!record) return Response.json({ error: "Session not found" }, { status: 404 });

  // Ensure the in-memory session exists so extension-discovered metadata
  // (slash commands, etc.) is available on first page load.
  await getSession(id, record.cwd, { sessionFile: record.sessionFile });
 
  return NextResponse.json(getWidgetSnapshotForSession(id));
}
