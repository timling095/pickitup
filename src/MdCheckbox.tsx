import { Check } from 'lucide-react';

// Checkbox: an 18px square, 2px border, filled black + white check when checked. The
// <button> IS the full 40px halo/hit-area (not just the 18px visual box), so clicking
// anywhere in the halo registers — the 18px box is a plain inner <div> (can't nest a
// <button> inside a <button>). `role="checkbox"`/`aria-checked` since this is a simple
// boolean settings toggle, not part of a <form>. The halo reuses DualRangeSlider's
// thumb technique (a Material "state layer"): group-hover/group-focus/group-active
// fade it in — `group-focus` (not `-within`) since the button itself, not a descendant,
// is what receives focus here.
export function MdCheckbox({ checked, onChange }: { checked: boolean, onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="checkbox"
      aria-checked={checked}
      className="group relative w-10 h-10 -mr-[11px] flex items-center justify-center flex-shrink-0 cursor-pointer"
    >
      <div className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-slate-800/[0.12] opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-active:opacity-100 transition-opacity duration-150 pointer-events-none" />
      <div
        className={`relative w-[18px] h-[18px] rounded-[2px] border-2 flex items-center justify-center transition-colors pointer-events-none ${
          checked ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-400 group-hover:border-slate-800'
        }`}
      >
        {checked && <Check size={13} strokeWidth={3.5} className="text-white" />}
      </div>
    </button>
  );
}
