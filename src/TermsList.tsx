import { useState, useMemo } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import type { Vocabulary } from './dictionary';
import { AnnotatedReading, AffixWrapper } from './Drills';

export const TermsList = ({ 
  vocabList, 
  stats, 
  skippedTerms,
  onSkip,
  onUnskip,
  onBack 
}: { 
  vocabList: Vocabulary[], 
  stats: Record<string, { attempts: number, correct: number }>,
  skippedTerms: Record<string, boolean>,
  onSkip: (id: string) => void,
  onUnskip: (id: string) => void,
  onBack: () => void 
}) => {
  const [sortMode, setSortMode] = useState<'default' | 'errors' | 'skipped'>('default');
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
    
    const unskipped = filtered.filter(v => !skippedTerms[v.id]);

    if (sortMode === 'default') {
      return [...unskipped];
    } else {
      return [...unskipped].sort((a, b) => {
        const statA = stats[a.id] || { attempts: 0, correct: 0 };
        const statB = stats[b.id] || { attempts: 0, correct: 0 };
        const errRateA = ((statA.attempts - statA.correct) + 1) / (statA.attempts + 2);
        const errRateB = ((statB.attempts - statB.correct) + 1) / (statB.attempts + 2);
        return errRateB - errRateA; // Descending error rate
      });
    }
  }, [vocabList, stats, sortMode, skippedTerms, searchQuery]);

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
              onClick={() => setSortMode('errors')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortMode === 'errors' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Most Frequent Errors
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
          <div className="grid grid-cols-[160px_180px_1fr_64px_84px] gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            <div>Term</div>
            <div>Reading</div>
            <div>Meaning</div>
            <div className="text-right">Error</div>
            <div></div>
          </div>
          <div className="divide-y divide-slate-100">
            {sortedVocab.map((vocab, i) => {
              const stat = stats[vocab.id] || { attempts: 0, correct: 0 };
              const errRate = ((stat.attempts - stat.correct) + 1) / (stat.attempts + 2);
              const errPercent = Math.round(errRate * 100);

              return (
                <div key={`${vocab.id}-${i}`} className="grid grid-cols-[160px_180px_1fr_64px_84px] items-center gap-4 px-4 py-2 hover:bg-slate-50 transition-colors">
                  <div className="text-base text-slate-800 flex items-center truncate" title={vocab.term}>
                    <AffixWrapper term={vocab.term} affixType={vocab.affix_type} mode="inline" />
                  </div>
                  <div className="text-sm text-slate-500 truncate">
                    <AnnotatedReading reading={vocab.reading} pitch={vocab.pitch_accent} affixType={vocab.affix_type} />
                  </div>
                  <div className="text-sm text-slate-600 truncate" style={{ fontFamily: '"Noto Serif TC", serif' }} title={vocab.definition}>
                    {vocab.definition}
                  </div>
                  <div className={`text-sm text-right font-medium ${errPercent > 50 ? 'text-red-500' : 'text-slate-400'}`}>
                    {errPercent}%
                  </div>
                  <div className="flex justify-end">
                    {skippedTerms[vocab.id] ? (
                      <button onClick={() => onUnskip(vocab.id)} className="text-xs px-3 py-1.5 bg-slate-800 text-white rounded-md font-medium hover:bg-slate-700">Unskip</button>
                    ) : (
                      <button onClick={() => onSkip(vocab.id)} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-500 rounded-md font-medium hover:bg-slate-200">Skip</button>
                    )}
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
