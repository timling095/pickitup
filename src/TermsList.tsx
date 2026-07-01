import { useState, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
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

  const sortedVocab = useMemo(() => {
    if (sortMode === 'skipped') {
      return vocabList.filter(v => skippedTerms[v.id]);
    }
    
    const unskipped = vocabList.filter(v => !skippedTerms[v.id]);

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
  }, [vocabList, stats, sortMode]);

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

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-12">
          <div className="divide-y divide-slate-100">
            {sortedVocab.map((vocab, i) => {
              const stat = stats[vocab.id] || { attempts: 0, correct: 0 };
              const errRate = ((stat.attempts - stat.correct) + 1) / (stat.attempts + 2);
              const errPercent = Math.round(errRate * 100);
              
              return (
                <div key={`${vocab.id}-${i}`} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors gap-3">
                  <div className="flex-1">
                    <div className="text-xl text-slate-800 mb-1 flex items-center">
                      <AffixWrapper term={vocab.term} affixType={vocab.affix_type} mode="inline" />
                    </div>
                    <div className="text-sm text-slate-500 flex flex-wrap items-center gap-2">
                      <AnnotatedReading reading={vocab.reading} pitch={vocab.pitch_accent} affixType={vocab.affix_type} />
                      <span className="text-slate-300">•</span>
                      <span>{vocab.definition}</span>
                    </div>
                  </div>
                  <div className="sm:text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0 bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Error Rate</div>
                    <div className={`text-lg font-medium leading-none ${errPercent > 50 ? 'text-red-500' : 'text-slate-400'}`}>
                      {errPercent}%
                    </div>
                  </div>
                  
                  <div className="ml-2 flex items-center">
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
                No terms available in the selected lessons.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
