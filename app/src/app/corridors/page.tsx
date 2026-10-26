import Link from "next/link";
import { CORRIDORS } from "@/lib/corridors";
import { SPECIES_BY_CODE } from "@/lib/species";

export default function CorridorsIndex() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Deep-dive corridors</h1>
      <p className="mt-2 max-w-3xl text-muted">Three places where the public data is dense enough to schedule lights segment by segment: FHWA traffic counts on every road piece, documented roosts, GBIF sightings, and local evening climate. The national map shows the pattern; these show the plan.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {CORRIDORS.map((c) => (
          <Link key={c.id} href={`/corridors/${c.id}`} className="panel block p-5 transition hover:border-accent/50">
            <div className="label">{c.state}</div>
            <h2 className="mt-1 text-lg font-semibold">{c.name}</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {c.roosts.map((r) => <li key={r.name}><span className="text-fg">{r.name}</span> · {SPECIES_BY_CODE[r.species].common}{r.est ? ` · ~${Intl.NumberFormat("en-US", { notation: "compact" }).format(r.est)}` : ""}</li>)}
            </ul>
            <div className="mt-4 text-sm text-accent-2">Open corridor →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
