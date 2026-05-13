import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findSession } from "@/lib/registry";
import { buildHistory } from "@/lib/history";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const record = await findSession(id);
  if (!record) return Response.json({ error: "Session not found" }, { status: 404 });
  const session = await getSession(id, record.cwd);
  return NextResponse.json({ items: buildHistory(session.messages) });
}
