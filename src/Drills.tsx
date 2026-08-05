import { useState, useEffect, useMemo, useRef, type ReactNode, type PointerEvent } from 'react';
import { Check, X } from 'lucide-react';
import type { AffixType, Vocabulary } from './dictionary';
import { DrawingCanvas } from './Canvas';
import { Button, TextButton } from './Button';

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

const overlineStyle = { textDecoration: 'overline', textDecorationThickness: '2px', textDecorationColor: 'currentColor' } as const;
// Scales down the term's base glyphs without affecting furigana <rt> sizing —
// <rt>'s own em unit is relative to <ruby>'s (unscaled) inherited font-size, not this sibling span.
const termScaleStyle = { fontSize: '0.7em' } as const;

function renderPitchAccent(reading: string, pitch: number) {
  const morae = getMorae(reading);
  if (pitch <= 0 || pitch > morae.length) return <>{reading}</>;
  const overlined = morae.slice(0, pitch).join('');
  const rest = morae.slice(pitch).join('');
  return (
    <>
      <span style={overlineStyle}>{overlined}</span>
      <span>{rest}</span>
    </>
  );
}

// Renders a slice of morae (starting at global mora index `startIdx`) with the
// pitch-accent overline applied relative to the *whole* reading, so a run of
// morae split across kanji/kana segments still shows one continuous accent line.
function renderMoraeSlice(morae: string[], startIdx: number, pitch: number, isAccented: boolean) {
  if (!isAccented) return <>{morae.join('')}</>;
  const localPitch = Math.max(0, Math.min(morae.length, pitch - startIdx));
  if (localPitch <= 0) return <>{morae.join('')}</>;
  if (localPitch >= morae.length) return <span style={overlineStyle}>{morae.join('')}</span>;
  return (
    <>
      <span style={overlineStyle}>{morae.slice(0, localPitch).join('')}</span>
      <span>{morae.slice(localPitch).join('')}</span>
    </>
  );
}

const isKanjiChar = (ch: string) => /[一-龯㐀-䶿]/.test(ch);

