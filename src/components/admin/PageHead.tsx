import Link from "next/link";

export function PageHead({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="smallcaps text-stone">{eyebrow}</div>
        <h1 className="mt-1 text-3xl sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-[15px] text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="chalk-link inline-block text-[14.5px] text-gold-dark">
      {children}
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 py-10 text-center text-[15px] text-ink-3">{children}</p>
  );
}
