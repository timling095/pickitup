import { useRef, useState, type PointerEvent } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Prompt } from './Button';

// The Lever's sibling, sitting in the Glossary card where a plain title button used
// to live — same track/lever visual language (rounded pill track, boxy overshooting
// lever, press-scale) but different physics underneath: this one isn't a two-mode
// toggle, it's one resting side (Scope) and one momentary trigger (Search). Scope is
// always where the lever lives at rest — tapping it (or dragging toward Search and
// letting go short of committing) opens the Filter/Terms Viewer, same as the old
// Glossary button's onClick. Search never "stays" selected: reaching it — by tap, or
// by dragging far enough and releasing — fires Global Search immediately and the
// lever springs straight back to Scope, since there's no state on that side to hold.
// That bounce is the same trick as the Lever's own release-snap: `dragFrac` resets to
// `null` in the same batch as the trigger fires, and because the resting position is
// unconditionally frac 0 (no persisted "current side" the way ModeSwitch has
// `activeMode`), the existing `transition-all` alone carries it home.
//
// Caption behavior is copied from the Lever exactly, not approximated: both sides
// always mount a caption row, collapsed via `grid-template-rows` (not opacity — opacity
// alone doesn't reclaim the row's height, which is what actually keeps two titles at
// different heights lined up with each other). Scope's caption is expanded whenever the
// switch isn't mid-drag; Search's stays permanently collapsed, since it has no "you're
// here" state worth announcing. While actually dragging (`isAbstaining`), both collapse
// together — the user sees only the two titles moving, same as the Lever mid-drag shows
// only titles, never a caption caught mid-transition.
export function ScopeSwitch({
  onOpenScope, onTriggerSearch, scopeDisabled
}: {
  onOpenScope: () => void,
  onTriggerSearch: () => void,
  // Nothing to view when the current scope is empty — mirrors the old Glossary
  // button's own `disabled={displayVocab.length === 0}`. Search is never gated by
  // this: it searches the whole dictionary regardless of scope, so an empty scope
  // is exactly the situation where reaching for Search is most useful.
  scopeDisabled?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);
  const justDraggedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const DRAG_THRESHOLD_PX = 6;
  // A drag has to actually reach the Search side to fire it — a small nudge that
  // never gets halfway there is treated as an aborted drag (no callback at all),
  // not a vote for Scope. Scope is reached by tapping it directly, same as before.
  const COMMIT_FRACTION = 0.5;

  // null = resting at Scope. 0–1 while dragging = raw pointer fraction across the
  // track, same live-tracking approach as the Lever.
  const [dragFrac, setDragFrac] = useState<number | null>(null);
  // Threshold-gated, same as the Lever's `isDragging` — short of DRAG_THRESHOLD_PX a
  // gesture still reads as a plain tap, so captions shouldn't already be collapsing.
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = (side: 'scope' | 'search') => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    if (side === 'scope') onOpenScope();
    else onTriggerSearch();
  };

  const handleTrackPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    cleanupRef.current?.();
    const startX = e.clientX;
    const startRect = trackRef.current?.getBoundingClientRect();
    draggedRef.current = false;
    justDraggedRef.current = false;
    // Always anchored at Scope (0) — unlike the Lever, there's no persisted side to
    // read a starting position from.
    const startFrac = startRect && startRect.width > 0 ? (startX - startRect.left) / startRect.width : 0;
    let lastFrac = 0;

    const onMove = (ev: globalThis.PointerEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const rawFrac = (ev.clientX - rect.left) / rect.width;
      lastFrac = Math.min(1, Math.max(0, (rawFrac - startFrac) * 2));
      setDragFrac(lastFrac);
      if (!draggedRef.current) {
        if (Math.abs(ev.clientX - startX) < DRAG_THRESHOLD_PX) return;
        draggedRef.current = true;
        setIsDragging(true);
      }
    };
    const onUp = () => {
      if (draggedRef.current) {
        justDraggedRef.current = true;
        // Reaching Search fires it; anything short of that is an aborted pull back
        // toward Scope — Scope was never "left" in the first place, so there's
        // nothing to resolve there.
        if (lastFrac >= COMMIT_FRACTION) onTriggerSearch();
      }
      draggedRef.current = false;
      setIsDragging(false);
      setDragFrac(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      cleanupRef.current = null;
    };
    cleanupRef.current = onUp;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // Past the drag threshold, the switch abstains — same as the Lever — so neither
  // caption is mid-flight-committed to an answer the gesture hasn't reached yet.
  const isAbstaining = isDragging;

  // 0 at rest (Scope) — dragging live-tracks the pointer, same as the Lever.
  const displayFrac = dragFrac ?? 0;
  const isSearchSide = displayFrac > 0.5;

  return (
    <div
      ref={trackRef}
      onPointerDown={handleTrackPointerDown}
      className="relative flex h-11 bg-slate-200 px-0.5 rounded-full shadow-[inset_0_2px_6px_rgba(0,0,0,0.18)] w-full touch-none cursor-grab active:cursor-grabbing"
    >
      <button
        onClick={() => handleClick('scope')}
        disabled={scopeDisabled}
        className={`peer relative z-10 flex-1 min-w-0 shadow-md text-base font-medium flex flex-col items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 rounded-l-full rounded-r-xl ${
          dragFrac === null ? 'transition-colors' : ''
        } ${isAbstaining && isSearchSide ? 'text-slate-500' : 'text-white'}`}
      >
        <span className="flex items-center gap-1.5">
          <BookOpen size={18} strokeWidth={2} />
          Scope
        </span>
        {/* Always mounted, collapsed via grid-rows (not opacity) whenever abstaining —
            reclaiming the row's height is what lets the icon+label above recenter,
            keeping Scope's title at the same vertical position the Lever's active side
            sits at, rather than staying pinned high with a hidden-but-still-occupying
            caption underneath it. */}
        <div className={`grid w-full transition-[grid-template-rows,margin-top] duration-200 ease-out ${!isAbstaining ? 'grid-rows-[1fr] mt-0.5' : 'grid-rows-[0fr] mt-0'}`}>
          <div className="overflow-hidden">
            <Prompt>View Terms</Prompt>
          </div>
        </div>
      </button>
      <button
        onClick={() => handleClick('search')}
        className={`peer relative z-10 flex-1 min-w-0 shadow-md text-base font-medium flex flex-col items-center justify-center cursor-pointer rounded-r-full rounded-l-xl ${
          dragFrac === null ? 'transition-colors' : ''
        } ${isAbstaining && isSearchSide ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}
      >
        <span className="flex items-center gap-1.5">
          <Search size={18} strokeWidth={2} />
          Search
        </span>
        {/* Permanently collapsed — Search never has a "you're here" state to caption,
            and during a drag it stays title-only same as Scope. Still mounted (rather
            than omitted) so its box height math matches Scope's collapsed state exactly,
            keeping both titles on the same baseline whenever neither caption is shown. */}
        <div className="grid w-full grid-rows-[0fr] mt-0">
          <div className="overflow-hidden">
            <Prompt showChevron={false}>Search everything</Prompt>
          </div>
        </div>
      </button>
      <div
        className={`absolute rounded-xl bg-slate-800 shadow-md pointer-events-none ${
          dragFrac === null ? 'transition-all duration-200 ease-out' : ''
        } peer-active:scale-95 ${scopeDisabled && !isSearchSide ? 'opacity-70' : ''}`}
        style={{
          top: '-9px',
          bottom: '-9px',
          left: `calc(${displayFrac * 50}% + ${displayFrac - 1}px)`,
          width: 'calc(50% + 1px)'
        }}
      />
    </div>
  );
}
