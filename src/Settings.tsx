import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ReactNode } from 'react';
import { SectionLabel, HelperText } from './Card';
import { MdCheckbox } from './MdCheckbox';

// Choice chip: same shape/coloring as Chip, but for a single-select group where exactly
// one option is always active — no checkmark, since "selected" here means "the current
// choice", not "added to a set". Only Verb Form uses this, so it stays local rather
// than joining Chip.tsx.
function ChoiceChip({ selected, onClick, disabled, children }: { selected: boolean, onClick: () => void, disabled?: boolean, children: ReactNode }) {
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

// Two overlapping range inputs drive value/drag logic only — their native thumbs are
// made a big, fully invisible 44px touch target (Material Design clickbox) and never
// drawn. The visible dot + focus/hover halo are separate plain <div>s, positioned with
// a plain `frac * 100%` + translateX(-50%). That sidesteps relying on any given
// browser's internal "keep the native thumb inside the track" inset math (which turned
// out to visibly differ enough, notably on iPadOS Safari, to throw a native-thumb-drawn
// dot off from the track's true ends) — a plain percentage + centering transform is
// identical in every browser, so the dot's *center* always lands exactly on the track's
// ends, never past them.
// Each native input's own box is still made 44px wider than the track (`left`/`right`
// of -22px) so *its* invisible hit-box center also lands on the same `frac * 100%`
// point as the decorative dot — otherwise the two drift apart everywhere except the
// midpoint, and the actual tap target stops matching what's drawn on screen.
// NOTE: Tailwind's class scanner reads this file's literal source text, so the 44px
// hit-box size must stay a hardcoded string — template interpolation would hide it from
// the scanner and silently produce no CSS.
const THUMB_HIT = 44;
const THUMB_HALF = THUMB_HIT / 2;

// iPadOS Safari draws a UA default box-shadow on ::-webkit-slider-thumb (used as its
// focus/active glow) that survives appearance-none + a transparent background — visible
// as a stray shadow under our decorative halo since the (invisible) native thumb sits
// exactly beneath it. shadow-none clears it explicitly; harmless everywhere else.
const nativeThumbClass =
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto " +
  "[&::-webkit-slider-thumb]:w-[44px] [&::-webkit-slider-thumb]:h-[44px] [&::-webkit-slider-thumb]:rounded-full " +
  "[&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto " +
  "[&::-moz-range-thumb]:w-[44px] [&::-moz-range-thumb]:h-[44px] [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent [&::-moz-range-thumb]:shadow-none [&::-moz-range-thumb]:cursor-pointer";

function DualRangeSlider({
  min, max, valueMin, valueMax, onChangeMin, onChangeMax, disabled = false
}: {
  min: number, max: number, valueMin: number, valueMax: number,
  onChangeMin: (val: number) => void, onChangeMax: (val: number) => void,
  disabled?: boolean
}) {
  const midpoint = (min + max) / 2;
  const fracMin = (valueMin - min) / (max - min);
  const fracMax = (valueMax - min) / (max - min);
  const minZ = valueMin > midpoint ? 5 : 3;
  const maxZ = 4;
  const inputStyleBase = { left: `-${THUMB_HALF}px`, right: `-${THUMB_HALF}px` };
  return (
    <div className={`relative w-[96%] mx-auto h-5 flex items-center ${disabled ? 'pointer-events-none' : ''}`}>
      <div className="absolute left-0 right-0 h-1 rounded-full bg-slate-200" />
      <div
        className="absolute h-1.5 rounded-full bg-slate-800"
        style={{
          left: `${fracMin * 100}%`,
          right: `${(1 - fracMax) * 100}%`
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={valueMin}
        disabled={disabled}
        onChange={(e) => onChangeMin(Math.min(Number(e.target.value), valueMax - 1))}
        className={`peer/min absolute h-full appearance-none bg-transparent pointer-events-none outline-none shadow-none ${nativeThumbClass}`}
        style={{ ...inputStyleBase, zIndex: minZ + 10 }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={valueMax}
        disabled={disabled}
        onChange={(e) => onChangeMax(Math.max(Number(e.target.value), valueMin + 1))}
        className={`peer/max absolute h-full appearance-none bg-transparent pointer-events-none outline-none shadow-none ${nativeThumbClass}`}
        style={{ ...inputStyleBase, zIndex: maxZ + 10 }}
      />
      <div
        className="absolute w-10 h-10 rounded-full bg-slate-800/[0.12] opacity-0 peer-hover/min:opacity-100 peer-focus/min:opacity-100 peer-active/min:opacity-100 transition-opacity duration-150 pointer-events-none"
        style={{ left: `${fracMin * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: minZ }}
      />
      <div
        className="absolute w-3 h-3 rounded-full bg-slate-800 pointer-events-none"
        style={{ left: `${fracMin * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: minZ }}
      />
      <div
        className="absolute w-10 h-10 rounded-full bg-slate-800/[0.12] opacity-0 peer-hover/max:opacity-100 peer-focus/max:opacity-100 peer-active/max:opacity-100 transition-opacity duration-150 pointer-events-none"
        style={{ left: `${fracMax * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: maxZ }}
      />
      <div
        className="absolute w-3 h-3 rounded-full bg-slate-800 pointer-events-none"
        style={{ left: `${fracMax * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: maxZ }}
      />
    </div>
  );
}

// Material Design 2 bottom sheet — same shell as SearchSheet.tsx (scrim, rounded-t-3xl
// surface, drag handle, swipe-to-dismiss), sized to its own (short, fixed) content
// rather than forced to 100dvh: unlike Search there's no keyboard to make room for and
// no scrolling result list, so a full-height sheet would just be mostly empty space.
// `max-h-[calc(100dvh-16px)]` is a safety cap, not the normal size — the same 16px
// top-inset both sheets share, so neither ever touches the very top of the screen.
// No Card wrapper around the sections below — the sheet itself is already the surface,
// same reasoning as SearchSheet's `card={false}` on TermsTable.
export function Settings({
  open, onClose,
  useDicForm, onSetUseDicForm, sessionActive,
  fcMinWorking, fcMaxWorking, onChangeFcMinWorking, onChangeFcMaxWorking,
  strictPitch, onToggleStrictPitch
}: {
  open: boolean,
  onClose: () => void,
  useDicForm: boolean,
  onSetUseDicForm: (useDicForm: boolean) => void,
  // Verb Form changes what a paused Production session's vocab reads live, so it stays
  // locked for the lifetime of that session rather than letting it drift from what's
  // actually being drilled.
  sessionActive: boolean,
  fcMinWorking: number,
  fcMaxWorking: number,
  onChangeFcMinWorking: (val: number) => void,
  onChangeFcMaxWorking: (val: number) => void,
  strictPitch: boolean,
  onToggleStrictPitch: () => void
}) {
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
      <div
        className={`fixed inset-0 bg-slate-900/40 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[calc(100dvh-16px)] ${
          isDraggingSheet ? '' : 'transition-transform duration-250 ease-out'
        } ${open ? '' : 'translate-y-full'}`}
        style={{ transform: open && dragY > 0 ? `translateY(${dragY}px)` : undefined }}
      >
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          onPointerDown={handleHandlePointerDown}
        >
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 pb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Settings</h2>
        </div>

        {/* No dividers between sections — three short, self-contained controls read
            fine as a plain stack, and a rule between each just added visual weight
            three settings don't need. `gap-4` (not per-section margin) is what spaces
            them. */}
        <div className="px-5 pb-10 overflow-y-auto overscroll-contain flex flex-col gap-4">
          <div>
            <SectionLabel>Verb Form</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <ChoiceChip selected={!useDicForm} onClick={() => onSetUseDicForm(false)} disabled={sessionActive}>
                ます形
              </ChoiceChip>
              <ChoiceChip selected={useDicForm} onClick={() => onSetUseDicForm(true)} disabled={sessionActive}>
                辞書形
              </ChoiceChip>
            </div>
          </div>

          <div>
            <SectionLabel tight>Working Terms Range</SectionLabel>
            <HelperText className="mb-3">
              {sessionActive ? 'Locked while a session is in progress' : 'How many terms stay active in the rotation at once'}
            </HelperText>
            <div className={`flex items-center gap-3 ${sessionActive ? 'opacity-50' : ''}`}>
              <div className="flex-shrink-0 min-w-[2.5rem] text-center bg-slate-100 rounded-lg py-1.5 text-xs font-normal text-slate-800 tabular-nums">
                {fcMinWorking}
              </div>
              <div className="flex-1">
                <DualRangeSlider
                  min={1}
                  max={30}
                  valueMin={fcMinWorking}
                  valueMax={fcMaxWorking}
                  onChangeMin={onChangeFcMinWorking}
                  onChangeMax={onChangeFcMaxWorking}
                  disabled={sessionActive}
                />
              </div>
              <div className="flex-shrink-0 min-w-[2.5rem] text-center bg-slate-100 rounded-lg py-1.5 text-xs font-normal text-slate-800 tabular-nums">
                {fcMaxWorking}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionLabel tight>Strict Pitch Accent</SectionLabel>
              <HelperText>Require pitch selection before next question</HelperText>
            </div>
            <MdCheckbox checked={strictPitch} onChange={onToggleStrictPitch} />
          </div>
        </div>
      </div>
    </>
  );
}
