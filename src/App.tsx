import { useState, useMemo, type ReactNode } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { DICTIONARY, useVocabulary, applyVerbForm, filterByWordType } from './dictionary';
import type { WordType } from './dictionary';
import { DrillEngine, FlashcardEngine, isMastered } from './Drills';
import type { FcRecord } from './Drills';
import { TermsList } from './TermsList';

// Custom hook to persist state in localStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
}

// Two overlapping range inputs drive value/drag logic only — their native thumbs are
// made a big, fully invisible 44px touch target (Material Design clickbox) and never
// drawn. The visible dot + focus/hover halo are separate plain <div>s, positioned with
// a plain `frac * 100%` + translateX(-50%). That sidesteps relying on any given
// browser's internal "keep the native thumb inside the track" inset math (which turned
// out to visibly differ enough, notably on iPadOS Safari, to throw a native-thumb-drawn
// dot off from the track's true ends) — a plain percentage + centering transform is
// identical in every browser, so the dot's *center* always lands exactly on the track's
// ends, never past them.
// Each native input's own box is still made 44px wider than the track (`left`/`right`
// of -22px) so *its* invisible hit-box center also lands on the same `frac * 100%`
// point as the decorative dot — otherwise the two drift apart everywhere except the
// midpoint, and the actual tap target stops matching what's drawn on screen.
// NOTE: Tailwind's class scanner reads this file's literal source text, so the 44px
// hit-box size must stay a hardcoded string — template interpolation would hide it from
// the scanner and silently produce no CSS.
const THUMB_HIT = 44;
const THUMB_HALF = THUMB_HIT / 2;

// iPadOS Safari draws a UA default box-shadow on ::-webkit-slider-thumb (used as its
// focus/active glow) that survives appearance-none + a transparent background — visible
// as a stray shadow under our decorative halo since the (invisible) native thumb sits
// exactly beneath it. shadow-none clears it explicitly; harmless everywhere else.
const nativeThumbClass =
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto " +
  "[&::-webkit-slider-thumb]:w-[44px] [&::-webkit-slider-thumb]:h-[44px] [&::-webkit-slider-thumb]:rounded-full " +
  "[&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto " +
  "[&::-moz-range-thumb]:w-[44px] [&::-moz-range-thumb]:h-[44px] [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent [&::-moz-range-thumb]:shadow-none [&::-moz-range-thumb]:cursor-pointer";

