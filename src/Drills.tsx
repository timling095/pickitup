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

export const AnnotatedReading = ({ reading, pitch, affixType = 'none' }: { reading: string, pitch: number, affixType?: AffixType }) => {
  const renderReading = () => {
    if (pitch <= 0 || pitch > reading.length) return <span>{reading}</span>;
    const overlined = reading.slice(0, pitch);
    const rest = reading.slice(pitch);
    return (
      <span>
        <span style={{ textDecoration: 'overline', textDecorationThickness: '2px', textDecorationColor: 'currentColor' }}>{overlined}</span>
        <span>{rest}</span>
      </span>
    );
  };

  if (affixType === 'none') return renderReading();
  return affixType === 'prefix' ? <span>{renderReading()}～</span> : <span>～{renderReading()}</span>;
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
  mode: 'term-meaning' | 'reading-meaning' | 'meaning-term-rec' | 'meaning-reading-rec', 
  allVocab: Vocabulary[],
  strictPitch: boolean,
  onComplete: (correct: boolean) => void 
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<number | null>(null);

  const hasPitch = mode === 'reading-meaning' || mode === 'meaning-reading-rec';
  const requiresPitch = hasPitch && strictPitch && vocab.pitch_accent !== -1;
  const isEvaluated = selectedId !== null && (!requiresPitch || selectedPitch !== null);

  const options = useMemo(() => {
    const distractors = shuffle(allVocab.filter(v => v.id !== vocab.id)).slice(0, 5);
    return shuffle([vocab, ...distractors]);
  }, [vocab, allVocab]);

  const isPromptJapanese = mode === 'term-meaning' || mode === 'reading-meaning';
  const isOptionJapanese = mode === 'meaning-term-rec' || mode === 'meaning-reading-rec';

  const prompt = mode === 'term-meaning' ? vocab.term :
                 mode === 'reading-meaning' ? vocab.reading :
                 vocab.definition;

  const getOptionText = (v: Vocabulary) => {
    if (mode === 'meaning-term-rec') return v.term;
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
            <AffixWrapper term={prompt} affixType={vocab.affix_type} mode="inline" />
          ) : (
            <span style={{ fontFamily: '"Songti TC", serif' }}>{prompt}</span>
          )}
          {isEvaluated && vocab.term !== vocab.reading && (
            <div className="absolute left-full ml-6 text-2xl text-slate-400 whitespace-nowrap animate-in fade-in flex items-center h-full pt-1">
              {(mode === 'term-meaning' || mode === 'meaning-term-rec') ? (
                <AnnotatedReading reading={vocab.reading} pitch={vocab.pitch_accent} affixType={vocab.affix_type} />
              ) : (
                <AffixWrapper term={vocab.term} affixType={vocab.affix_type} mode="inline" />
              )}
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
                (isEvaluated && mode === 'meaning-reading-rec') ? (
                  <AnnotatedReading reading={opt.reading} pitch={opt.pitch_accent} affixType={opt.affix_type} />
                ) : (
                  <AffixWrapper term={getOptionText(opt)} affixType={opt.affix_type} mode="inline" />
                )
              ) : (
                <span style={{ fontFamily: '"Songti TC", serif' }}>{getOptionText(opt)}</span>
              )}
            </button>
          );
        })}
      </div>

      {hasPitch && (
        <div className="w-full mt-8">
          <div className={`transition-all ${vocab.pitch_accent === -1 ? 'opacity-50 pointer-events-none' : ''}`}>
            <p className="text-sm text-slate-400 mb-3 text-center uppercase tracking-widest font-medium">
              {vocab.pitch_accent === -1 ? 'Pitch Accent N/A' : 'Select Pitch Accent'}
            </p>
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map(num => {
                let btnClass = "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ";
                if (!isEvaluated) {
                  if (selectedPitch === num) {
                    btnClass += "bg-slate-800 text-white shadow-sm scale-110";
                  } else {
                    btnClass += "bg-slate-100 text-slate-500 hover:bg-slate-200";
                  }
                } else {
                  if (num === vocab.pitch_accent) {
                    btnClass += "bg-green-50 border border-green-500 text-green-700 shadow-sm scale-110";
                  } else if (num === selectedPitch) {
                    btnClass += "bg-red-50 border border-red-500 text-red-700";
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
      )}

      <div className={`w-full mt-8 text-center transition-all duration-300 ${isEvaluated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        <button
          onClick={() => onComplete(selectedId === vocab.id)}
          disabled={!isEvaluated}
          className="w-full py-4 bg-slate-800 text-white rounded-xl font-medium tracking-wide hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
  mode,
  allowMouse,
  onComplete 
}: { 
  vocab: Vocabulary, 
  mode: 'meaning-term' | 'meaning-reading' | 'romaji-reading',
  allowMouse: boolean,
  onComplete: (correct: boolean) => void 
}) => {
  const [revealed, setRevealed] = useState(false);

  const prompt = mode === 'romaji-reading' ? vocab.romaji : vocab.definition;
  const target = mode === 'meaning-term' ? vocab.term : vocab.reading;
  
  let canvasPrompt = "";
  if (mode === 'romaji-reading') {
    canvasPrompt = vocab.system === 'katakana' ? 'Write Katakana' : 'Write Hiragana';
  }

  useEffect(() => {
    setRevealed(false);
    if ((window as any).__clearCanvas) (window as any).__clearCanvas();
  }, [vocab]);

  return (
    <div className="flex flex-col items-center w-full max-w-none">
      <div className="text-3xl font-light text-slate-800 mb-12 tracking-wide text-center flex flex-col items-center gap-4">
        <div className="relative inline-flex items-center justify-center">
          {mode === 'romaji-reading' ? prompt : (
            <span style={{ fontFamily: '"Songti TC", serif' }}>{prompt}</span>
          )}
          {revealed && vocab.term !== vocab.reading && mode !== 'romaji-reading' && (
            <div className="absolute left-full ml-6 text-2xl text-slate-400 whitespace-nowrap flex items-center h-full pt-1">
              {mode === 'meaning-term' ? (
                <AnnotatedReading reading={vocab.reading} pitch={vocab.pitch_accent} affixType={vocab.affix_type} />
              ) : (
                <AffixWrapper term={vocab.term} affixType={vocab.affix_type} mode="inline" />
              )}
            </div>
          )}
        </div>
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
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none bg-white px-5 py-2">
            <span className="text-4xl font-light text-slate-800">
               {mode === 'meaning-term' || mode === 'romaji-reading' ? target : <AnnotatedReading reading={vocab.reading} pitch={vocab.pitch_accent} affixType={vocab.affix_type} />}
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
              onClick={() => onComplete(false)}
              className="flex items-center justify-center gap-2 py-4 bg-white border-2 border-red-100 text-red-600 rounded-xl hover:bg-red-50 transition-colors font-medium"
            >
              <X size={20} /> Incorrect
            </button>
            <button
              onClick={() => onComplete(true)}
              className="flex items-center justify-center gap-2 py-4 bg-white border-2 border-green-100 text-green-600 rounded-xl hover:bg-green-50 transition-colors font-medium"
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

export const DrillEngine = ({ 
  vocabList, 
  modes, 
  strictPitch,
  allowMouse,
  stats,
  onUpdateStats,
  onExit 
}: { 
  vocabList: Vocabulary[], 
  modes: string[],
  strictPitch: boolean,
  allowMouse: boolean,
  stats: Record<string, { attempts: number, correct: number }>,
  onUpdateStats: (id: string, correct: boolean) => void,
  onExit: () => void 
}) => {
  const [queue, setQueue] = useState<{vocab: Vocabulary, mode: string}[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mistakes, setMistakes] = useState<{vocab: Vocabulary, mode: string}[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const scores = vocabList.map(v => {
      const stat = stats[v.id] || { attempts: 0, correct: 0 };
      const rate = (stat.correct + 1) / (stat.attempts + 2);
      return rate;
    }).sort((a, b) => a - b);
    
    const cutoffIndex = Math.floor(scores.length * 0.4);
    const thresholdRate = scores[cutoffIndex] ?? 1;

    const weightedItems = vocabList.map(vocab => {
      const stat = stats[vocab.id] || { attempts: 0, correct: 0 };
      const rate = (stat.correct + 1) / (stat.attempts + 2);
      const weight = rate <= thresholdRate ? 2 : 1; 
      
      const randomScore = Math.random() ** (1 / weight);
      return { vocab, randomScore };
    });

    const newQueue = weightedItems
      .sort((a, b) => b.randomScore - a.randomScore)
      .slice(0, 10)
      .map(({ vocab }) => {
        const randomMode = modes[Math.floor(Math.random() * modes.length)];
        return { vocab, mode: randomMode };
      });
      
    setQueue(newQueue);
  }, [vocabList, modes]);

  const handleComplete = (correct: boolean) => {
    const currentItem = queue[currentIndex];
    onUpdateStats(currentItem.vocab.id, correct);

    if (!correct) {
      setMistakes(prev => [...prev, currentItem]);
    }
    
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (mistakes.length > 0) {
      setQueue(shuffle(mistakes));
      setMistakes([]);
      setCurrentIndex(0);
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
  const isRecognition = currentItem.mode.endsWith('-rec') || currentItem.mode === 'term-meaning' || currentItem.mode === 'reading-meaning';

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-12">
        <button onClick={onExit} className="text-sm text-slate-400 hover:text-slate-600">Cancel Drill</button>
        <div className="flex gap-1">
          {queue.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i < currentIndex ? 'bg-slate-800 w-4' : i === currentIndex ? 'bg-slate-400 w-4' : 'bg-slate-200 w-2'}`} />
          ))}
        </div>
        <div className="text-sm font-medium text-slate-400">{currentIndex + 1} / {queue.length}</div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {isRecognition ? (
          <RecognitionDrill 
            key={`${currentItem.vocab.id}-${currentIndex}`} 
            vocab={currentItem.vocab} 
            mode={currentItem.mode as any} 
            allVocab={vocabList}
            strictPitch={strictPitch}
            onComplete={handleComplete} 
          />
        ) : (
          <ProductionDrill
            key={`${currentItem.vocab.id}-${currentIndex}`}
            vocab={currentItem.vocab}
            mode={currentItem.mode as any}
            allowMouse={allowMouse}
            onComplete={handleComplete}
          />
        )}
      </div>
    </div>
  );
};
