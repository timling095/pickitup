import type { PointerEvent, ReactNode } from 'react';

// The one shared shape for every non-specialized *filled* button in the app —
// same height, shadow, and radius everywhere, only the color varies by
// intent. "Specialized" controls (Chip/ChoiceChip's selection pills, the
// drill's per-option answer/pitch buttons whose coloring IS the feedback)
// stay bespoke since their styling carries state, not just an action's
// category.
type ButtonVariant = 'primary' | 'danger-outline' | 'success-outline';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-slate-800 text-white hover:bg-slate-700',
  'danger-outline': 'bg-white border-2 border-red-100 text-red-600 hover:bg-red-50',
  'success-outline': 'bg-white border-2 border-green-100 text-green-600 hover:bg-green-50',
};

export function Button({
  onClick, onPointerDown, disabled, variant = 'primary', fullWidth = false, children, className = ''
}: {
  onClick?: () => void,
  onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void,
  disabled?: boolean,
  variant?: ButtonVariant,
  fullWidth?: boolean,
  children: ReactNode,
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled}
      className={`h-11 ${fullWidth ? 'w-full' : 'px-4'} rounded-xl font-medium tracking-wide transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 text-sm select-none ${VARIANT_CLASSES[variant]} ${className}`}
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

export function TextButton({
  onClick, disabled, variant = 'neutral', children, className = ''
}: {
  onClick?: () => void,
  disabled?: boolean,
  variant?: TextButtonVariant,
  children: ReactNode,
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-11 px-4 rounded-xl font-medium tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 text-sm select-none ${TEXT_VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
