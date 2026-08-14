import { ArrowUpDown } from 'lucide-react';
import type { Vocabulary } from './dictionary';
import { posLabel } from './dictionary';
import { AnnotatedTerm } from './Drills';

// The Term/Meaning/ます形/Form grid — shared between the Filter screen (TermsList.tsx,
// scoped to the current Lessons/Word Type selection) and Global Search (SearchSheet.tsx,
// spanning the whole dictionary). Both need the exact same column style, so this lives
// in its own file rather than being duplicated or living inside just one of them.
//
// The dictionary form (辞書形) is the default/primary form now, not ます形 — verbs with
// a recorded dic_form show it in the Term column itself; the secondary column shows
// ます形 instead, and stays empty for anything without a distinct dictionary form
// (non-verbs, or verbs missing the data), same as the secondary column always has.
export function TermsTable({
  vocab, showDicForm, sortByForm, onToggleSortByForm, markedTerms, onToggleMark, emptyMessage
}: {
  vocab: Vocabulary[],
  showDicForm: boolean,
  sortByForm: boolean,
  onToggleSortByForm: () => void,
  markedTerms: Record<string, boolean>,
  onToggleMark: (id: string) => void,
  emptyMessage: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_6rem] md:grid-cols-[1fr_1fr_1fr_6rem] gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
        <div>Term</div>
        <div>Meaning</div>
        <div className="hidden md:block">ます形</div>
        <button
          onClick={onToggleSortByForm}
          className={`flex items-center justify-end gap-1 transition-colors cursor-pointer ${sortByForm ? 'text-slate-600' : 'hover:text-slate-600'}`}
        >
          Form
          <ArrowUpDown size={10} className={sortByForm ? 'opacity-100' : 'opacity-40'} />
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {vocab.map((v, i) => {
          const isMarked = !!markedTerms[v.id];
          // Only verbs with a recorded dictionary form have a second form to show —
          // everything else (non-verbs, or verbs missing the data) renders a single
          // line on every screen size, and the secondary desktop column stays empty.
          const dicForm = (v.dic_form !== undefined && v.dic_form_reading !== undefined && v.dic_form_pitch_accent !== undefined)
            ? { term: v.dic_form, reading: v.dic_form_reading, pitch_accent: v.dic_form_pitch_accent }
            : null;
          // Desktop's primary Term column: dictionary form when there is one, same base
          // term as before otherwise (nothing to swap for non-verbs).
          const primaryTerm = dicForm ?? { term: v.term, reading: v.reading, pitch_accent: v.pitch_accent };
          const phoneTerm = showDicForm && dicForm ? dicForm.term : v.term;
          const phoneReading = showDicForm && dicForm ? dicForm.reading : v.reading;
          const phonePitch = showDicForm && dicForm ? dicForm.pitch_accent : v.pitch_accent;

          return (
            <div
              key={`${v.id}-${i}`}
              onClick={() => onToggleMark(v.id)}
              className={`grid grid-cols-[1fr_1fr_6rem] md:grid-cols-[1fr_1fr_1fr_6rem] items-center gap-4 px-4 py-3 transition-colors cursor-pointer ${isMarked ? 'bg-md-accent-light' : 'hover:bg-md-accent-light/50'}`}
            >
              {/* Production form (furigana + pitch-accent overline) via AnnotatedTerm
                  replaces the old plain Term + separate Reading columns — the ruby
                  annotation already carries the reading. Phone: single line, picks
                  whichever form the checkbox selected. Desktop/iPad: 辞書形 and ます形
                  get their own columns (a stacked two-form single column read as four
                  cramped lines per verb) — the second column is simply empty for
                  terms with no recorded dictionary form. */}
              <div className="min-w-0 text-2xl text-slate-800" title={v.term}>
                <div className="md:hidden">
                  <AnnotatedTerm term={phoneTerm} reading={phoneReading} pitch={phonePitch} affixType={v.affix_type} compact />
                </div>
                <div className="hidden md:block">
                  <AnnotatedTerm term={primaryTerm.term} reading={primaryTerm.reading} pitch={primaryTerm.pitch_accent} affixType={v.affix_type} compact />
                </div>
              </div>
              {/* text-base: matches Term's actual *rendered* glyph size — AnnotatedTerm
                  scales its content down to 0.7em internally (0.7 × text-2xl ≈ 17px),
                  so the container class alone (text-2xl) isn't what to match against. */}
              <div className="text-base text-slate-800 truncate" style={{ fontFamily: '"Noto Serif TC", serif' }} title={v.definition}>
                {v.definition}
              </div>
              <div className="hidden md:block min-w-0 text-2xl text-slate-800">
                {dicForm && (
                  <AnnotatedTerm term={v.term} reading={v.reading} pitch={v.pitch_accent} affixType={v.affix_type} compact />
                )}
              </div>
              <div className="text-xs text-slate-400 text-right truncate" title={posLabel(v)}>
                {posLabel(v)}
              </div>
            </div>
          );
        })}

        {vocab.length === 0 && (
          <div className="p-12 text-center text-slate-400 font-medium">{emptyMessage}</div>
        )}
      </div>
    </div>
  );
}