function DualRangeSlider({
  min, max, valueMin, valueMax, onChangeMin, onChangeMax
}: {
  min: number, max: number, valueMin: number, valueMax: number,
  onChangeMin: (val: number) => void, onChangeMax: (val: number) => void
}) {
  const midpoint = (min + max) / 2;
  const fracMin = (valueMin - min) / (max - min);
  const fracMax = (valueMax - min) / (max - min);
  const minZ = valueMin > midpoint ? 5 : 3;
  const maxZ = 4;
  const inputStyleBase = { left: `-${THUMB_HALF}px`, right: `-${THUMB_HALF}px` };
  return (
    <div className="relative w-[96%] mx-auto h-5 flex items-center">
      <div className="absolute left-0 right-0 h-1.5 rounded-full bg-slate-200" />
      <div
        className="absolute h-1.5 rounded-full bg-md-primary"
        style={{
          left: `${fracMin * 100}%`,
          right: `${(1 - fracMax) * 100}%`
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={valueMin}
        onChange={(e) => onChangeMin(Math.min(Number(e.target.value), valueMax - 1))}
        className={`peer/min absolute h-full appearance-none bg-transparent pointer-events-none outline-none shadow-none ${nativeThumbClass}`}
        style={{ ...inputStyleBase, zIndex: minZ + 10 }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={valueMax}
        onChange={(e) => onChangeMax(Math.max(Number(e.target.value), valueMin + 1))}
        className={`peer/max absolute h-full appearance-none bg-transparent pointer-events-none outline-none shadow-none ${nativeThumbClass}`}
        style={{ ...inputStyleBase, zIndex: maxZ + 10 }}
      />
      <div
        className="absolute w-10 h-10 rounded-full bg-md-primary/[0.12] opacity-0 peer-hover/min:opacity-100 peer-focus/min:opacity-100 peer-active/min:opacity-100 transition-opacity duration-150 pointer-events-none"
        style={{ left: `${fracMin * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: minZ }}
      />
      <div
        className="absolute w-3 h-3 rounded-full bg-md-primary pointer-events-none"
        style={{ left: `${fracMin * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: minZ }}
      />
      <div
        className="absolute w-10 h-10 rounded-full bg-md-primary/[0.12] opacity-0 peer-hover/max:opacity-100 peer-focus/max:opacity-100 peer-active/max:opacity-100 transition-opacity duration-150 pointer-events-none"
        style={{ left: `${fracMax * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: maxZ }}
      />
      <div
        className="absolute w-3 h-3 rounded-full bg-md-primary pointer-events-none"
        style={{ left: `${fracMax * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: maxZ }}
      />
    </div>
  );
}

// Material Design checkbox: an 18px square, 2px border, filled indigo + white check
// when checked. `role="checkbox"`/`aria-checked` on a <button> since these are simple
// boolean settings toggles, not part of a <form>.
function MdCheckbox({ checked, onChange }: { checked: boolean, onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="checkbox"
      aria-checked={checked}
      className={`w-[18px] h-[18px] rounded-[2px] border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        checked ? 'bg-md-primary border-md-primary' : 'bg-white border-slate-400 hover:border-md-primary'
      }`}
    >
      {checked && <Check size={13} strokeWidth={3.5} className="text-white" />}
    </button>
  );
}

// Material Design filter chip: fully-rounded, outlined when unselected, filled indigo
// with a leading checkmark when selected — used for every multi-select filter control
// (Lessons, Word Type) so they all read as one consistent chip group.
function Chip({ selected, onClick, children }: { selected: boolean, onClick: () => void, children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors inline-flex items-center justify-center gap-1 ${
        selected
          ? 'bg-md-primary border-md-primary text-white shadow-sm'
          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {selected && <Check size={12} strokeWidth={3.5} />}
      {children}
    </button>
  );
}

export default function App() {
  const [appState, setAppState] = useState<'menu' | 'drill' | 'terms'>('menu');

  const [activeMode, setActiveMode] = useLocalStorage<'production' | 'recognition'>('nd_activeMode', 'production');

  // Persisted Settings
  const [strictPitch, setStrictPitch] = useLocalStorage('nd_strictPitch', false);
  const [useDicForm, setUseDicForm] = useLocalStorage('nd_useDicForm', false);
  const [allowMouse] = useLocalStorage('nd_allowMouse', false); // Default debug option to true
  const [selectedLessons, setSelectedLessons] = useLocalStorage<Record<string, boolean>>('nd_selectedLessons_v2', { '1': true });
  const [selectedWordTypes, setSelectedWordTypes] = useLocalStorage<Record<WordType, boolean>>('nd_selectedWordTypes_v2', { verb: true, na_adj: true, i_adj: true, noun: true, other: true });

  const [stats, setStats] = useLocalStorage<Record<string, { attempts: number, correct: number }>>('nd_stats', {});
  const [markedTerms, setMarkedTerms] = useLocalStorage<Record<string, boolean>>('nd_markedTerms', {});

  // Production (Flashcards) state
  const [fcActive, setFcActive] = useLocalStorage('nd_fcActive', false);
  const [fcMinWorking, setFcMinWorking] = useLocalStorage('nd_fcMinWorking', 5);
  const [fcMaxWorking, setFcMaxWorking] = useLocalStorage('nd_fcMaxWorking', 10);
  const [fcRecords, setFcRecords] = useLocalStorage<Record<string, FcRecord>>('nd_fcRecords', {});
  // Snapshot of the filters in effect when the active session was started — kept separate
  // from the live selectedLessons/selectedWordTypes so editing filters from the home
  // screen mid-session only affects the Terms Viewer, never the in-progress session.
  const [fcSessionLessons, setFcSessionLessons] = useLocalStorage<Record<string, boolean>>('nd_fcSessionLessons', selectedLessons);
  const [fcSessionWordTypes, setFcSessionWordTypes] = useLocalStorage<Record<WordType, boolean>>('nd_fcSessionWordTypes_v2', selectedWordTypes);

  // Extract unique lesson IDs from DICTIONARY dynamically
  const lessons = useMemo(() => {
    const ids = Array.from(new Set(DICTIONARY.map(v => v.lesson_id)));
    return ids.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, []);

  // Filter vocabulary by selected lesson + word type using the query hook (shared across both modes)
  const activeVocab = useVocabulary(selectedLessons);
  const scopedVocab = useMemo(() => filterByWordType(activeVocab, selectedWordTypes), [activeVocab, selectedWordTypes]);
  const displayVocab = useMemo(() => applyVerbForm(scopedVocab, useDicForm), [scopedVocab, useDicForm]);

  // The active/paused Production session always uses the filters snapshotted at its
  // start, regardless of what the live filters above are currently set to.
  const sessionLessonVocab = useVocabulary(fcSessionLessons);
  const sessionScopedVocab = useMemo(() => filterByWordType(sessionLessonVocab, fcSessionWordTypes), [sessionLessonVocab, fcSessionWordTypes]);
  const sessionVocab = useMemo(() => applyVerbForm(sessionScopedVocab, useDicForm), [sessionScopedVocab, useDicForm]);
  const sessionMasteredCount = useMemo(() => sessionVocab.filter(v => isMastered(fcRecords[v.id])).length, [sessionVocab, fcRecords]);

  if (appState === 'terms') {
    return (
      <TermsList
        vocabList={displayVocab}
        mode={activeMode}
        sessionActive={fcActive}
        fcRecords={fcRecords}
        markedTerms={markedTerms}
        onToggleMark={(id) => setMarkedTerms(prev => ({ ...prev, [id]: !prev[id] }))}
        onBack={() => setAppState('menu')}
      />
    );
  }

  if (appState === 'drill') {
    if (activeMode === 'production') {
      return (
        <main className="h-[100dvh] overflow-hidden bg-slate-50 p-4 md:p-8 font-sans text-slate-900 flex flex-col w-full max-w-full">
          <FlashcardEngine
            vocabList={sessionVocab}
            minWorking={fcMinWorking}
            maxWorking={fcMaxWorking}
            allowMouse={allowMouse}
            fcRecords={fcRecords}
            onUpdateFcRecord={(id, correct) => {
              setFcRecords(prev => {
                const current = prev[id] || { attempts: 0, streak: 0 };
                return {
                  ...prev,
                  [id]: {
                    attempts: current.attempts + 1,
                    streak: correct ? current.streak + 1 : 0
                  }
                };
              });
            }}
            onComplete={() => {
              setFcActive(false);
              setAppState('menu');
            }}
            onExit={() => setAppState('menu')}
          />
        </main>
      );
    }

    return (
      <main className="h-[100dvh] overflow-hidden bg-slate-50 p-4 md:p-8 font-sans text-slate-900 flex flex-col w-full max-w-full">
        <DrillEngine
          vocabList={displayVocab}
          strictPitch={strictPitch}
          stats={stats}
          onUpdateStats={(id, correct) => {
            setStats(prev => {
              const current = prev[id] || { attempts: 0, correct: 0 };
              return {
                ...prev,
                [id]: {
                  attempts: current.attempts + 1,
                  correct: current.correct + (correct ? 1 : 0)
                }
              };
            });
          }}
          onExit={() => setAppState('menu')}
        />
      </main>
    );
  }

  return (
    <main className="h-[100dvh] overflow-y-auto bg-slate-50 p-6 md:p-12 font-sans text-slate-900 flex justify-center items-start">
      <div className="w-full max-w-5xl flex flex-col min-h-full">

        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between">
          <div className="text-center md:text-left">
            <h1 className="text-4xl tracking-tight text-slate-800 mb-6" style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 }}>Pick It Up</h1>
            <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit mx-auto md:mx-0">
              <button
                onClick={() => setActiveMode('production')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeMode === 'production' ? 'bg-white shadow-sm text-md-primary' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Production
              </button>
              <button
                onClick={() => setActiveMode('recognition')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeMode === 'recognition' ? 'bg-white shadow-sm text-md-primary' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Reading Recognition
              </button>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 mt-6 md:mt-0">
            <button
              onClick={() => setAppState('terms')}
              disabled={displayVocab.length === 0}
              className="h-11 px-6 bg-white border-2 border-md-primary text-md-primary rounded-lg font-medium tracking-wide hover:bg-md-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              View Terms
            </button>
            <button
              onClick={() => {
                if (activeMode === 'production' && !fcActive) {
                  setFcActive(true);
                  setFcSessionLessons(selectedLessons);
                  setFcSessionWordTypes(selectedWordTypes);
                }
                setAppState('drill');
              }}
              disabled={(activeMode === 'production' && fcActive) ? false : displayVocab.length === 0}
              className="h-11 px-8 bg-md-primary text-white rounded-lg font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-md-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-sm"
            >
              {(activeMode === 'production' && fcActive) ? 'Resume Session' : 'Start Session'} <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="mb-6 text-center md:text-left text-sm text-slate-500 font-medium">
          {Object.values(selectedLessons).filter(Boolean).length} Lessons Selected • {displayVocab.length} terms loaded
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

          {/* Left Column: Lesson Select */}
          <div className="md:col-span-7 space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4 relative overflow-hidden">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Lessons</div>
              <div className="flex flex-wrap gap-2 mb-5">
                {lessons.map(lessonId => (
                  <Chip
                    key={lessonId}
                    selected={!!selectedLessons[lessonId]}
                    onClick={() => setSelectedLessons(prev => ({ ...prev, [lessonId]: !prev[lessonId] }))}
                  >
                    L{lessonId}
                  </Chip>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Word Type</div>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'verb',   label: 'Verbs' },
                    { key: 'na_adj', label: 'な-adj' },
                    { key: 'i_adj',  label: 'い-adj' },
                    { key: 'noun',   label: 'Nouns' },
                    { key: 'other',  label: 'Others' },
                  ] as const).map(({ key, label }) => (
                    <Chip
                      key={key}
                      selected={selectedWordTypes[key]}
                      onClick={() => setSelectedWordTypes(prev => ({ ...prev, [key]: !prev[key] }))}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Mode-specific settings, or session status while a session is active */}
          <div className="md:col-span-5">
            {fcActive ? (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Session Status</h2>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-500 tabular-nums whitespace-nowrap">{sessionMasteredCount} / {sessionVocab.length} mastered</div>
                  <button
                    onClick={() => setFcActive(false)}
                    className="flex-shrink-0 px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium text-sm hover:bg-red-100 transition-colors"
                  >
                    Discard Session
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Settings</h2>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-medium text-slate-700">Verb Form: 辞書形</div>
                    <div className="text-xs text-slate-400">Use dictionary form instead of ます form for verbs</div>
                  </div>
                  <MdCheckbox checked={useDicForm} onChange={() => setUseDicForm(!useDicForm)} />
                </div>
                {activeMode === 'recognition' ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-700">Strict Pitch Accent</div>
                      <div className="text-xs text-slate-400">Require pitch selection before next question</div>
                    </div>
                    <MdCheckbox checked={strictPitch} onChange={() => setStrictPitch(!strictPitch)} />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-slate-700">Working Terms Range</div>
                      <div className="text-sm font-semibold text-slate-800 tabular-nums">{fcMinWorking}–{fcMaxWorking}</div>
                    </div>
                    <div className="text-xs text-slate-400 mb-3">How many terms stay active in the rotation at once</div>
                    <DualRangeSlider
                      min={1}
                      max={30}
                      valueMin={fcMinWorking}
                      valueMax={fcMaxWorking}
                      onChangeMin={setFcMinWorking}
                      onChangeMax={setFcMaxWorking}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        <div className="md:hidden flex flex-col gap-3 mt-8 w-full">
          <button
            onClick={() => setAppState('terms')}
            disabled={displayVocab.length === 0}
            className="w-full py-4 bg-white border-2 border-md-primary text-md-primary rounded-lg font-medium tracking-wide hover:bg-md-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            View Terms
          </button>
          <button
            onClick={() => {
              if (activeMode === 'production' && !fcActive) {
                setFcActive(true);
                setFcSessionLessons(selectedLessons);
                setFcSessionWordTypes(selectedWordTypes);
              }
              setAppState('drill');
            }}
            disabled={(activeMode === 'production' && fcActive) ? false : displayVocab.length === 0}
            className="w-full py-4 bg-md-primary text-white rounded-lg font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-md-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {(activeMode === 'production' && fcActive) ? 'Resume Session' : 'Start Session'} <ChevronRight size={20} />
          </button>
        </div>

        <div className="mt-auto pt-12 pb-4 text-center text-xs font-medium text-slate-400 tracking-wide uppercase">
          Vocabulary list provided by Tokyo University of Foreign Studies and Kenta Li
        </div>

      </div>
    </main>
  );
}