function segmentTerm(term: string): { text: string; isKanji: boolean }[] {
  const segments: { text: string; isKanji: boolean }[] = [];
  for (const ch of term) {
    const kanji = isKanjiChar(ch);
    const last = segments[segments.length - 1];
    if (last && last.isKanji === kanji) {
      last.text += ch;
    } else {
      segments.push({ text: ch, isKanji: kanji });
    }
  }
  return segments;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Katakana segments (e.g. loanwords) need to match against a hiragana reading string.
function toHiragana(s: string) {
  return s.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export const AnnotatedReading = ({ reading, pitch, affixType = 'none' }: { reading: string, pitch: number, affixType?: AffixType }) => {
  const rendered = <span>{renderPitchAccent(reading, pitch)}</span>;
  if (affixType === 'none') return rendered;
  return affixType === 'prefix' ? <span>{rendered}～</span> : <span>～{rendered}</span>;
};

// ==========================================
// === AnnotatedTerm (furigana) ===
// ==========================================

// `compact`: tightens the furigana-to-kanji gap (used by the Terms List's dense table
// rows) — the default 0.2em gap was tuned for the Drills' large-scale prompt display,
// where more breathing room reads fine; in a compact table row the same gap reads as
// oddly floating.
export const AnnotatedTerm = ({ term, reading, pitch, affixType = 'none', compact = false }: { term: string, reading: string, pitch: number, affixType?: AffixType, compact?: boolean }) => {
  const segments = segmentTerm(term);
  const hasKanji = segments.some(s => s.isKanji);
  const morae = getMorae(reading);
  const isAccented = pitch > 0 && pitch <= morae.length;
  const rubyGap = compact ? '0.05em' : '0.1em';

  let content: ReactNode;

  if (!hasKanji) {
    // Pure-kana term: it already displays its own reading, so no furigana needed —
    // just draw the pitch-accent line straight over the term itself.
    content = <span style={termScaleStyle}>{renderMoraeSlice(morae, 0, pitch, isAccented)}</span>;
  } else {
    let segReadings: string[] | null = segments.length === 1 ? [reading] : null;
    if (!segReadings) {
      const pattern = '^' + segments.map(s => s.isKanji ? '(.+?)' : escapeRegExp(toHiragana(s.text))).join('') + '$';
      const match = reading.match(new RegExp(pattern));
      if (match) {
        let capIdx = 1;
        segReadings = segments.map(s => s.isKanji ? match[capIdx++] : s.text);
      }
    }

    if (!segReadings) {
      // Couldn't align kana okurigana against the reading (unexpected data) — fall
      // back to annotating the whole term as one ruby block rather than guessing wrong.
      content = (
        <ruby>
          <span style={termScaleStyle}>{term}</span>
          <rt className="text-[0.4em] leading-none" style={{ marginBottom: rubyGap }}>{renderMoraeSlice(morae, 0, pitch, isAccented)}</rt>
        </ruby>
      );
    } else {
      let moraIdx = 0;
      const finalSegReadings = segReadings;
      content = segments.map((seg, i) => {
        const segMorae = getMorae(finalSegReadings[i]);
        const startIdx = moraIdx;
        moraIdx += segMorae.length;
        if (seg.isKanji) {
          return (
            <ruby key={i}>
              <span style={termScaleStyle}>{seg.text}</span>
              <rt className="text-[0.4em] leading-none" style={{ marginBottom: rubyGap }}>{renderMoraeSlice(segMorae, startIdx, pitch, isAccented)}</rt>
            </ruby>
          );
        }
        return <span key={i} style={termScaleStyle}>{renderMoraeSlice(segMorae, startIdx, pitch, isAccented)}</span>;
      });
    }
  }

  if (affixType === 'none') return <>{content}</>;
  return affixType === 'prefix' ? <>{content}～</> : <>～{content}</>;
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
            <div className="absolute left-full ml-6 text-2xl text-slate-400 whitespace-nowrap animate-fade-in flex items-center h-full pt-1">
              <AffixWrapper term={vocab.term} affixType={vocab.affix_type} mode="inline" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full transition-opacity">
        {options.map((opt, i) => {
          const isSelected = selectedId === opt.id;
          const isCorrectOpt = opt.id === vocab.id;
          // Selection/feedback expressed as a Button variant, same as every other
          // button in the app, instead of a bespoke class string. `pointer-events-none`
          // (rather than the `disabled` prop) once evaluated: clicks are already a
          // no-op via `handleSelect`'s own guard, and this avoids Button's
          // disabled:opacity-50 washing out the correct/incorrect feedback colors —
          // only the "neither correct nor selected" options get faded, via a plain
          // (non-pseudo-class) opacity-50 so it can't be fought by specificity.
          const variant: 'outline' | 'primary' | 'correct' | 'incorrect' =
            !isEvaluated ? (isSelected ? 'primary' : 'outline')
            : isCorrectOpt ? 'correct'
            : isSelected ? 'incorrect'
            : 'outline';

          return (
            <Button
              key={i}
              onClick={() => handleSelect(opt.id)}
              variant={variant}
              autoHeight
              fullWidth
              className={`px-4 ${isEvaluated ? `pointer-events-none ${!isCorrectOpt && !isSelected ? 'opacity-50' : ''}` : ''}`}
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
            </Button>
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
              let btnClass = "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all cursor-pointer active:scale-95 disabled:cursor-not-allowed ";
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
        <Button
          onClick={() => {
            if (canProceed) onComplete(selectedId === vocab.id);
          }}
          disabled={!canProceed}
          fullWidth
        >
          Next Question
        </Button>
      </div>
    </div>
  );
};

// ==========================================
// === PenButton ===
// ==========================================

// Palm-rejecting button for the Production drill's grading controls (Reveal Answer,
// Proceed, Correct, Incorrect) — Apple Pencil only, or mouse in debug via `allowMouse`.
// The lever and Glossary button don't need this: they're plain onClick, and a native
// click already requires a real press-then-release on the same element before firing,
// for any pointer type. These buttons used to fire straight from `onPointerDown` with a
// manual `pointerType` check instead — which meant a hover-capable pen (Apple Pencil
// 2/Pro fires real pointer events while merely hovering, before any contact) or even a
// light graze from a resting palm could trigger the action immediately, with no
// press-then-release gesture at all. Firing on `onPointerUp` instead (still gated by
// pointerType, re-checked at that point) restores the same "must release to confirm"
// behavior every other button gets for free from native `onClick`.
// The press-scale animation is likewise driven by JS-tracked `pressed` state, not
// Button's default CSS `:active` — `:active` reacts to ANY pointerdown regardless of
// type, which would visibly "respond" (squash) to a rejected touch even though its
// click was correctly ignored. `onPointerCancel`/`onPointerLeave` clear the pressed
// state without firing, so dragging off the button (or the OS cancelling the gesture)
// behaves like releasing outside a normal button — no accidental activation.
function PenButton({
  onActivate, allowMouse, disabled, variant, fullWidth, autoHeight, className = '', children
}: {
  onActivate: () => void,
  allowMouse: boolean,
  disabled?: boolean,
  variant?: 'primary' | 'danger-outline' | 'success-outline' | 'outline' | 'correct' | 'incorrect',
  fullWidth?: boolean,
  autoHeight?: boolean,
  className?: string,
  children: ReactNode
}) {
  const [pressed, setPressed] = useState(false);
  const validPressRef = useRef(false);

  const cancelPress = () => {
    validPressRef.current = false;
    setPressed(false);
  };

  return (
    <Button
      variant={variant}
      fullWidth={fullWidth}
      autoHeight={autoHeight}
      disabled={disabled}
      pressed={pressed}
      className={className}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        validPressRef.current = e.pointerType === 'pen' || allowMouse;
        if (validPressRef.current) setPressed(true);
      }}
      onPointerUp={(e: PointerEvent<HTMLButtonElement>) => {
        if (!validPressRef.current) return;
        cancelPress();
        if (e.pointerType === 'pen' || allowMouse) onActivate();
      }}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
    >
      {children}
    </Button>
  );
}

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
  const [correcting, setCorrecting] = useState(false);
  const [canProceed, setCanProceed] = useState(false);

  useEffect(() => {
    if (revealed) {
      const timer = setTimeout(() => setCanEvaluate(true), 400);
      return () => clearTimeout(timer);
    } else {
      setCanEvaluate(false);
    }
  }, [revealed]);

  useEffect(() => {
    if (correcting) {
      const timer = setTimeout(() => setCanProceed(true), 400);
      return () => clearTimeout(timer);
    } else {
      setCanProceed(false);
    }
  }, [correcting]);

  const prompt = vocab.definition;
  const canvasPrompt = 'Write the Term';

  useEffect(() => {
    setRevealed(false);
    setCorrecting(false);
    if ((window as any).__clearCanvas) (window as any).__clearCanvas();
  }, [vocab]);

  return (
    <div className="flex flex-col items-center w-full h-full max-w-none select-none">
      <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
        <div className="text-5xl font-light text-slate-800 mb-12 tracking-wide text-center flex flex-col items-center gap-4 select-none touch-none">
          <div className="relative inline-flex items-center justify-center">
            <span style={{ fontFamily: '"Noto Serif TC", serif' }}>{prompt}</span>
            {revealed && (
              <div className="absolute left-full ml-12 top-1/2 -translate-y-1/2 text-5xl font-light text-slate-800 whitespace-nowrap animate-fade-in flex items-baseline gap-1">
                <AnnotatedTerm term={vocab.term} reading={vocab.reading} pitch={vocab.pitch_accent} affixType={vocab.affix_type} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center w-full">
          <DrawingCanvas promptText={canvasPrompt} allowMouse={allowMouse} disabled={revealed && !correcting}>
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
        </div>
      </div>

      <div className="w-[80%] pb-4">
        {!revealed ? (
          <PenButton onActivate={() => setRevealed(true)} allowMouse={allowMouse} fullWidth className="touch-none">
            Reveal Answer
          </PenButton>
        ) : correcting ? (
          <PenButton
            onActivate={() => onComplete(false)}
            allowMouse={allowMouse}
            disabled={!canProceed}
            fullWidth
            className="touch-none animate-fade-slide-up"
          >
            Proceed
          </PenButton>
        ) : (
          <div className="grid grid-cols-2 gap-4 animate-fade-slide-up">
            <PenButton
              onActivate={() => setCorrecting(true)}
              allowMouse={allowMouse}
              disabled={!canEvaluate}
              variant="danger-outline"
              fullWidth
              className="touch-none"
            >
              <X size={20} /> Incorrect
            </PenButton>
            <PenButton
              onActivate={() => onComplete(true)}
              allowMouse={allowMouse}
              disabled={!canEvaluate}
              variant="success-outline"
              fullWidth
              className="touch-none"
            >
              <Check size={20} /> Correct
            </PenButton>
          </div>
        )}
      </div>
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
  onExit
}: {
  vocabList: Vocabulary[],
  strictPitch: boolean,
  stats: Record<string, { attempts: number, correct: number }>,
  onUpdateStats: (id: string, correct: boolean) => void,
  onExit: () => void
}) => {
  const [queue, setQueue] = useState<{vocab: Vocabulary, mode: 'reading-meaning' | 'meaning-reading-rec'}[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    // Single weighted pass: each term appears at most once.
    // Session length = min(15, pool size) — no repetition ever.
    const scores = vocabList.map(v => {
      const stat = stats[v.id] || { attempts: 0, correct: 0 };
      return (stat.correct + 1) / (stat.attempts + 2);
    }).sort((a, b) => a - b);
    const thresholdRate = scores[Math.floor(scores.length * 0.5)] ?? 1;

    const newQueue = vocabList
      .map(vocab => {
        const stat = stats[vocab.id] || { attempts: 0, correct: 0 };
        const rate = (stat.correct + 1) / (stat.attempts + 2);
        const weight = rate <= thresholdRate ? 3 : 1;
        return { vocab, randomScore: Math.random() ** (1 / weight) };
      })
      .sort((a, b) => b.randomScore - a.randomScore)
      .slice(0, 15)
      .map(({ vocab }) => ({
        vocab,
        mode: RECOGNITION_MODES[Math.floor(Math.random() * RECOGNITION_MODES.length)] as 'reading-meaning' | 'meaning-reading-rec',
      }));

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

  if (queue.length === 0) return null;

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <Check size={40} />
        </div>
        <h2 className="text-3xl font-light text-slate-800 mb-2">Drill Complete</h2>
        <p className="text-slate-500 mb-8">You've mastered this set.</p>
        <button onClick={onExit} className="px-8 py-3 bg-slate-800 text-white rounded-full font-medium hover:bg-slate-700 transition cursor-pointer active:scale-95">
          Return to Menu
        </button>
      </div>
    );
  }

  const currentItem = queue[currentIndex];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-12 select-none">
        <TextButton onClick={onExit} align="start"><X size={16} strokeWidth={2} />Exit Drill</TextButton>
        <div className="flex gap-1">
          {queue.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i < currentIndex ? 'bg-slate-800 w-4' : i === currentIndex ? 'bg-slate-400 w-4' : 'bg-slate-200 w-2'}`} />
          ))}
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
  onComplete,
  onExit
}: {
  vocabList: Vocabulary[],
  minWorking: number,
  maxWorking: number,
  allowMouse: boolean,
  fcRecords: Record<string, FcRecord>,
  onUpdateFcRecord: (id: string, correct: boolean) => void,
  onComplete: () => void,
  onExit: () => void
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
      if (correct) {
        setWorkingIds([...workingIds.slice(1), currentId]);
        return;
      }
      // Wrong answer on a backfilled "mastered" term: un-master it via the normal
      // streak-reset path instead of silently recycling it forever.
      const nextPermanentIds = new Set(permanentIds);
      nextPermanentIds.delete(currentId);
      setPermanentIds(nextPermanentIds);
      onUpdateFcRecord(currentId, false);
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

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <Check size={40} />
        </div>
        <h2 className="text-3xl font-light text-slate-800 mb-2">Session Complete</h2>
        <p className="text-slate-500 mb-8">You've mastered every term in this scope.</p>
        <button onClick={onComplete} className="px-8 py-3 bg-slate-800 text-white rounded-full font-medium hover:bg-slate-700 transition cursor-pointer active:scale-95">
          Return to Menu
        </button>
      </div>
    );
  }

  if (workingIds.length === 0) return null;

  const currentId = workingIds[0];
  const currentItem = vocabList.find(v => v.id === currentId);
  if (!currentItem) return null;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-12 select-none">
        <TextButton onClick={onExit} align="start"><X size={16} strokeWidth={2} />Exit Drill</TextButton>
        <div className="text-sm font-medium text-slate-400">{masteredIds.size} / {vocabList.length} mastered</div>
      </div>

      <div className="flex-1 flex justify-center min-h-0">
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
