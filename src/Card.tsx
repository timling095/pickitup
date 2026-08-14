import type { ReactNode } from 'react';

// The white rounded container the Home screen's single card and Settings' own card
// both use — the only two places a titled section of card content shows up, which is
// what earns this its own file (Chip.tsx-sized: a couple of small, purely
// presentational atoms, not a fat file's worth of logic).
export function Card({ className = '', children }: { className?: string, children: ReactNode }) {
  return (
    <div className={`bg-white rounded-3xl p-5 pb-6 shadow-sm border border-slate-100 ${className}`}>
      {children}
    </div>
  );
}

// A section's plain sentence-case heading (Lessons, Word Type, Verb Form, Working
// Terms Range, Strict Pitch Accent). `tight` (mb-1 instead of mb-3) is for sections
// that have Helper text directly beneath them, which supplies its own bottom spacing
// instead.
export function SectionLabel({ tight = false, children }: { tight?: boolean, children: ReactNode }) {
  return <div className={`font-normal text-slate-700 ${tight ? 'mb-1' : 'mb-3'}`}>{children}</div>;
}

// The one-line description under a Section label (e.g. "How many terms stay active…").
export function HelperText({ className = '', children }: { className?: string, children: ReactNode }) {
  return <div className={`text-xs text-slate-400 ${className}`}>{children}</div>;
}
