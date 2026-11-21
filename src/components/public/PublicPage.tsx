/**
 * Public pages are wrapped by the `(public)` route-group layout, which already
 * renders the site header, footer and mobile action bar. This component is kept
 * so existing pages keep working — it only provides section-level helpers now.
 */
export function PublicPage({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function SectionHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-light/40 px-3.5 py-1">
        <span className="size-1.5 rounded-full bg-gold-dark" />
        <span className="smallcaps text-gold-dark">{eyebrow}</span>
      </div>
      <h1 className="mt-3 text-[34px] leading-[1.15] text-ink sm:text-[46px]">{title}</h1>
      {sub && <p className="mt-3 max-w-2xl text-[16.5px] leading-relaxed text-ink-3">{sub}</p>}
    </div>
  );
}
