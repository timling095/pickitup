import type { PointerEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

// The one shared shape for every non-specialized *filled* button in the app —
// same height, shadow, and radius everywhere, only the color varies by
// intent. `outline`/`correct`/`incorrect` cover the Recognition drill's
// answer options (selection/feedback state expressed as a variant, same as
// every other button, rather than a bespoke class string). The Production
// drill's grading buttons (Correct/Incorrect) use plain `primary` (black) —
// they used to have their own solid green/red variants, but those were
// removed once both buttons were unified to black; Chip/ChoiceChip stay
// bespoke in App.tsx since their styling is a selection pill, not an action.
type ButtonVariant = 'primary' | 'outline' | 'correct' | 'incorrect';

// Hover is split out from the resting color so `hoverable={false}` (see
// PenButton in Drills.tsx) can drop just the `hover:` classes — a
// hover-capable Apple Pencil fires genuine CSS `:hover` while merely
// hovering over the screen (unlike a finger, which never triggers `:hover`
// on iOS at all), so without this split, pen-gated buttons would be the only
// ones in the app that visibly react to a pointer that hasn't actually
// pressed yet.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-slate-800 text-white',
  outline: 'bg-white border border-slate-200 text-slate-700',
  correct: 'bg-green-600 text-white',
  incorrect: 'bg-red-600 text-white',
};

const VARIANT_HOVER_CLASSES: Record<ButtonVariant, string> = {
  primary: 'hover:bg-slate-700',
  outline: 'hover:border-slate-400 hover:shadow-sm',
  correct: '',
  incorrect: '',
};

export function Button({
  onClick, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave,
  disabled, variant = 'primary', fullWidth = false, autoHeight = false, pressed, hoverable = true, dimOnDisabled = true, children, className = ''
}: {
  onClick?: () => void,
  onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void,
  onPointerUp?: (e: PointerEvent<HTMLButtonElement>) => void,
  onPointerCancel?: (e: PointerEvent<HTMLButtonElement>) => void,
  onPointerLeave?: (e: PointerEvent<HTMLButtonElement>) => void,
  disabled?: boolean,
  variant?: ButtonVariant,
  fullWidth?: boolean,
  // Swaps the fixed `h-11` for `py-3 min-h-11` — for variable-content buttons
  // (e.g. drill answer options with multi-line definitions) that need to grow
  // instead of clipping.
  autoHeight?: boolean,
  // When provided, the press-scale animation is driven by this boolean instead of the
  // CSS `:active` pseudo-class — for palm-rejection-gated buttons (see PenButton in
  // Drills.tsx) where `:active` would otherwise visibly react to ANY pointer type,
  // including a touch/palm contact whose click is being deliberately ignored.
  pressed?: boolean,
  // See `VARIANT_HOVER_CLASSES` above — false drops the variant's `hover:` classes
  // entirely (PenButton always passes false).
  hoverable?: boolean,
  // False drops the disabled-dimming below — for a `disabled` window that's a brief,
  // deliberate grace period (PenButton's 400ms mis-tap guard) rather than a real "can't
  // do this right now" state; the button should look identical to its ready state the
  // whole time, since the only difference is that it doesn't register yet.
  dimOnDisabled?: boolean,
  children: ReactNode,
  className?: string
}) {
  const pressClass = pressed === undefined ? 'active:scale-95' : (pressed ? 'scale-95' : '');
  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      disabled={disabled}
      // disabled:opacity-70, not the more conventional -50: at 50% a solid, dark/
      // saturated fill (e.g. Proceed's slate-800) blends with the page's near-white
      // background into a flat, washed-out gray that reads as a blank/unstyled flash
      // rather than "this button, dimmed" — most visible on buttons like Proceed that
      // mount already disabled (PenButton's canProceed grace window) and so render
      // that faded state on their very first paint, not eased into it from a normal
      // color. 70% keeps enough of the true fill visible to still read as the same
      // button, just muted.
      className={`${autoHeight ? 'py-3 min-h-11' : 'h-11'} ${fullWidth ? 'w-full' : 'px-4'} rounded-xl font-medium tracking-wide transition shadow-md cursor-pointer ${pressClass} disabled:cursor-not-allowed ${dimOnDisabled ? 'disabled:opacity-70' : ''} inline-flex items-center justify-center gap-2 text-sm select-none ${VARIANT_CLASSES[variant]} ${hoverable ? VARIANT_HOVER_CLASSES[variant] : ''} ${className}`}
    >
      {children}
    </button>
  );
}

// Material Design 2 "text button": no fill, no outline — the label's own
// accent color is the only cue at rest. A state layer (the same translucent-
// overlay trick as MdCheckbox's/DualRangeSlider's hover halos) fades in on
// hover and deepens on press, so the *box* only reveals itself on
// interaction; the clickable area is sized exactly like Button's (`h-11`,
// `rounded-xl`) so hover/focus/tap targets stay consistent across every
// button in the app, filled or not.
type TextButtonVariant = 'neutral' | 'pink';

const TEXT_VARIANT_CLASSES: Record<TextButtonVariant, string> = {
  neutral: 'text-slate-800 hover:bg-slate-800/[0.08] active:bg-slate-800/[0.16]',
  pink: 'text-md-accent hover:bg-md-accent/[0.08] active:bg-md-accent/[0.16]',
};

// Where the invisible px-4 clickbox sits relative to the visible label: 'start'/'end'
// pull it halfway back towards the label's un-padded position — literally half of the
// px-4 clickbox padding, not the full amount — landing deliberately between "text-
// aligned" (as if the clickbox didn't exist) and "clickbox-aligned" (today's px-4).
type TextButtonAlign = 'start' | 'end' | 'center';

const ALIGN_CLASSES: Record<TextButtonAlign, string> = {
  start: '-ml-2',
  end: '-mr-2',
  center: '',
};

export function TextButton({
  onClick, disabled, variant = 'neutral', align = 'center', children, className = ''
}: {
  onClick?: () => void,
  disabled?: boolean,
  variant?: TextButtonVariant,
  align?: TextButtonAlign,
  children: ReactNode,
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-11 px-4 rounded-xl font-medium tracking-wide transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm select-none ${TEXT_VARIANT_CLASSES[variant]} ${ALIGN_CLASSES[align]} ${className}`}
    >
      {children}
    </button>
  );
}

// The small caption *inside* a title button (e.g. "View Terms ›", "Tap to start ›") —
// shared between the Glossary card's title button (App.tsx) and each side of the Lever
// (ModeSwitch.tsx), the two places this "actionable title" pattern shows up. `dim` is
// the Lever's disabled ("No terms selected") state; `showChevron` hides the chevron
// alongside it, since there's nothing to navigate to. Purely presentational — a
// caller that needs the caption to collapse/expand (the Lever's grid-rows trick) wraps
// this in its own animation plumbing rather than that logic living here.
export function Prompt({
  dim = false, showChevron = true, className = '', children
}: {
  dim?: boolean,
  showChevron?: boolean,
  className?: string,
  children: ReactNode
}) {
  return (
    <span className={`flex items-center justify-center gap-0.5 text-[10px] font-normal ${dim ? 'text-white/40' : 'text-white/60'} ${className}`}>
      {children}
      {showChevron && <ChevronRight size={9} strokeWidth={2} />}
    </span>
  );
}
