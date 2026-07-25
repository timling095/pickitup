import { useState, useMemo } from 'react';
import { ChevronLeft, Search, X } from 'lucide-react';
import type { Vocabulary } from './dictionary';
import { AnnotatedReading, AffixWrapper } from './Drills';

export const TermsList = ({
  vocabList,
  stats,
  skippedTerms,
  onSkip,
  onUnskip,
  markedTerms,
  onToggleMark,
  onBack
}: {
  vocabList: Vocabulary[],
  stats: Record<string, { attempts: number, correct: number }>,
  skippedTerms: Record<string, boolean>,
  onSkip: (id: string) => void,
  onUnskip: (id: string) => void,
  markedTerms: Record<string, boolean>,
  onToggleMark: (id: string) => void,
  onBack: () => void
}) => {
  const [sortMode, setSortMode] = useState<'default' | 'skipped'>('default');
  const [searchQuery, setSearchQuery] = useState('');

  const sortedVocab = useMemo(() => {
    let filtered = vocabList;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.term.toLowerCase().includes(q) ||
        v.reading.toLowerCase().includes(q) ||
        v.definition.toLowerCase().includes(q) ||
        v.romaji.toLowerCase().includes(q)
      );
    }

    if (sortMode === 'skipped') {
      return filtered.filter(v => skippedTerms[v.id]);
    }

    return filtered.filter(v => !skippedTerms[v.id]);
  }, [vocabList, sortMode, skippedTerms, searchQuery]);

  return (
    <main className="h-[100dvh] overflow-y-auto bg-slate-50 p-6 md:p-12 font-sans text-slate-900 flex justify-center items-start">
      <div className="w-full max-w-4xl flex flex-col min-h-full">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors flex items-center font-medium w-fit">
            <ChevronLeft size={20} className="mr-1" /> Back to Menu
          </button>
          
          <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
            <button 
              onClick={() => setSortMode('default')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortMode === 'default' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Default Order
            </button>
            <button
              onClick={() => setSortMode('skipped')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortMode === 'skipped' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Skipped
            </button>
          </div>
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
          <div className="grid grid-cols-[160px_180px_1fr_64px_60px_40px] gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            <div>Term</div>
            <div>Reading</div>
            <div>Meaning</div>
            <div className="text-right">Error</div>
            <div className="text-center">Marked</div>
            <div></div>
          </div>
          <div className="divide-y divide-slate-100">
            {sortedVocab.map((vocab, i) => {
              const stat = stats[vocab.id] || { attempts: 0, correct: 0 };
              const errRate = ((stat.attempts - stat.correct) + 1) / (stat.attempts + 2);
              const errPercent = Math.round(errRate * 100);
              const isMarked = !!markedTerms[vocab.id];
              const isSkipped = !!skippedTerms[vocab.id];

              return (
                <div
                  key={`${vocab.id}-${i}`}
                  className="grid grid-cols-[160px_180px_1fr_64px_60px_40px] items-center gap-4 px-4 py-2 transition-colors"
                  style={{ backgroundColor: isMarked ? '#F8BBD0' : undefined }}
                >
                  <div className="text-base text-slate-800 flex items-center truncate" title={vocab.term}>
                    <AffixWrapper term={vocab.term} affixType={vocab.affix_type} mode="inline" />
                  </div>
                  <div className="text-sm text-slate-500 truncate">
                    <AnnotatedReading reading={vocab.reading} pitch={vocab.pitch_accent} affixType={vocab.affix_type} />
                  </div>
                  <div className="text-sm text-slate-600 truncate" style={{ fontFamily: '"Noto Serif TC", serif' }} title={vocab.definition}>
                    {vocab.definition}
                  </div>
                  <div className={`text-sm text-right font-medium ${errPercent > 50 ? '' : 'text-slate-400'}`} style={errPercent > 50 ? { color: '#E91E63' } : undefined}>
                    {errPercent}%
                  </div>
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={isMarked}
                      onChange={() => onToggleMark(vocab.id)}
                      className="w-4 h-4 accent-pink-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => (isSkipped ? onUnskip(vocab.id) : onSkip(vocab.id))}
                      title={isSkipped ? 'Unskip' : 'Skip'}
                      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${isSkipped ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                    >
                      <X size={14} />
                    </button>
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
