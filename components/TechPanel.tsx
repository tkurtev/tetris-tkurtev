import type { ReactNode } from "react";

interface TechPanelProps {
  label: string;
  meta?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Glass HUD panel with a labelled header and accent corner brackets. */
export function TechPanel({ label, meta, className = "", bodyClassName = "", children }: TechPanelProps) {
  return (
    <section className={`panel ${className}`} aria-label={label}>
      <header className="panel-head">
        <span className="label">{label}</span>
        {meta !== undefined && <span className="meta">{meta}</span>}
      </header>
      <div className={`panel-body ${bodyClassName}`}>{children}</div>
    </section>
  );
}
