import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { buildHistory } from "@/lib/history";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ items: buildHistory(session.messages) });
}
