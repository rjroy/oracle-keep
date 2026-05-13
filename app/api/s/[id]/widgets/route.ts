import { NextResponse } from "next/server";
import { getWidgetSnapshotForSession } from "@/lib/session";
import { findSession } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const record = await findSession(id);
  if (!record) return Response.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json(getWidgetSnapshotForSession(id));
}
