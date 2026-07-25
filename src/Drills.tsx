import { useState, useEffect, useMemo } from 'react';
import { Check, X } from 'lucide-react';
import type { AffixType, Vocabulary } from './dictionary';
import { DrawingCanvas } from './Canvas';

function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// ==========================================
// === AffixWrapper ===
// ==========================================

export const AffixWrapper = ({ term, affixType, mode = 'inline' }: { term: string, affixType: AffixType, mode?: 'inline' | 'framing' }) => {
  if (affixType === 'none') return mode === 'inline' ? <span>{term}</span> : null;
  
  if (mode === 'inline') {
    return affixType === 'prefix' ? <span>{term}～</span> : <span>～{term}</span>;
  }

  // mode === 'framing'
  return <span className="text-4xl font-light text-slate-400">～</span>;
};

// ==========================================
// === AnnotatedReading ===
// ==========================================

export const getMorae = (word: string): string[] => {
  const morae = [];
  for (const char of word) {
    if (/[ゃゅょぁぃぅぇぉャュョァィゥェォヮ]/.test(char) && morae.length > 0) {
      morae[morae.length - 1] += char;
    } else {
      morae.push(char);
    }
  }
  return morae;
};

function renderPitchAccent(reading: string, pitch: number) {
  const morae = getMorae(reading);
  if (pitch <= 0 || pitch > morae.length) return <>{reading}</>;
  const overlined = morae.slice(0, pitch).join('');
  const rest = morae.slice(pitch).join('');
  return (
    <>
      <span style={{ textDecoration: 'overline', textDecorationThickness: '2px', textDecorationColor: 'currentColor' }}>{overlined}</span>
      <span>{rest}</span>
    </>
  );
}

export const AnnotatedReading = ({ reading, pitch, affixType = 'none' }: { reading: string, pitch: number, affixType?: AffixType }) => {
  const rendered = <span>{renderPitchAccent(reading, pitch)}</span>;
  if (affixType === 'none') return rendered;
  return affixType === 'prefix' ? <span>{rendered}～</span> : <span>～{rendered}</span>;
};

// ==========================================
// === AnnotatedTerm (furigana) ===
// ==========================================

export const AnnotatedTerm = ({ term, reading, pitch, affixType = 'none' }: { term: string, reading: string, pitch: number, affixType?: AffixType }) => {
  const rubyEl = (
    <ruby>
      {term}
      <rt className="text-[0.5em] font-normal text-slate-400">{renderPitchAccent(reading, pitch)}</rt>
    </ruby>
  );

  if (affixType === 'none') return rubyEl;
  return affixType === 'prefix' ? <>{rubyEl}～</> : <>～{rubyEl}</>;
};

// ==========================================
// === RecognitionDrill ===
// ==========================================

