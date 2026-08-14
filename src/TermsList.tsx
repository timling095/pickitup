import { useState, useMemo } from 'react';
import { ChevronLeft, Search, X } from 'lucide-react';
import type { Vocabulary, WordType } from './dictionary';
import { wordTypeOf, presentWordTypes, WORD_TYPE_LABELS } from './dictionary';
import type { FcRecord } from './Drills';
import { isMastered } from './Drills';
import { TextButton } from './Button';
import { Chip } from './Chip';
import { TermsTable } from './TermsTable';
import { MdCheckbox } from './MdCheckbox';
import { useLocalStorage } from './useLocalStorage';

const ALL_TYPES_SELECTED: Record<WordType, boolean> = { verb: true, na_adj: true, i_adj: true, noun: true, other: true };

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
  const [query, setQuery] = useState('');
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

  // Search here narrows *within* the current scope, not the whole dictionary — Global
  // Search (SearchSheet.tsx) is the counterpart for that. Both follow the same
  // searchbox-then-Word-Type-facet layout, just over different source lists.
  const searchedVocab = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vocabList;
    return vocabList.filter(v =>
      v.term.toLowerCase().includes(q) ||
      v.reading.toLowerCase().includes(q) ||
      v.definition.toLowerCase().includes(q) ||
      (v.dic_form?.toLowerCase().includes(q) ?? false) ||
      (v.dic_form_reading?.toLowerCase().includes(q) ?? false)
    );
  }, [vocabList, query]);

  // Word Type facet — all five chips stay put, same as SearchSheet's version; whichever
  // types have nothing behind them in the current search hits (or the full scope, with
  // an empty query) get disabled rather than removed. Selection resets to "everything
  // on" each time the query changes — a stale narrower selection from a previous query
  // may not even apply to the new one's types.
  const presentTypes = useMemo(() => presentWordTypes(searchedVocab), [searchedVocab]);
  const presentTypeSet = useMemo(() => new Set(presentTypes), [presentTypes]);
  const [selectedTypes, setSelectedTypes] = useState<Record<WordType, boolean>>(ALL_TYPES_SELECTED);
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setSelectedTypes(ALL_TYPES_SELECTED);
  }

  const displayedVocab = useMemo(() => {
    let result = searchedVocab.filter(v => selectedTypes[wordTypeOf(v)]);
    if (sortMode === 'practicing' && showPracticingTab) {
      result = result.filter(v => !isMastered(fcRecords[v.id]));
    } else if (sortMode === 'highlighted') {
      result = result.filter(v => !!markedTerms[v.id]);
    }
    return result;
  }, [searchedVocab, selectedTypes, sortMode, showPracticingTab, fcRecords, markedTerms]);

  const emptyMessage = query.trim() !== ''
    ? 'No terms match your search.'
    : sortMode === 'practicing'
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

        {/* Search, the Word Type facet, and tense selection all encapsulated together —
            same rounded-2xl card language as the results table below (not the Home
            screen's rounded-3xl Card), so this reads as one aligned block stacked above
            it rather than several unrelated pieces. The search pill reuses SearchSheet's
            own bg-slate-100 fill (not a bordered white box) so both search entry points
            — local and global — read as the same control. */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 h-11">
            <Search size={16} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search within your scope..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-300 text-white flex items-center justify-center cursor-pointer hover:bg-slate-400 transition-colors"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Word Type facet — always all five, same as SearchSheet's version. */}
          <div className="flex flex-wrap gap-2 mt-4">
            {(Object.keys(WORD_TYPE_LABELS) as WordType[]).map((t) => (
              <Chip
                key={t}
                selected={selectedTypes[t]}
                onClick={() => setSelectedTypes(prev => ({ ...prev, [t]: !prev[t] }))}
                disabled={!presentTypeSet.has(t)}
              >
                {WORD_TYPE_LABELS[t]}
              </Chip>
            ))}
          </div>

          {/* Phone-only: iPad-width screens show both forms as their own columns in the
              table below, so there's nothing to toggle there. Hidden whenever a session
              is active/paused — no changing forms mid-drill. */}
          {!sessionActive && (
            <div className="md:hidden mt-4 flex items-center justify-end gap-1">
              <span className="text-sm font-medium text-slate-600">辞書形</span>
              <MdCheckbox checked={showDicForm} onChange={() => setShowDicForm(v => !v)} />
            </div>
          )}
        </div>

        <div className="mb-12">
          <TermsTable
            vocab={displayedVocab}
            showDicForm={showDicForm}
            markedTerms={markedTerms}
            onToggleMark={onToggleMark}
            emptyMessage={emptyMessage}
          />
        </div>
      </div>
    </main>
  );
};
