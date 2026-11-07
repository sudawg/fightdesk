import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Stat({ label, value, sub, tone, className }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "pos" | "neg" | null; className?: string }) {
  return (
    <div className={cn("min-w-0 px-4 py-3", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("num mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl", tone === "pos" && "text-success", tone === "neg" && "text-destructive")}>{value}</div>
      {sub != null && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 lg:grid-cols-6 [&>*]:bg-card", className)}>{children}</div>;
}

export function Delta({ base, now, fmt, invert = false }: { base: number | null; now: number | null; fmt: (x: number) => string; invert?: boolean }) {
  if (base == null || now == null) return null;
  const d = now - base;
  if (Math.abs(d) < 1e-6) return null;
  const good = invert ? d < 0 : d > 0;
  return <span className={cn("num ml-1.5 text-[11px] font-medium", good ? "text-success" : "text-destructive")}>{d > 0 ? "+" : "−"}{fmt(Math.abs(d))}</span>;
}

export function SectionHead({ title, desc, right }: { title: string; desc?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {desc && <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border bg-card", className)}>{children}</section>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-5 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function StatusDot({ status, result }: { status: string; result?: string }) {
  const c = status === "live" ? "bg-warning animate-pulse" : result === "W" ? "bg-success" : result === "L" ? "bg-destructive" : "bg-muted-foreground/40";
  return <span aria-hidden className={cn("inline-block h-2 w-2 shrink-0 rounded-full", c)} />;
}

/** Likely finish on a log rank scale: paid zone, middle 80%, median, today's rank. */
export function RangeBar({ field, paidN, p10, p50, p90, rank, className }: { field: number; paidN: number; p10: number; p50: number; p90: number; rank: number; className?: string }) {
  const W = 160, H = 14, pad = 3;
  const x = (v: number) => pad + (Math.log(Math.max(1, Math.min(v, field))) / Math.log(Math.max(2, field))) * (W - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("h-3.5 w-full", className)} role="img" aria-label={`Likely finish ${p10} to ${p90}, median ${p50}, now ${rank}`}>
      <rect x={pad} y={5} width={W - 2 * pad} height={4} rx={2} className="fill-muted" />
      <rect x={pad} y={5} width={Math.max(0, x(paidN) - pad)} height={4} rx={2} className="fill-success/25" />
      <rect x={x(p10)} y={5} width={Math.max(2, x(p90) - x(p10))} height={4} rx={2} className="fill-foreground/80" />
      <circle cx={x(p50)} cy={7} r={3} className="fill-foreground" />
      <line x1={x(rank)} x2={x(rank)} y1={0} y2={H} className="stroke-brand" strokeWidth={1.5} />
    </svg>
  );
}

export function Seg<T extends string | number | null>({ value, options, onChange, label, size = "sm" }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-md bg-muted p-0.5 no-scrollbar">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "press hit-sm whitespace-nowrap rounded-[6px] font-medium text-muted-foreground hover:text-foreground",
            size === "sm" ? "hit min-h-8 px-2.5 text-xs" : "min-h-9 px-3 text-sm",
            value === o.v && "bg-background text-foreground shadow-sm",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
