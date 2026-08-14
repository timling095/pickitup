import { useRef, useState, type PointerEvent } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Prompt } from './Button';
import { lerpLabelColor } from './leverColor';

// The Lever's sibling, sitting in the Glossary card where a plain title button used
// to live — same track/lever visual language (rounded pill track, boxy overshooting
// lever, press-scale) but different physics underneath: this one isn't a two-mode
// toggle, it's one resting side (Scope) and one momentary trigger (Search). Scope is
// always where the lever lives at rest — tapping it (or dragging toward Search and
// letting go short of committing) opens the Filter/Terms Viewer, same as the old
// Glossary button's onClick.
//
// Search never "stays" selected, and — this is the part worth calling out — it's the
// lever physically *touching* the Search side that causes the search, not the tap or
// the drag-past-halfway gesture itself. So both paths (a plain tap on Search, and a
// drag released anywhere past the commit point) route through the same two-phase
// `fireSearch`: snap the lever the rest of the way onto Search (even a tap, which
// otherwise wouldn't move the lever at all, gets an animated trip over), wait for that
// snap to actually land, *then* call `onTriggerSearch` and let the lever spring back to
// Scope — same `transition-all duration-200` the Lever uses for its own release-snap,
// just run twice in sequence instead of once. `isTriggering` blocks new gestures for
// the whole round trip so a second tap/drag can't interrupt mid-animation.
//
// Caption behavior is copied from the Lever exactly, not approximated: both sides
// always mount a caption row, collapsed via `grid-template-rows` (not opacity — opacity
// alone doesn't reclaim the row's height, which is what actually keeps two titles at
// different heights lined up with each other). Scope's caption is expanded only when
// the lever is fully at rest (not dragging, not mid-trigger-sequence); Search's stays
// permanently collapsed, since it has no "you're here" state worth announcing. Titles
// stay the only thing visible for the whole time the lever is in motion, live-dragged
// or animated, same as the Lever mid-drag shows only titles, never a caption caught
// mid-transition.
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
  // Matches the Lever's own `duration-200` release-snap — reused here for both legs
  // of the trigger sequence (Scope→Search, then Search→Scope).
  const SNAP_DURATION_MS = 200;

  // null = resting at Scope. 0–1 = the lever's live position, whether driven by a real
  // drag (see `isDragging`) or by the automated snap-to-Search/bounce-back sequence
  // (see `isTriggering`) — either way this is the one source of truth `displayFrac`
  // below reads from.
  const [dragFrac, setDragFrac] = useState<number | null>(null);
  // Threshold-gated, same as the Lever's `isDragging` — short of DRAG_THRESHOLD_PX a
  // gesture still reads as a plain tap, so captions shouldn't already be collapsing.
  // Also what disables the position transition (live drag frames must track the
  // finger exactly, not ease toward it).
  const [isDragging, setIsDragging] = useState(false);
  // True from the moment Search is actually triggered (tap, or a committed drag
  // release) until the lever finishes bouncing back — blocks new gestures/taps and
  // keeps captions collapsed for the whole animated round trip, not just live drags.
  const [isTriggering, setIsTriggering] = useState(false);

  const fireSearch = () => {
    setIsTriggering(true);
    setIsDragging(false);
    // Transitions are enabled here (isDragging is false), so this animates smoothly
    // from wherever the gesture left off — or from rest, for a plain tap — the rest
    // of the way onto Search, instead of jumping straight there.
    setDragFrac(1);
    window.setTimeout(() => {
      onTriggerSearch();
      setDragFrac(null);
      window.setTimeout(() => setIsTriggering(false), SNAP_DURATION_MS);
    }, SNAP_DURATION_MS);
  };

  const handleClick = (side: 'scope' | 'search') => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    if (isTriggering) return;
    if (side === 'scope') onOpenScope();
    else fireSearch();
  };

  const handleTrackPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || isTriggering) return;
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
        // Reaching Search fires it (via the same snap-then-bounce as a tap); anything
        // short of that is an aborted pull back toward Scope — Scope was never "left"
        // in the first place, so there's nothing to resolve there, just a plain
        // release-to-rest.
        if (lastFrac >= COMMIT_FRACTION) {
          fireSearch();
        } else {
          setIsDragging(false);
          setDragFrac(null);
        }
      } else {
        setIsDragging(false);
        setDragFrac(null);
      }
      draggedRef.current = false;
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

  // The lever is "in motion" — live-dragged or mid-trigger-sequence — whenever either
  // is true; captions collapse and label colors track position for the whole stretch,
  // not just live drags.
  const isMoving = isDragging || isTriggering;

  // 0 at rest (Scope) — dragging or the trigger sequence live-track `dragFrac`.
  const displayFrac = dragFrac ?? 0;
  const isSearchSide = displayFrac > 0.5;
  // Continuous, not binary — same `lerpLabelColor` blend the Lever uses, so the label
  // color eases through the whole range the lever travels (live-dragged or animated)
  // instead of hard-cutting between two fixed colors partway across.
  const scopeCloseness = 1 - displayFrac;
  const searchCloseness = displayFrac;

  return (
    <div
      ref={trackRef}
      onPointerDown={handleTrackPointerDown}
      className="relative flex h-11 bg-slate-200 px-0.5 rounded-full shadow-[inset_0_2px_6px_rgba(0,0,0,0.18)] w-full touch-none cursor-grab active:cursor-grabbing"
    >
      <button
        onClick={() => handleClick('scope')}
        disabled={scopeDisabled}
        style={dragFrac !== null ? { color: lerpLabelColor(scopeCloseness) } : undefined}
        className={`peer relative z-10 flex-1 min-w-0 shadow-md text-base font-medium flex flex-col items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 rounded-l-full rounded-r-xl text-white ${
          isDragging ? '' : 'transition-colors'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <BookOpen size={18} strokeWidth={2} />
          Scope
        </span>
        {/* Always mounted, collapsed via grid-rows (not opacity) whenever moving —
            reclaiming the row's height is what lets the icon+label above recenter,
            keeping Scope's title at the same vertical position the Lever's active side
            sits at, rather than staying pinned high with a hidden-but-still-occupying
            caption underneath it. */}
        <div className={`grid w-full transition-[grid-template-rows,margin-top] duration-200 ease-out ${!isMoving ? 'grid-rows-[1fr] mt-0.5' : 'grid-rows-[0fr] mt-0'}`}>
          <div className="overflow-hidden">
            <Prompt>View Terms</Prompt>
          </div>
        </div>
      </button>
      <button
        onClick={() => handleClick('search')}
        style={dragFrac !== null ? { color: lerpLabelColor(searchCloseness) } : undefined}
        className={`peer relative z-10 flex-1 min-w-0 shadow-md text-base font-medium flex flex-col items-center justify-center cursor-pointer rounded-r-full rounded-l-xl text-slate-500 hover:text-slate-700 ${
          isDragging ? '' : 'transition-colors'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Search size={18} strokeWidth={2} />
          Search
        </span>
        {/* Permanently collapsed — Search never has a "you're here" state to caption,
            and it stays title-only for the whole time the lever is in motion, same as
            Scope. Still mounted (rather than omitted) so its box height math matches
            Scope's collapsed state exactly, keeping both titles on the same baseline
            whenever neither caption is shown. */}
        <div className="grid w-full grid-rows-[0fr] mt-0">
          <div className="overflow-hidden">
            <Prompt showChevron={false}>Search everything</Prompt>
          </div>
        </div>
      </button>
      <div
        // duration-150 + a "back" cubic-bezier (overshoots past the target before
        // settling) — same forceful snap as the Lever, matching feel between the two.
        className={`absolute rounded-xl bg-slate-800 shadow-md pointer-events-none ${
          isDragging ? '' : 'transition-all duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)]'
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
