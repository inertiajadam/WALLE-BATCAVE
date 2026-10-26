import { notFound } from "next/navigation";
import { CORRIDORS, CORRIDOR_BY_ID } from "@/lib/corridors";
import CorridorView from "@/components/CorridorView";

export function generateStaticParams() { return CORRIDORS.map((c) => ({ id: c.id })); }
export const dynamicParams = false;

export default async function CorridorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = CORRIDOR_BY_ID[id];
  if (!c) notFound();
  return <CorridorView corridor={c} />;
}
