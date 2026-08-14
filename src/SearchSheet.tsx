import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Search, X } from 'lucide-react';
import { DICTIONARY, wordTypeOf, presentWordTypes, WORD_TYPE_LABELS } from './dictionary';
import type { WordType } from './dictionary';
import { TermsTable } from './TermsTable';
import { Chip } from './Chip';

const ALL_TYPES_SELECTED: Record<WordType, boolean> = { verb: true, na_adj: true, i_adj: true, noun: true, other: true };

// Material Design 2 bottom sheet — the Global Search surface. Search here spans the
// whole dictionary regardless of the Lessons/Word Type scope — the Filter screen
// (TermsList.tsx) is the counterpart that keeps the chips/tabs and stays scoped. Both
// share the exact same result-table column style (TermsTable.tsx): 辞書形/ます形/
// Meaning/Form, both forms shown side by side — there's no separate tense toggle here
// anymore, since showing both makes picking one pointless. `card={false}` on
// TermsTable below drops its own bg/border/shadow — the sheet itself is already the
// surface, so a card nested inside it would just be a redundant second one.
export function SearchSheet({
  open, onClose, markedTerms, onToggleMark
}: {
  open: boolean,
  onClose: () => void,
  markedTerms: Record<string, boolean>,
  onToggleMark: (id: string) => void
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Each open starts from a blank query — a lingering result from three opens ago is
  // more confusing than a fresh box, and the sheet is quick enough to reach (a single
  // tap on the header's Search icon) that retyping a repeat search costs almost nothing.
  // Reset during render (React's documented pattern for "adjust state when a prop
  // changes") rather than in an effect — an effect would set state a frame late,
  // visibly flashing the previous query before it clears.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setQuery('');
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  const allHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return DICTIONARY.filter(v =>
      v.term.toLowerCase().includes(q) ||
      v.reading.toLowerCase().includes(q) ||
      v.definition.toLowerCase().includes(q) ||
      (v.dic_form?.toLowerCase().includes(q) ?? false) ||
      (v.dic_form_reading?.toLowerCase().includes(q) ?? false)
    );
  }, [query]);

  // Word Type facet — all five chips stay under the search bar permanently, same set
  // the Home screen's own Word Type chips offer, rather than the row appearing or
  // individual chips vanishing depending on the query. Once there's a query, whichever
  // types have zero hits get disabled instead of removed — still visible, so the row's
  // shape never shifts, just not tappable until a query brings that type back. Before
  // any query is typed nothing is disabled: there's nothing to narrow yet. Selection
  // persists across queries rather than resetting each time — a search narrowed to just
  // Verbs stays narrowed to Verbs for the next query too, the same way a shopping filter
  // stays applied until you change it yourself.
  const presentTypes = useMemo(() => presentWordTypes(allHits), [allHits]);
  const presentTypeSet = useMemo(() => new Set(presentTypes), [presentTypes]);
  const [selectedTypes, setSelectedTypes] = useState<Record<WordType, boolean>>(ALL_TYPES_SELECTED);

  const results = useMemo(() => {
    const filtered = allHits.filter(v => selectedTypes[wordTypeOf(v)]);
    // Capped after filtering, not before — a broad query narrowed down to one word
    // type should still fill the screen with matches of that type, not just whatever
    // happened to be in the first 80 raw hits.
    return filtered.slice(0, 80);
  }, [allHits, selectedTypes]);

  // Swipe-down-to-dismiss on the handle, standard MD2 bottom sheet behavior.
  // `dragY` is the live pixel offset while dragging; released past
  // DISMISS_THRESHOLD_PX closes the sheet, otherwise it springs back to 0 via
  // the same `transition-transform` used for the open/close animation itself
  // (dragY resets to 0 in the same batch that re-enables the transition).
  const [dragY, setDragY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const DISMISS_THRESHOLD_PX = 90;

  const handleHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    const startY = e.clientY;
    let lastY = 0;
    setIsDraggingSheet(true);

    const onMove = (ev: PointerEvent) => {
      lastY = Math.max(0, ev.clientY - startY);
      setDragY(lastY);
    };
    const onUp = () => {
      setIsDraggingSheet(false);
      setDragY(0);
      if (lastY > DISMISS_THRESHOLD_PX) onClose();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <>
      {/* Scrim */}
      <div
        className={`fixed inset-0 bg-slate-900/40 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      {/* Sheet — full height (minus a 16px top inset, so it never quite touches the
          status bar) from the moment it opens: with the on-screen keyboard up for most
          of this screen's actual use, vertical room is the scarce resource, so there's
          no reason to hold any of it back. The result list below is the only flexible
          piece (`flex-1 min-h-0`), filling whatever's left under the fixed handle/
          search/facet rows. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col ${
          isDraggingSheet ? '' : 'transition-transform duration-250 ease-out'
        } ${open ? '' : 'translate-y-full'}`}
        style={{
          height: 'calc(100dvh - 16px)',
          transform: open && dragY > 0 ? `translateY(${dragY}px)` : undefined
        }}
      >
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          onPointerDown={handleHandlePointerDown}
        >
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* The search box keeps its own fixed px-5 margin regardless of what's below
            it — its width doesn't move to meet the table. TermsTable's own gutter
            (px-4 → px-5 when `card={false}`, see TermsTable.tsx) is what adjusts to
            line "Term" up under the search icon instead. */}
        <div className="px-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 h-11">
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by term, reading, or meaning..."
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-300 text-white flex items-center justify-center cursor-pointer hover:bg-slate-400 transition-colors"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        {/* Word Type facet — always all five, always here (see the comment above
            `presentTypeSet`). Shares the search box's own px-5 margin, not the
            table's. */}
        <div className="flex flex-wrap gap-2 px-5 pb-3 flex-shrink-0">
          {(Object.keys(WORD_TYPE_LABELS) as WordType[]).map((t) => (
            <Chip
              key={t}
              selected={selectedTypes[t]}
              onClick={() => setSelectedTypes(prev => ({ ...prev, [t]: !prev[t] }))}
              disabled={query.trim() !== '' && !presentTypeSet.has(t)}
            >
              {WORD_TYPE_LABELS[t]}
            </Chip>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-4 pb-8">
          <TermsTable
            vocab={results}
            showDicForm
            markedTerms={markedTerms}
            onToggleMark={onToggleMark}
            emptyMessage={query.trim() === '' ? 'Search across every lesson, not just your current scope.' : 'No terms match your search.'}
            card={false}
          />
        </div>
      </div>
    </>
  );
}
