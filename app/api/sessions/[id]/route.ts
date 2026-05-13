import { NextResponse } from "next/server";
import { findSession, forgetSession, updateLabel } from "@/lib/registry";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const body = (await req.json()) as { label?: unknown };
  const label = body.label;

  if (typeof label !== "string") {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const updated = await updateLabel(id, label);
  if (updated === undefined) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const session = await findSession(id);
  if (session === undefined) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  await forgetSession(id);
  return new Response(null, { status: 204 });
}
