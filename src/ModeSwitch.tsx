import { useRef, useState, type PointerEvent } from 'react';
import { PenLine, Eye } from 'lucide-react';
import { Prompt } from './Button';

// slate-500 (inactive label color) <-> white (active), blended by `t` (0-1).
// A plain RGB lerp rather than `color-mix()` so this stays trivially
// predictable — no interpolation-space surprises — for a value that's
// recomputed on every pointermove during a drag.
const INACTIVE_RGB: [number, number, number] = [100, 116, 139];
function lerpLabelColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const [r, g, b] = INACTIVE_RGB.map(c => Math.round(c + clamped * (255 - c)));
  return `rgb(${r}, ${g}, ${b})`;
}

// Mode switch: DualRangeSlider's overshoot trick pushed into an actual hardware
// toggle that now also *launches*. The lever is `bg-slate-800` — this app's one
// "primary action" color, inherited directly from the Start Session button it
// replaces — so it reads clearly against the white card instead of disappearing
// into it. Tapping the side that's already active launches (or resumes) that
// mode's session; tapping the other side just switches, the same as before.
// The track is fully rounded (a thin pill, echoing DualRangeSlider's own slender
// line) but the lever itself stays boxy — `rounded-xl`, the same radius as the
// app's cards and buttons — so it reads as a distinct rectangular object riding
// inside a round groove, not just a bigger pill nested in a smaller one. The
// lever overshoots the track on all four sides — a slim horizontal overshoot
// past the pill's rounded caps (echoing DualRangeSlider's thumb overshooting
// its line) paired with a taller vertical one, so the boxy lever reads as a
// tall, narrow object riding *on top of* the thin track rather than being
// inlaid flush into it. That vertical overshoot is safe in a way it wasn't
// during an earlier attempt at this: the earlier "off-center" illusion came
// from an unrelated bug (the caption forcing both sides to share a baseline
// instead of centering independently — see below), not from the overshoot
// itself. With that fixed, the lever can run taller than the track without
// giving the eye a competing shape to measure the un-levered side against.
// New-user discoverability is solved with a persistent caption under the active
// label ("Tap to start"/"Tap to resume") rather than a hover hint, since this is
// an iPad-first app and iPadOS Safari doesn't reliably fire :hover at all. The
// caption is always mounted on both sides, but collapsed to zero height via
// `grid-template-rows` when inactive (see `renderSide`) rather than being
// removed from the DOM — that's what lets it animate open/shut instead of
// popping, and it's also why each side's own content — icon+label alone at
// rest, icon+label+caption once expanded — can still center independently via
// `justify-center` inside a fixed-height track (`h-11`) without the two sides
// ever needing to share a baseline. That means the icon+label sits a touch
// higher on the active side than the inactive one (it's making room for the
// caption below it), and the track's fixed height is what stops the card from
// jerking as that caption row grows and shrinks. The press itself gets a
// satisfying squash: the buttons are named peers (`peer/production`,
// `peer/recognition`) and the lever — the *last* child, so z-index alone (not
// DOM order) keeps it visually behind the button labels — scales down on
// `peer-active`, the same peer-driven wiring DualRangeSlider uses for its halo,
// reused here for a push instead of a fade-in.
//
// Dragging the lever switches modes too, layered on top of the click handling
// rather than replacing it: pointerdown/move/up are on the *track* (not the
// lever, which stays `pointer-events-none`), so the same handlers cover
// dragging from anywhere in the switch, not just a precise grab on the lever
// itself. A drag only "counts" past a small pixel threshold — short of that
// it's still a tap, and the browser's own synthetic click after pointerup
// handles it via the existing `handleClick` path.
//
// Two separate things move during a drag, deliberately decoupled: WHERE the
// lever is drawn (`dragFrac`, a continuous 0–1 fraction that just follows the
// raw pointer position for as long as the gesture lasts, transition disabled
// so it never lags a frame behind the finger) versus WHICH mode is selected
// (`activeMode`, untouched until release). That second part is deliberately
// *not* a live "flips the instant you cross the midpoint" commit — while
// `dragFrac` is non-null the switch abstains, rendering neither side as
// active (see `isAbstaining` below), because committing mid-drag made the
// caption/color pop between two answers while the gesture was still visibly
// undecided. Only on release do we resolve one answer from the final `frac`
// and call `onChangeMode` (if it actually changed), then clear `dragFrac`
// back to `null` — handing the lever back to the binary, `activeMode`-driven
// position, transition re-enabled, so it visibly *snaps* the rest of the way
// into place instead of teleporting. Because that `onChangeMode` call (if
// any) and the `dragFrac` reset both happen inside the same pointerup
// handler, React batches them into one re-render: the snap target and the
// resolved side's styling are always in sync, never a stale flash.
//
// One more wrinkle: the browser only fires a compatibility "click" after
// pointerup if release lands on the *same* element press started on (that's
// native behavior, not something this code opts into). So a drag that ends on
// a *different* button never generates a click at all — no launch risk there.
// But a drag that wanders out and back, releasing on the button it started
// on, looks identical to a plain tap to that click event, and would
// incorrectly launch/relaunch. `justDraggedRef` exists only to swallow that
// one specific trailing click whenever a real drag occurred.
//
// Deliberately NOT `setPointerCapture` + React's onPointerMove/Up props:
// capturing the pointer on the track retargets the browser's compatibility
// "click" event to the *track* instead of whichever button is under the
// finger, which silently breaks plain taps (confirmed live — a no-movement
// tap on the inactive side stopped switching modes entirely once capture was
// added). Plain `window` listeners added/removed per-gesture track the
// pointer just as reliably for a short horizontal drag, without touching how
// clicks get targeted at all — so taps keep going through the buttons' own
// onClick, untouched, and only a real drag (past the threshold) is handled
// here.
export function ModeSwitch({
  activeMode, onChangeMode, onLaunch, launchDisabled, resuming
}: {
  activeMode: 'production' | 'recognition',
  onChangeMode: (mode: 'production' | 'recognition') => void,
  onLaunch: () => void,
  launchDisabled: boolean,
  resuming: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);
  const justDraggedRef = useRef(false);
  // Holds the active gesture's own listener teardown, if any. Belt-and-braces
  // against a prior gesture whose pointerup/cancel never reached us (e.g. the
  // OS swallowing it) — without this, its listeners would linger and a new
  // drag would run alongside a stale one reading a stale `startX`.
  const cleanupRef = useRef<(() => void) | null>(null);
  // Once a drag has carried the lever more than this far from its starting
  // side, the label color stops tracking the pointer continuously and snaps
  // to (then holds at) the fully-neutral abstain gray for the rest of the
  // gesture — see `pastAbstainThresholdRef` below.
  const ABSTAIN_SNAP_FRACTION = 0.1;
  const DRAG_THRESHOLD_PX = 6;

  // null = not dragging, lever position follows `activeMode` as normal.
  // 0–1 while dragging = raw pointer fraction across the track, live —
  // updated on every pointermove from the very first pixel (no threshold),
  // so the lever's rendered position is always exactly where the finger is.
  const [dragFrac, setDragFrac] = useState<number | null>(null);
  // Mirrors `draggedRef.current`, i.e. "has this gesture moved past
  // DRAG_THRESHOLD_PX" — real state (not just the ref) because it's read
  // during render, to drive `isAbstaining`. Deliberately kept SEPARATE from
  // `dragFrac !== null`: position tracks the pointer unconditionally, but the
  // caption/abstain visuals should only kick in once a real drag (not a
  // sub-threshold jiggle) is underway — same threshold-gated timing as
  // before this was split out.
  const [isDragging, setIsDragging] = useState(false);
  // Sticky within a single gesture: flips true the first time the drag passes
  // ABSTAIN_SNAP_FRACTION away from its starting side, and never flips back
  // until the next pointerdown — so wandering back toward the start mid-drag
  // doesn't un-snap the color. Real state (not a ref) because it's read
  // during render (refs can't be — React flags that as unsafe, since a ref
  // mutation alone doesn't guarantee the component re-renders); the
  // gesture-local `crossedAbstainThreshold` flag below is what avoids
  // redundant `setState` calls once it's already latched true.
  const [pastAbstainThreshold, setPastAbstainThreshold] = useState(false);

  const handleClick = (mode: 'production' | 'recognition') => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    if (mode === activeMode) {
      if (!launchDisabled) onLaunch();
    } else {
      onChangeMode(mode);
    }
  };

  const handleTrackPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    cleanupRef.current?.();
    const startX = e.clientX;
    const startRect = trackRef.current?.getBoundingClientRect();
    draggedRef.current = false;
    // Self-heals a prior gesture whose drag-release never triggered a
    // consuming click, instead of leaving the guard stuck and swallowing
    // this next, unrelated tap.
    justDraggedRef.current = false;
    // The frac as of the most recent move — read at release to resolve which
    // side the drag actually lands on. Starts at the lever's current resting
    // spot so a release before any real movement (see `draggedRef` below)
    // never resolves anywhere else. Also doubles as the abstain-snap anchor
    // (`anchorFrac`, below) — the point the drag is measured "away from".
    let lastFrac = activeMode === 'production' ? 0 : 1;
    const anchorFrac = lastFrac;
    // Raw pointer fraction across the track at the moment of pointerdown —
    // NOT the same as anchorFrac, since a press can land anywhere within the
    // lever's half rather than exactly on its edge. onMove below tracks the
    // finger's MOVEMENT (delta from this) rather than its raw absolute
    // position — using the raw position directly made the lever's edge jump
    // to wherever the finger happened to be the instant a drag was recognized,
    // a one-time snap sized to however far off-edge the initial grab point
    // was, visible as an abrupt overshoot right as the drag began.
    const startFrac = startRect && startRect.width > 0 ? (startX - startRect.left) / startRect.width : anchorFrac;
    // Gesture-local latch mirroring `pastAbstainThreshold` state, so onMove
    // only calls setState once per gesture instead of on every move past the
    // snap point (a plain closure variable, same pattern as `lastFrac` — not
    // a ref, since nothing here needs to survive past this one gesture).
    let crossedAbstainThreshold = false;

    const onMove = (ev: globalThis.PointerEvent) => {
      // Position tracking is unconditional — no threshold — so the lever is
      // always exactly under the finger, with zero catch-up jump once a real
      // drag is later recognized below.
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const rawFrac = (ev.clientX - rect.left) / rect.width;
      lastFrac = Math.min(1, Math.max(0, anchorFrac + (rawFrac - startFrac)));
      setDragFrac(lastFrac);

      // Everything past this point is the "is this a real drag" bookkeeping —
      // still threshold-gated, independent of the position tracking above.
      if (!draggedRef.current) {
        if (Math.abs(ev.clientX - startX) < DRAG_THRESHOLD_PX) return;
        draggedRef.current = true;
        setIsDragging(true);
      }
      if (!crossedAbstainThreshold && Math.abs(lastFrac - anchorFrac) > ABSTAIN_SNAP_FRACTION) {
        crossedAbstainThreshold = true;
        setPastAbstainThreshold(true);
      }
    };
    const onUp = () => {
      if (draggedRef.current) {
        justDraggedRef.current = true;
        const finalMode = lastFrac < 0.5 ? 'production' : 'recognition';
        if (finalMode !== activeMode) onChangeMode(finalMode);
      }
      draggedRef.current = false;
      setIsDragging(false);
      setPastAbstainThreshold(false);
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

  const caption = launchDisabled ? 'No terms selected' : resuming ? 'Tap to resume' : 'Tap to start';

  // Past the drag threshold and short of a resolved release, the switch
  // abstains: neither side reads as active, so the *caption* doesn't pop to
  // an answer the gesture hasn't actually committed to yet. Keyed off
  // `isDragging` (threshold-gated), not `dragFrac !== null` (which now goes
  // non-null on the first pixel of any movement, threshold or not) — the
  // caption's timing is deliberately unchanged from before position tracking
  // became unconditional.
  const isAbstaining = isDragging;

  // Same two endpoints as the lever's own position (`0` = Production, `1` =
  // Recognition) — reused here so the label colors visibly track *where the
  // lever currently is*, not just whether a drag is happening. Computed above
  // `renderSide` since both the lever and the labels read it.
  const displayFrac = dragFrac ?? (activeMode === 'production' ? 0 : 1);

  const renderSide = (mode: 'production' | 'recognition', Icon: typeof PenLine, label: string) => {
    const isActive = !isAbstaining && activeMode === mode;
    // 1 when the lever is fully over this side, 0 when it's fully over the
    // other — continuous while dragging, otherwise just the binary isActive
    // value again (so resting states render pixel-identical to before).
    // Once the drag has passed ABSTAIN_SNAP_FRACTION away from its starting
    // side, this stops tracking the pointer and holds flat at 0 (fully
    // neutral gray, both sides) for the rest of the gesture — so the color
    // only ever eases through the first sliver of the drag, matching the
    // caption's already-binary abstain instead of visibly chasing the
    // pointer the whole way across the track.
    const rawCloseness = mode === 'production' ? 1 - displayFrac : displayFrac;
    const closeness = isAbstaining && pastAbstainThreshold ? 0 : rawCloseness;
    return (
      <button
        onClick={() => handleClick(mode)}
        disabled={isActive && launchDisabled}
        style={dragFrac !== null ? { color: lerpLabelColor(closeness) } : undefined}
        className={`peer/${mode} relative z-10 flex-1 min-w-0 shadow-md text-base font-medium flex flex-col items-center justify-center cursor-pointer disabled:cursor-not-allowed ${
          dragFrac === null ? 'transition-colors' : ''
        } ${
          mode === 'production' ? 'rounded-l-full rounded-r-xl' : 'rounded-r-full rounded-l-xl'
        } ${isActive ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}
      >
        <span className="flex items-center gap-1.5">
          <Icon size={18} strokeWidth={2} />
          {label}
        </span>
        {/* The caption row is always mounted, on both sides, and its height is
            driven by `grid-template-rows` (0fr collapsed / 1fr expanded) rather
            than by mounting/unmounting — a plain conditional render can't animate
            itself in, so the icon+label above would otherwise snap to its new
            position the instant the caption appears instead of easing into it.
            Two different speeds, not "animated vs not": collapsing INTO abstain
            (0/1 → abstain, at the start of a drag) uses a quick 100ms so it's
            well clear before a normal-speed drag reaches the other side — any
            slower and A's icon+label would still visibly be mid-recenter once
            the lever's already at B, which is what a flat, un-eased instant
            snap was originally trying (wrongly) to solve. Settling OUT of
            abstain (abstain → 0/1, on release) keeps the original, slower
            200ms — there's no lever to race there, so it can take its time. */}
        <div
          className={`grid w-full transition-[grid-template-rows,margin-top] ${dragFrac === null ? 'duration-200' : 'duration-100'} ease-out ${isActive ? 'grid-rows-[1fr] mt-0.5' : 'grid-rows-[0fr] mt-0'}`}
        >
          {/* No padding/margin of its own — the spacing above lives on the
              collapsing wrapper (as `mt-0.5`/`mt-0`) instead, since padding on this
              overflow-hidden element wouldn't shrink away with it: padding is
              part of the box itself, not clippable "overflow", so it would leave
              a permanent sliver even at `grid-rows-[0fr]`. */}
          <div className="overflow-hidden">
            <Prompt dim={launchDisabled} showChevron={!launchDisabled}>{caption}</Prompt>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={handleTrackPointerDown}
      className="relative flex h-11 bg-slate-200 px-0.5 rounded-full shadow-[inset_0_2px_6px_rgba(0,0,0,0.18)] w-full touch-none cursor-grab active:cursor-grabbing"
    >
      {renderSide('production', PenLine, 'Production')}
      {renderSide('recognition', Eye, 'Recognition')}
      <div
        className={`absolute rounded-xl bg-slate-800 shadow-md pointer-events-none ${
          dragFrac === null ? 'transition-all duration-200 ease-out' : ''
        } ${
          activeMode === 'production' ? 'peer-active/production:scale-95' : 'peer-active/recognition:scale-95'
        } ${launchDisabled ? 'opacity-70' : ''}`}
        style={{
          top: '-9px',
          bottom: '-9px',
          // Same two endpoints as before (`-1px` at frac 0, `50%` at frac 1)
          // expressed as one continuous formula so any frac in between — i.e.
          // the lever mid-drag — lands exactly where `displayFrac` implies.
          // Width doesn't interpolate: it's identical, `calc(50% + 1px)`, at
          // both ends, so only `left` ever moves.
          left: `calc(${displayFrac * 50}% + ${displayFrac - 1}px)`,
          width: 'calc(50% + 1px)'
        }}
      />
    </div>
  );
}