export const RecognitionDrill = ({
  vocab,
  mode,
  allVocab,
  strictPitch,
  onComplete
}: {
  vocab: Vocabulary,
  mode: 'reading-meaning' | 'meaning-reading-rec',
  allVocab: Vocabulary[],
  strictPitch: boolean,
  onComplete: (correct: boolean) => void
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<number | null>(null);

  const isEvaluated = selectedId !== null && (!strictPitch || vocab.pitch_accent === -1 || selectedPitch !== null);
  
  const [canProceed, setCanProceed] = useState(false);

  useEffect(() => {
    if (isEvaluated) {
      const timer = setTimeout(() => setCanProceed(true), 400);
      return () => clearTimeout(timer);
    } else {
      setCanProceed(false);
    }
  }, [isEvaluated]);

  const options = useMemo(() => {
    const distractors = shuffle(allVocab.filter(v => v.id !== vocab.id)).slice(0, 5);
    return shuffle([vocab, ...distractors]);
  }, [vocab, allVocab]);

  const isPromptJapanese = mode === 'reading-meaning';
  const isOptionJapanese = mode === 'meaning-reading-rec';

  const prompt = mode === 'reading-meaning' ? vocab.reading : vocab.definition;

  const getOptionText = (v: Vocabulary) => {
    if (mode === 'meaning-reading-rec') return v.reading;
    return v.definition;
  };

  const handleSelect = (id: string) => {
    if (isEvaluated) return;
    setSelectedId(id);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-none">
      <div className={`text-5xl font-light text-slate-800 mb-12 tracking-wide text-center flex flex-col items-center gap-4 ${!isPromptJapanese && 'text-3xl'}`}>
        <div className="relative inline-flex items-center justify-center">
          {isPromptJapanese ? (
            isEvaluated ? (
              <AnnotatedReading reading={vocab.reading} pitch={vocab.pitch_accent} affixType={vocab.affix_type} />
            ) : (
              <AffixWrapper term={prompt} affixType={vocab.affix_type} mode="inline" />
            )
          ) : (
            <span style={{ fontFamily: '"Noto Serif TC", serif' }}>{prompt}</span>
          )}
          {isEvaluated && (
            <div className="absolute left-full ml-6 text-2xl text-slate-400 whitespace-nowrap animate-in fade-in flex items-center h-full pt-1">
              <AffixWrapper term={vocab.term} affixType={vocab.affix_type} mode="inline" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full transition-opacity">
        {options.map((opt, i) => {
          let btnClass = "p-4 border rounded-xl text-sm font-medium transition-all ";
          
          if (!isEvaluated) {
            if (selectedId === opt.id) {
              btnClass += "bg-slate-800 border-slate-800 text-white shadow-sm"; // Selected but waiting for evaluation
            } else {
              btnClass += "bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:shadow-sm";
            }
          } else {
            if (opt.id === vocab.id) {
              btnClass += "bg-green-50 border-green-500 text-green-700 shadow-sm";
            } else if (opt.id === selectedId) {
              btnClass += "bg-red-50 border-red-500 text-red-700";
            } else {
              btnClass += "bg-white border-slate-100 text-slate-300 opacity-50";
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(opt.id)}
              disabled={isEvaluated}
              className={btnClass}
            >
              {isOptionJapanese ? (
                isEvaluated ? (
                  <AnnotatedReading reading={opt.reading} pitch={opt.pitch_accent} affixType={opt.affix_type} />
                ) : (
                  <AffixWrapper term={getOptionText(opt)} affixType={opt.affix_type} mode="inline" />
                )
              ) : (
                <span style={{ fontFamily: '"Noto Serif TC", serif' }}>{getOptionText(opt)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="w-full mt-8">
        <div className={`transition-all ${vocab.pitch_accent === -1 ? 'opacity-50 pointer-events-none' : ''}`}>
          <p className="text-sm text-slate-400 mb-3 text-center uppercase tracking-widest font-medium">
            {vocab.pitch_accent === -1 ? 'Pitch Accent N/A' : 'Select Pitch Accent'}
          </p>
          <div className="flex justify-center flex-wrap gap-2">
            {Array.from({length: getMorae(vocab.reading).length + 1}, (_, i) => i).map(num => {
              let btnClass = "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ";
              if (!isEvaluated) {
                if (selectedPitch === num) {
                  btnClass += "bg-slate-800 text-white shadow-sm scale-110";
                } else {
                  btnClass += "bg-slate-100 text-slate-500 hover:bg-slate-200";
                }
              } else {
                if (num === selectedPitch) {
                  if (num === vocab.pitch_accent) {
                    btnClass += "bg-green-50 border border-green-500 text-green-700 shadow-sm scale-110";
                  } else {
                    btnClass += "bg-red-50 border border-red-500 text-red-700 scale-110";
                  }
                } else {
                  btnClass += "bg-slate-50 text-slate-300";
                }
              }
              return (
                <button
                  key={num}
                  onClick={() => setSelectedPitch(num)}
                  disabled={isEvaluated}
                  className={btnClass}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`w-full mt-8 text-center transition-all duration-300 ${isEvaluated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        <button
          onClick={() => {
            if (canProceed) onComplete(selectedId === vocab.id);
          }}
          disabled={!canProceed}
          className="w-full py-4 bg-slate-800 text-white rounded-xl font-medium tracking-wide hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed select-none"
        >
          Next Question
        </button>
      </div>
    </div>
  );
};

// ==========================================
// === ProductionDrill ===
// ==========================================

export const ProductionDrill = ({ 
  vocab, 
  allowMouse,
  onComplete
}: {
  vocab: Vocabulary,
  allowMouse: boolean,
  onComplete: (correct: boolean) => void
}) => {
  const [revealed, setRevealed] = useState(false);
  const [canEvaluate, setCanEvaluate] = useState(false);

  useEffect(() => {
    if (revealed) {
      const timer = setTimeout(() => setCanEvaluate(true), 400);
      return () => clearTimeout(timer);
    } else {
      setCanEvaluate(false);
    }
  }, [revealed]);

  const prompt = vocab.definition;
  const canvasPrompt = 'Write the Term';

  useEffect(() => {
    setRevealed(false);
    if ((window as any).__clearCanvas) (window as any).__clearCanvas();
  }, [vocab]);

  return (
    <div className="flex flex-col items-center w-full max-w-none select-none">
      <div className="text-3xl font-light text-slate-800 mb-12 tracking-wide text-center flex flex-col items-center gap-4 select-none touch-none">
        <span style={{ fontFamily: '"Noto Serif TC", serif' }}>{prompt}</span>
      </div>

      <div className="flex items-center justify-center w-full mb-8 relative">
        <DrawingCanvas promptText={canvasPrompt} allowMouse={allowMouse}>
          {vocab.affix_type === 'prefix' && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
              <AffixWrapper term={vocab.term} affixType="prefix" mode="framing" />
            </div>
          )}
          {vocab.affix_type === 'suffix' && (
            <div className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-none">
              <AffixWrapper term={vocab.term} affixType="suffix" mode="framing" />
            </div>
          )}
        </DrawingCanvas>

        {revealed && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none bg-white px-5 pt-3 pb-2 rounded-xl shadow-sm">
            <span className="text-4xl font-light text-slate-800 leading-[2.2]">
              <AnnotatedTerm term={vocab.term} reading={vocab.reading} pitch={vocab.pitch_accent} affixType={vocab.affix_type} />
            </span>
          </div>
        )}
      </div>

      {!revealed ? (
        <button
          onPointerDown={(e) => {
            if (e.pointerType === 'pen' || allowMouse) {
              setRevealed(true);
            }
          }}
          className="w-full py-4 bg-slate-800 text-white rounded-xl font-medium tracking-wide hover:bg-slate-700 transition-colors shadow-sm select-none touch-none"
        >
          Reveal Answer
        </button>
      ) : (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-300">

          <div className="grid grid-cols-2 gap-4">
            <button
              onPointerDown={(e) => {
                if (!canEvaluate) return;
                if (e.pointerType === 'pen' || allowMouse) onComplete(false);
              }}
              disabled={!canEvaluate}
              className="flex items-center justify-center gap-2 py-4 bg-white border-2 border-red-100 text-red-600 rounded-xl hover:bg-red-50 transition-colors font-medium select-none touch-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={20} /> Incorrect
            </button>
            <button
              onPointerDown={(e) => {
                if (!canEvaluate) return;
                if (e.pointerType === 'pen' || allowMouse) onComplete(true);
              }}
              disabled={!canEvaluate}
              className="flex items-center justify-center gap-2 py-4 bg-white border-2 border-green-100 text-green-600 rounded-xl hover:bg-green-50 transition-colors font-medium select-none touch-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={20} /> Correct
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// === DrillEngine ===
// ==========================================

const RECOGNITION_MODES: ('reading-meaning' | 'meaning-reading-rec')[] = ['reading-meaning', 'meaning-reading-rec'];

export const DrillEngine = ({
  vocabList,
  strictPitch,
  stats,
  onUpdateStats,
  onSkip,
  onExit
}: {
  vocabList: Vocabulary[],
  strictPitch: boolean,
  stats: Record<string, { attempts: number, correct: number }>,
  onUpdateStats: (id: string, correct: boolean) => void,
  onSkip: (id: string) => void,
  onExit: () => void
}) => {
  const [queue, setQueue] = useState<{vocab: Vocabulary, mode: 'reading-meaning' | 'meaning-reading-rec'}[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const scores = vocabList.map(v => {
      const stat = stats[v.id] || { attempts: 0, correct: 0 };
      const rate = (stat.correct + 1) / (stat.attempts + 2);
      return rate;
    }).sort((a, b) => a - b);
    
    const cutoffIndex = Math.floor(scores.length * 0.5);
    const thresholdRate = scores[cutoffIndex] ?? 1;

    const weightedItems = vocabList.map(vocab => {
      const stat = stats[vocab.id] || { attempts: 0, correct: 0 };
      const rate = (stat.correct + 1) / (stat.attempts + 2);
      const weight = rate <= thresholdRate ? 3 : 1;

      const randomScore = Math.random() ** (1 / weight);
      return { vocab, randomScore };
    });

    const newQueue = weightedItems
      .sort((a, b) => b.randomScore - a.randomScore)
      .slice(0, 10)
      .map(({ vocab }) => {
        const randomMode = RECOGNITION_MODES[Math.floor(Math.random() * RECOGNITION_MODES.length)];
        return { vocab, mode: randomMode };
      });

    setQueue(newQueue);
  }, [vocabList]);

  const handleComplete = (correct: boolean) => {
    const currentItem = queue[currentIndex];
    onUpdateStats(currentItem.vocab.id, correct);
    
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handleSkip = () => {
    onSkip(queue[currentIndex].vocab.id);
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  if (queue.length === 0) return null;

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center fade-in">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <Check size={40} />
        </div>
        <h2 className="text-3xl font-light text-slate-800 mb-2">Drill Complete</h2>
        <p className="text-slate-500 mb-8">You've mastered this set.</p>
        <button onClick={onExit} className="px-8 py-3 bg-slate-800 text-white rounded-full font-medium hover:bg-slate-700 transition-colors">
          Return to Menu
        </button>
      </div>
    );
  }

  const currentItem = queue[currentIndex];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-12 select-none">
        <button onClick={onExit} className="text-sm text-slate-400 hover:text-slate-600">Cancel Drill</button>
        <div className="flex gap-1">
          {queue.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i < currentIndex ? 'bg-slate-800 w-4' : i === currentIndex ? 'bg-slate-400 w-4' : 'bg-slate-200 w-2'}`} />
          ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-slate-400">{currentIndex + 1} / {queue.length}</div>
          <button onClick={handleSkip} className="text-sm text-slate-400 hover:text-slate-600">Skip Term</button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <RecognitionDrill
          key={`${currentItem.vocab.id}-${currentIndex}`}
          vocab={currentItem.vocab}
          mode={currentItem.mode}
          allVocab={vocabList}
          strictPitch={strictPitch}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
};

// ==========================================
// === FlashcardEngine ===
// ==========================================

export interface FcRecord {
  attempts: number;
  streak: number;
}

export function isMastered(record: FcRecord | undefined): boolean {
  if (!record) return false;
  if (record.attempts === 1 && record.streak === 1) return true;
  return record.streak >= 2;
}

function buildRefill(
  current: string[],
  permanent: Set<string>,
  masteredIds: Set<string>,
  min: number,
  max: number,
  vocabList: Vocabulary[]
): { next: string[]; nextPermanent: Set<string> } {
  const next = [...current];
  const nextPermanent = new Set(permanent);

  const freshCandidates = shuffle(vocabList.filter(v => !next.includes(v.id) && !masteredIds.has(v.id)));
  for (const v of freshCandidates) {
    if (next.length >= max) break;
    next.push(v.id);
  }

  if (next.length < min) {
    const masteredCandidates = shuffle([...masteredIds].filter(id => !next.includes(id)));
    for (const id of masteredCandidates) {
      if (next.length >= min) break;
      next.push(id);
      nextPermanent.add(id);
    }
  }

  return { next, nextPermanent };
}

export const FlashcardEngine = ({
  vocabList,
  minWorking,
  maxWorking,
  allowMouse,
  fcRecords,
  onUpdateFcRecord,
  onSkip,
  onComplete,
  onDiscard
}: {
  vocabList: Vocabulary[],
  minWorking: number,
  maxWorking: number,
  allowMouse: boolean,
  fcRecords: Record<string, FcRecord>,
  onUpdateFcRecord: (id: string, correct: boolean) => void,
  onSkip: (id: string) => void,
  onComplete: () => void,
  onDiscard: () => void
}) => {
  const [workingIds, setWorkingIds] = useState<string[]>([]);
  const [permanentIds, setPermanentIds] = useState<Set<string>>(new Set());
  const [isFinished, setIsFinished] = useState(false);
  const [drillKey, setDrillKey] = useState(0);

  const masteredIds = useMemo(
    () => new Set(vocabList.filter(v => isMastered(fcRecords[v.id])).map(v => v.id)),
    [vocabList, fcRecords]
  );

  useEffect(() => {
    if (vocabList.length > 0 && vocabList.every(v => masteredIds.has(v.id))) {
      setIsFinished(true);
      return;
    }
    if (workingIds.length === 0) {
      const { next, nextPermanent } = buildRefill([], new Set(), masteredIds, minWorking, maxWorking, vocabList);
      setWorkingIds(next);
      setPermanentIds(nextPermanent);
    }
  }, [vocabList, masteredIds, minWorking, maxWorking, workingIds.length]);

  const handleComplete = (correct: boolean) => {
    setDrillKey(prev => prev + 1);
    const currentId = workingIds[0];

    if (permanentIds.has(currentId)) {
      setWorkingIds([...workingIds.slice(1), currentId]);
      return;
    }

    const prevRecord = fcRecords[currentId] || { attempts: 0, streak: 0 };
    const nextRecord: FcRecord = { attempts: prevRecord.attempts + 1, streak: correct ? prevRecord.streak + 1 : 0 };
    onUpdateFcRecord(currentId, correct);

    if (isMastered(nextRecord)) {
      const nextMasteredIds = new Set(masteredIds);
      nextMasteredIds.add(currentId);
      const withoutCurrent = workingIds.slice(1);
      const { next, nextPermanent } = buildRefill(withoutCurrent, permanentIds, nextMasteredIds, minWorking, maxWorking, vocabList);
      setWorkingIds(next);
      setPermanentIds(nextPermanent);
    } else {
      setWorkingIds([...workingIds.slice(1), currentId]);
    }
  };

  const handleSkip = () => {
    const currentId = workingIds[0];
    onSkip(currentId);
    const withoutCurrent = workingIds.slice(1);
    const remainingVocab = vocabList.filter(v => v.id !== currentId);
    const { next, nextPermanent } = buildRefill(withoutCurrent, permanentIds, masteredIds, minWorking, maxWorking, remainingVocab);
    setWorkingIds(next);
    setPermanentIds(nextPermanent);
  };

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center fade-in">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <Check size={40} />
        </div>
        <h2 className="text-3xl font-light text-slate-800 mb-2">Session Complete</h2>
        <p className="text-slate-500 mb-8">You've mastered every term in this scope.</p>
        <button onClick={onComplete} className="px-8 py-3 bg-slate-800 text-white rounded-full font-medium hover:bg-slate-700 transition-colors">
          Return to Menu
        </button>
      </div>
    );
  }

  if (workingIds.length === 0) return null;

  const currentId = workingIds[0];
  const currentItem = vocabList.find(v => v.id === currentId);
  if (!currentItem) return null;

  const isPermanent = permanentIds.has(currentId);
  const currentRecord = fcRecords[currentId];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-12 select-none">
        <button onClick={onDiscard} className="text-sm text-slate-400 hover:text-slate-600">Discard Session</button>
        <div className="flex flex-col items-center">
          <div className="text-sm font-medium text-slate-400">
            {isPermanent ? 'Review (Mastered)' : `Streak: ${currentRecord?.streak ?? 0} / 2`}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-slate-400">{masteredIds.size} / {vocabList.length} mastered</div>
          <button onClick={handleSkip} className="text-sm text-slate-400 hover:text-slate-600">Skip Term</button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <ProductionDrill
          key={`${currentItem.id}-${drillKey}`}
          vocab={currentItem}
          allowMouse={allowMouse}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
};
