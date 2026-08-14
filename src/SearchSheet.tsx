import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Search, X } from 'lucide-react';
import { DICTIONARY } from './dictionary';
import { TermsTable } from './TermsTable';

// Material Design 2 bottom sheet — the Global Search surface. Search here spans the
// whole dictionary regardless of the Lessons/Word Type scope — the Filter screen
// (TermsList.tsx) is the counterpart that keeps the chips/tabs and stays scoped. Both
// share the exact same result-table column style (TermsTable.tsx): 辞書形/ます形/
// Meaning/Form, both forms shown side by side — there's no separate tense toggle here
// anymore, since showing both makes picking one pointless.
export function SearchSheet({
  open, onClose, markedTerms, onToggleMark
}: {
  open: boolean,
  onClose: () => void,
  markedTerms: Record<string, boolean>,
  onToggleMark: (id: string) => void
}) {
  const [query, setQuery] = useState('');
  const [sortByForm, setSortByForm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Each open starts from a blank query — a lingering result from three opens ago is
  // more confusing than a fresh box, and the sheet is quick enough to reach (see
  // ScopeSwitch's pull-to-search) that retyping a repeat search costs almost nothing.
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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return DICTIONARY.filter(v =>
      v.term.toLowerCase().includes(q) ||
      v.reading.toLowerCase().includes(q) ||
      v.definition.toLowerCase().includes(q) ||
      (v.dic_form?.toLowerCase().includes(q) ?? false) ||
      (v.dic_form_reading?.toLowerCase().includes(q) ?? false)
      // Capped — a one- or two-character query against the whole dictionary can
      // match hundreds of entries, and nobody scrolls past the first screenful
      // of a lookup anyway.
    ).slice(0, 80);
  }, [query]);

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
      {/* Sheet — a fixed height from the moment it opens, not a max-height that shrinks
          to fit however many results there are: a sheet that grows/shrinks as you type
          reads as unstable, and the empty space for a short result list is a smaller
          cost than that jitter. The result list below is the only flexible piece
          (`flex-1 min-h-0`), filling whatever's left under the fixed handle+search row. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col ${
          isDraggingSheet ? '' : 'transition-transform duration-250 ease-out'
        } ${open ? '' : 'translate-y-full'}`}
        style={{
          height: '85dvh',
          transform: open && dragY > 0 ? `translateY(${dragY}px)` : undefined
        }}
      >
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          onPointerDown={handleHandlePointerDown}
        >
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

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

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-8">
          <TermsTable
            vocab={results}
            showDicForm
            sortByForm={sortByForm}
            onToggleSortByForm={() => setSortByForm(s => !s)}
            markedTerms={markedTerms}
            onToggleMark={onToggleMark}
            emptyMessage={query.trim() === '' ? 'Search across every lesson, not just your current scope.' : 'No terms match your search.'}
          />
        </div>
      </div>
    </>
  );
}
