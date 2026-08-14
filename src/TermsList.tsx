import { useState, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { Vocabulary } from './dictionary';
import { posRank } from './dictionary';
import type { FcRecord } from './Drills';
import { isMastered } from './Drills';
import { TextButton } from './Button';
import { TermsTable } from './TermsTable';
import { MdCheckbox } from './MdCheckbox';
import { useLocalStorage } from './useLocalStorage';

type SortMode = 'all' | 'practicing' | 'highlighted';

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
  const [sortMode, setSortMode] = useState<SortMode>('all');
  const [sortByForm, setSortByForm] = useState(false);
  // Independent from the Home screen's own verb-form setting (which still
  // determines what gets drilled) — this is purely a Terms Viewer display
  // preference, persisted separately so it remembers the last choice made
  // here without ever feeding back into drill content. `vocabList` is always
  // the pre-verb-form-swap (ます形-based) array, so both forms are reliably
  // available here regardless of what the Home screen is currently set to.
  // Default is dic form (true) — the Terms Viewer is reference-first, so
  // showing the dictionary form on first open is more useful than ます形.
  const [showDicForm, setShowDicForm] = useLocalStorage('nd_termsShowDicForm', defaultUseDicForm);

  // Practicing reflects an in-progress Production session's mastery data — outside of
  // a session there's nothing "in progress" to narrow down to, so that tab (and mode)
  // only exists while a session is actually active. Highlighted has no such
  // restriction — marking a term works in either mode, session or not — so it's
  // always available alongside All.
  const showPracticingTab = mode === 'production' && sessionActive;

  const displayedVocab = useMemo(() => {
    let result = vocabList;
    if (sortMode === 'practicing' && showPracticingTab) {
      result = result.filter(v => !isMastered(fcRecords[v.id]));
    } else if (sortMode === 'highlighted') {
      result = result.filter(v => !!markedTerms[v.id]);
    }
    // A stable sort here preserves the existing (lesson/dataset) order within
    // each form, so toggling this off always returns exactly to that order —
    // it's a re-sort, not a shuffle, which is what makes it "unsortable" too.
    if (sortByForm) {
      return [...result].sort((a, b) => posRank(a) - posRank(b));
    }
    return result;
  }, [vocabList, sortMode, showPracticingTab, fcRecords, markedTerms, sortByForm]);

  const emptyMessage = sortMode === 'practicing'
    ? 'Nothing left to practice — everything in scope is mastered.'
    : sortMode === 'highlighted'
    ? 'No highlighted terms in the selected lessons.'
    : 'No terms available in the selected lessons.';

  return (
    <main className="h-[100dvh] overflow-y-auto overscroll-y-contain bg-slate-50 p-6 md:p-12 font-sans text-slate-900 flex justify-center items-start">
      <div className="w-full max-w-4xl flex flex-col min-h-full">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TextButton onClick={onBack} align="start">
            <ChevronLeft size={18} strokeWidth={2} /> Back to Menu
          </TextButton>

          <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
            <button
              onClick={() => setSortMode('all')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${sortMode === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              All
            </button>
            {showPracticingTab && (
              <button
                onClick={() => setSortMode('practicing')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${sortMode === 'practicing' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Practicing
              </button>
            )}
            <button
              onClick={() => setSortMode('highlighted')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${sortMode === 'highlighted' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Highlighted
            </button>
          </div>
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

        <div className="mb-12">
          <TermsTable
            vocab={displayedVocab}
            showDicForm={showDicForm}
            sortByForm={sortByForm}
            onToggleSortByForm={() => setSortByForm(s => !s)}
            markedTerms={markedTerms}
            onToggleMark={onToggleMark}
            emptyMessage={emptyMessage}
          />
        </div>
      </div>
    </main>
  );
};
