import type { PointerEvent, ReactNode } from 'react';

// The one shared shape for every non-specialized *filled* button in the app —
// same height, shadow, and radius everywhere, only the color varies by
// intent. `outline`/`correct`/`incorrect` cover the Recognition drill's
// answer options (selection/feedback state expressed as a variant, same as
// every other button, rather than a bespoke class string) — kept separate
// from `success-outline`/`danger-outline` (the Production drill's grading
// buttons) since those intentionally use a lighter, more inviting resting
// look that a stronger drill-feedback color would clash with. Chip/ChoiceChip
// stay bespoke in App.tsx since their styling is a selection pill, not an action.
type ButtonVariant = 'primary' | 'danger-outline' | 'success-outline' | 'outline' | 'correct' | 'incorrect';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-slate-800 text-white hover:bg-slate-700',
  'danger-outline': 'bg-white border-2 border-red-100 text-red-600 hover:bg-red-50',
  'success-outline': 'bg-white border-2 border-green-100 text-green-600 hover:bg-green-50',
  outline: 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400 hover:shadow-sm',
  correct: 'bg-green-50 border-2 border-green-500 text-green-700 shadow-sm',
  incorrect: 'bg-red-50 border-2 border-red-500 text-red-700',
};

export function Button({
  onClick, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave,
  disabled, variant = 'primary', fullWidth = false, autoHeight = false, pressed, children, className = ''
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
      className={`${autoHeight ? 'py-3 min-h-11' : 'h-11'} ${fullWidth ? 'w-full' : 'px-4'} rounded-xl font-medium tracking-wide transition shadow-md cursor-pointer ${pressClass} disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm select-none ${VARIANT_CLASSES[variant]} ${className}`}
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
