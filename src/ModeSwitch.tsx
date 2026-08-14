import { PenLine, Eye } from 'lucide-react';
import { Button } from './Button';

// Two independent, always-black action buttons — not a toggle. Each tap starts (or, for
// Production, resumes) that mode directly; there's no separate "select a mode, then tap
// again to launch" step anymore, so there's also no fill-vs-outline "currently selected"
// state to show. Both reuse the shared Button component at its standard size, the same
// one every other filled button in the app uses — these used to run larger (text-base)
// because their labels doubled as this card's title; now that they're just buttons,
// they get the same font size and padding as everything else.
//
// Production's own label swaps to "Resume" (same PenLine icon) while a session is
// paused — that's the only state either button ever shows, replacing the old caption
// row entirely. Recognition has no equivalent paused state, so its label never changes.
export function ModeSwitch({
  onLaunch, productionDisabled, recognitionDisabled, resuming
}: {
  onLaunch: (mode: 'production' | 'recognition') => void,
  productionDisabled: boolean,
  recognitionDisabled: boolean,
  resuming: boolean
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <Button variant="primary" fullWidth onClick={() => onLaunch('production')} disabled={productionDisabled}>
          <PenLine size={18} strokeWidth={2} />
          {resuming ? 'Resume' : 'Production'}
        </Button>
      </div>
      <div className="flex-1">
        <Button variant="primary" fullWidth onClick={() => onLaunch('recognition')} disabled={recognitionDisabled}>
          <Eye size={18} strokeWidth={2} />
          Recognition
        </Button>
      </div>
    </div>
  );
}
