import { notFound } from "next/navigation";
import { findSession } from "@/lib/registry";
import Chat from "@/components/Chat";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await findSession(id);
  if (!record) notFound();
  return <Chat sessionId={id} />;
}
