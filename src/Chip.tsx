import type { ReactNode } from 'react';

// Material Design filter chip: fully-rounded, neutral grayscale in both states — MD2
// filter chips don't need the primary/accent color at all, and selecting one never
// inverts its text to white; the darker tonal fill alone communicates "selected".
// No leading checkmark — its presence/absence caused the chip width to shift on toggle.
// Used for every multi-select filter control (Home's Lessons/Word Type, and the
// per-screen Word Type facets in TermsList.tsx/SearchSheet.tsx) so they all read as
// one consistent chip group regardless of which screen they're filtering.
export function Chip({ selected, onClick, disabled, children }: { selected: boolean, onClick: () => void, disabled?: boolean, children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center ${
        selected
          ? 'bg-slate-200 border-slate-200 text-slate-800'
          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
