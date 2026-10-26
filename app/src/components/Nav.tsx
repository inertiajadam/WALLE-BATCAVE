"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: [string, string][] = [
  ["/", "National map"],
  ["/corridors", "Corridors"],
  ["/utility", "Utility dashboard"],
  ["/tonight", "Tonight"],
  ["/methodology", "Methodology"],
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[rgba(5,7,13,0.8)] backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-4 py-2">
        <Link href="/" className="mr-3 flex items-center gap-2">
          <span className="inline-block h-6 w-6 rounded-full bg-[radial-gradient(circle_at_35%_35%,#f5b342,#7a4a00_70%)] shadow-[0_0_18px_#f5b34288]" />
          <span className="font-semibold tracking-tight">Black Corridor</span>
          <span className="hidden text-xs text-muted sm:inline">bat-aware highway lighting</span>
        </Link>
        <nav className="ml-auto flex flex-wrap items-center gap-1">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="nav" data-active={href === "/" ? path === "/" : path.startsWith(href)}>{label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
