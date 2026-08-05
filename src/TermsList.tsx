import { useState, useMemo } from 'react';
import { ChevronLeft, Search, ArrowUpDown } from 'lucide-react';
import type { Vocabulary } from './dictionary';
import { posLabel, posRank } from './dictionary';
import type { FcRecord } from './Drills';
import { AnnotatedTerm, isMastered } from './Drills';
import { TextButton } from './Button';
import { MdCheckbox } from './MdCheckbox';
import { useLocalStorage } from './useLocalStorage';

export const TermsList = ({
  vocabList,
  defaultUseDicForm,
  mode,
  sessionActive,
  fcRecords,
  markedTerms,
  onToggleMark,
  onBack
}: {
  vocabList: Vocabulary[],
  defaultUseDicForm: boolean,
  mode: 'production' | 'recognition',
  sessionActive: boolean,
  fcRecords: Record<string, FcRecord>,
  markedTerms: Record<string, boolean>,
  onToggleMark: (id: string) => void,
  onBack: () => void
}) => {
  const [sortMode, setSortMode] = useState<'all' | 'practicing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortByForm, setSortByForm] = useState(false);
  // Independent from the Home screen's own verb-form setting (which still
  // determines what gets drilled) — this is purely a Terms Viewer display
  // preference, persisted separately so it remembers the last choice made
  // here without ever feeding back into drill content. `vocabList` is always
  // the pre-verb-form-swap (ます形-based) array, so both forms are reliably
  // available here regardless of what the Home screen is currently set to.
  const [showDicForm, setShowDicForm] = useLocalStorage('nd_termsShowDicForm', defaultUseDicForm);

  // The Practicing tab reflects an in-progress Production session's mastery
  // data — outside of a session there's nothing "in progress" to filter down to,
  // so the tab (and its filtering) only appears while a session is actually active.
  const showTabs = mode === 'production' && sessionActive;

  const sortedVocab = useMemo(() => {
    let filtered = vocabList;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      // Also checks the dictionary-form fields — `vocabList` is always the
      // raw ます形-based array now (see `showDicForm` above), so a search
      // typed against whichever form is currently on screen still has to
      // match even when that's the 辞書形 spelling.
      filtered = filtered.filter(v =>
        v.term.toLowerCase().includes(q) ||
        v.reading.toLowerCase().includes(q) ||
        v.definition.toLowerCase().includes(q) ||
        (v.dic_form?.toLowerCase().includes(q) ?? false) ||
        (v.dic_form_reading?.toLowerCase().includes(q) ?? false)
      );
    }

    if (showTabs && sortMode === 'practicing') {
      filtered = filtered.filter(v => !isMastered(fcRecords[v.id]));
    }

    // A stable sort here preserves the existing (lesson/dataset) order within
    // each form, so toggling this off always returns exactly to that order —
    // it's a re-sort, not a shuffle, which is what makes it "unsortable" too.
    if (sortByForm) {
      return [...filtered].sort((a, b) => posRank(a) - posRank(b));
    }

    return filtered;
  }, [vocabList, showTabs, sortMode, fcRecords, searchQuery, sortByForm]);

  return (
    <main className="h-[100dvh] overflow-y-auto overscroll-y-contain bg-slate-50 p-6 md:p-12 font-sans text-slate-900 flex justify-center items-start">
      <div className="w-full max-w-4xl flex flex-col min-h-full">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TextButton onClick={onBack} align="start">
            <ChevronLeft size={18} strokeWidth={2} /> Back to Menu
          </TextButton>

          {showTabs && (
            <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
              <button
                onClick={() => setSortMode('all')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${sortMode === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                All
              </button>
              <button
                onClick={() => setSortMode('practicing')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${sortMode === 'practicing' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Practicing
              </button>
            </div>
          )}
        </div>

        {/* Phone-only: iPad-width screens show both forms as their own columns in the
            table below, so there's nothing to toggle there. Hidden whenever a session
            is active/paused — no changing forms mid-drill. */}
        {!sessionActive && (
          <div className="md:hidden mb-6 flex items-center justify-end gap-1">
            <span className="text-sm font-medium text-slate-600">辞書形</span>
            <MdCheckbox checked={showDicForm} onChange={() => setShowDicForm(v => !v)} />
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center px-4 py-3 mb-8 focus-within:border-slate-400 transition-colors">
          <Search size={18} className="text-slate-400 mr-3" />
          <input
            type="text"
            placeholder="Search by term, reading, or meaning..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-12">
          <div className="grid grid-cols-[1fr_1fr_6rem] md:grid-cols-[1fr_1fr_1fr_6rem] gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            <div>Term</div>
            <div>Meaning</div>
            <div className="hidden md:block">辞書形</div>
            <button
              onClick={() => setSortByForm(s => !s)}
              className={`flex items-center justify-end gap-1 transition-colors cursor-pointer ${sortByForm ? 'text-slate-600' : 'hover:text-slate-600'}`}
            >
              Form
              <ArrowUpDown size={10} className={sortByForm ? 'opacity-100' : 'opacity-40'} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {sortedVocab.map((vocab, i) => {
              const isMarked = !!markedTerms[vocab.id];
              // Only verbs with a recorded dictionary form have a second form to show —
              // everything else (non-verbs, or verbs missing the data) renders a single
              // line on every screen size.
              const dicForm = (vocab.dic_form !== undefined && vocab.dic_form_reading !== undefined && vocab.dic_form_pitch_accent !== undefined)
                ? { term: vocab.dic_form, reading: vocab.dic_form_reading, pitch_accent: vocab.dic_form_pitch_accent }
                : null;
              const phoneTerm = showDicForm && dicForm ? dicForm.term : vocab.term;
              const phoneReading = showDicForm && dicForm ? dicForm.reading : vocab.reading;
              const phonePitch = showDicForm && dicForm ? dicForm.pitch_accent : vocab.pitch_accent;

              return (
                <div
                  key={`${vocab.id}-${i}`}
                  onClick={() => onToggleMark(vocab.id)}
                  className={`grid grid-cols-[1fr_1fr_6rem] md:grid-cols-[1fr_1fr_1fr_6rem] items-center gap-4 px-4 py-3 transition-colors cursor-pointer ${isMarked ? 'bg-md-accent-light' : 'hover:bg-md-accent-light/50'}`}
                >
                  {/* Production form (furigana + pitch-accent overline) via AnnotatedTerm
                      replaces the old plain Term + separate Reading columns — the ruby
                      annotation already carries the reading. Phone: single line, picks
                      whichever form the checkbox selected. Desktop/iPad: ます形 and 辞書形
                      get their own columns (a stacked two-form single column read as four
                      cramped lines per verb) — the second column is simply empty for
                      terms with no recorded dictionary form. */}
                  <div className="min-w-0 text-2xl text-slate-800" title={vocab.term}>
                    <div className="md:hidden">
                      <AnnotatedTerm term={phoneTerm} reading={phoneReading} pitch={phonePitch} affixType={vocab.affix_type} compact />
                    </div>
                    <div className="hidden md:block">
                      <AnnotatedTerm term={vocab.term} reading={vocab.reading} pitch={vocab.pitch_accent} affixType={vocab.affix_type} compact />
                    </div>
                  </div>
                  {/* text-base: matches Term's actual *rendered* glyph size — AnnotatedTerm
                      scales its content down to 0.7em internally (0.7 × text-2xl ≈ 17px),
                      so the container class alone (text-2xl) isn't what to match against. */}
                  <div className="text-base text-slate-800 truncate" style={{ fontFamily: '"Noto Serif TC", serif' }} title={vocab.definition}>
                    {vocab.definition}
                  </div>
                  <div className="hidden md:block min-w-0 text-2xl text-slate-800">
                    {dicForm && (
                      <AnnotatedTerm term={dicForm.term} reading={dicForm.reading} pitch={dicForm.pitch_accent} affixType={vocab.affix_type} compact />
                    )}
                  </div>
                  <div className="text-xs text-slate-400 text-right truncate" title={posLabel(vocab)}>
                    {posLabel(vocab)}
                  </div>
                </div>
              );
            })}

            {sortedVocab.length === 0 && (
              <div className="p-12 text-center text-slate-400 font-medium">
                {searchQuery ? 'No terms match your search.' : 'No terms available in the selected lessons.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
