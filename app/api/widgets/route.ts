import { NextResponse } from "next/server";
import { getWidgetSnapshot } from "@/lib/session";

export async function GET() {
  return NextResponse.json(getWidgetSnapshot());
}
