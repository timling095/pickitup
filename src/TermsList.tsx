import { useState, useMemo } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import type { Vocabulary } from './dictionary';
import type { FcRecord } from './Drills';
import { AnnotatedReading, AffixWrapper, isMastered } from './Drills';

export const TermsList = ({
  vocabList,
  mode,
  fcRecords,
  markedTerms,
  onToggleMark,
  onBack
}: {
  vocabList: Vocabulary[],
  mode: 'production' | 'recognition',
  fcRecords: Record<string, FcRecord>,
  markedTerms: Record<string, boolean>,
  onToggleMark: (id: string) => void,
  onBack: () => void
}) => {
  const [sortMode, setSortMode] = useState<'all' | 'practicing'>('practicing');
  const [searchQuery, setSearchQuery] = useState('');

  const showTabs = mode === 'production';

  const sortedVocab = useMemo(() => {
    let filtered = vocabList;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.term.toLowerCase().includes(q) ||
        v.reading.toLowerCase().includes(q) ||
        v.definition.toLowerCase().includes(q)
      );
    }

    if (showTabs && sortMode === 'practicing') {
      return filtered.filter(v => !isMastered(fcRecords[v.id]));
    }

    return filtered;
  }, [vocabList, showTabs, sortMode, fcRecords, searchQuery]);

  return (
    <main className="h-[100dvh] overflow-y-auto bg-slate-50 p-6 md:p-12 font-sans text-slate-900 flex justify-center items-start">
      <div className="w-full max-w-4xl flex flex-col min-h-full">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors flex items-center font-medium w-fit">
            <ChevronLeft size={20} className="mr-1" /> Back to Menu
          </button>

          {showTabs && (
            <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
              <button
                onClick={() => setSortMode('all')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortMode === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                All
              </button>
              <button
                onClick={() => setSortMode('practicing')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortMode === 'practicing' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Practicing
              </button>
            </div>
          )}
        </div>

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
          <div className="grid grid-cols-3 gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            <div>Term</div>
            <div>Reading</div>
            <div>Meaning</div>
          </div>
          <div className="divide-y divide-slate-100">
            {sortedVocab.map((vocab, i) => {
              const isMarked = !!markedTerms[vocab.id];

              return (
                <div
                  key={`${vocab.id}-${i}`}
                  onClick={() => onToggleMark(vocab.id)}
                  className="grid grid-cols-3 items-center gap-4 px-4 py-2 transition-colors cursor-pointer hover:bg-slate-50"
                  style={{ backgroundColor: isMarked ? '#FCE4EC' : undefined }}
                >
                  <div className="text-base text-slate-800 flex items-center truncate" title={vocab.term}>
                    <AffixWrapper term={vocab.term} affixType={vocab.affix_type} mode="inline" />
                  </div>
                  <div className="text-sm text-slate-800 truncate">
                    <AnnotatedReading reading={vocab.reading} pitch={vocab.pitch_accent} affixType={vocab.affix_type} />
                  </div>
                  <div className="text-sm text-slate-800 truncate" style={{ fontFamily: '"Noto Serif TC", serif' }} title={vocab.definition}>
                    {vocab.definition}
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
