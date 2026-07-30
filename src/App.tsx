import { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { DICTIONARY, useVocabulary } from './dictionary';
import { DrillEngine, FlashcardEngine } from './Drills';
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

// Two overlapping range inputs, each visible only via its thumb (track is transparent),
// stacked over a shared painted track so they read as one slider with two knobs.
const sliderThumbClass = "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-800 [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-slate-800 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:cursor-pointer";

function DualRangeSlider({
  min, max, valueMin, valueMax, onChangeMin, onChangeMax
}: {
  min: number, max: number, valueMin: number, valueMax: number,
  onChangeMin: (val: number) => void, onChangeMax: (val: number) => void
}) {
  const midpoint = (min + max) / 2;
  return (
    <div className="relative w-full h-5 flex items-center">
      <div className="absolute left-0 right-0 h-1.5 rounded-full bg-slate-200" />
      <div
        className="absolute h-1.5 rounded-full bg-slate-800"
        style={{
          left: `${((valueMin - min) / (max - min)) * 100}%`,
          right: `${100 - ((valueMax - min) / (max - min)) * 100}%`
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={valueMin}
        onChange={(e) => onChangeMin(Math.min(Number(e.target.value), valueMax))}
        className={`absolute w-full h-full appearance-none bg-transparent pointer-events-none ${sliderThumbClass}`}
        style={{ zIndex: valueMin > midpoint ? 5 : 3 }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={valueMax}
        onChange={(e) => onChangeMax(Math.max(Number(e.target.value), valueMin))}
        className={`absolute w-full h-full appearance-none bg-transparent pointer-events-none ${sliderThumbClass}`}
        style={{ zIndex: 4 }}
      />
    </div>
  );
}

export default function App() {
  const [appState, setAppState] = useState<'menu' | 'drill' | 'terms'>('menu');

  const [activeMode, setActiveMode] = useLocalStorage<'production' | 'recognition'>('nd_activeMode', 'production');

  // Persisted Settings
  const [strictPitch, setStrictPitch] = useLocalStorage('nd_strictPitch', false);
  const [allowMouse] = useLocalStorage('nd_allowMouse', false); // Default debug option to true
  const [selectedLessons, setSelectedLessons] = useLocalStorage<Record<string, boolean>>('nd_selectedLessons_v2', { '1': true });

  const [stats, setStats] = useLocalStorage<Record<string, { attempts: number, correct: number }>>('nd_stats', {});
  const [masteredTerms, setMasteredTerms] = useLocalStorage<Record<string, boolean>>('nd_masteredTerms', {});
  const [markedTerms, setMarkedTerms] = useLocalStorage<Record<string, boolean>>('nd_markedTerms', {});

  // Production (Flashcards) state
  const [fcActive, setFcActive] = useLocalStorage('nd_fcActive', false);
  const [fcMinWorking, setFcMinWorking] = useLocalStorage('nd_fcMinWorking', 5);
  const [fcMaxWorking, setFcMaxWorking] = useLocalStorage('nd_fcMaxWorking', 10);
  const [fcRecords, setFcRecords] = useLocalStorage<Record<string, FcRecord>>('nd_fcRecords', {});

  // Extract unique lesson IDs from DICTIONARY dynamically
  const lessons = useMemo(() => {
    const ids = Array.from(new Set(DICTIONARY.map(v => v.lesson_id)));
    return ids.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, []);

  // Filter vocabulary by selected lesson using the query hook (shared across both modes)
  const activeVocab = useVocabulary(selectedLessons);

  if (appState === 'terms') {
    return (
      <TermsList
        vocabList={activeVocab}
        stats={stats}
        masteredTerms={masteredTerms}
        onToggleMastered={(id) => setMasteredTerms(prev => ({ ...prev, [id]: !prev[id] }))}
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
            vocabList={activeVocab.filter(v => !masteredTerms[v.id])}
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
            onSkip={(id) => setMasteredTerms(prev => ({ ...prev, [id]: true }))}
            onComplete={() => {
              setFcActive(false);
              setAppState('menu');
            }}
            onExit={() => {
              setFcActive(false);
              setAppState('menu');
            }}
          />
        </main>
      );
    }

    return (
      <main className="h-[100dvh] overflow-hidden bg-slate-50 p-4 md:p-8 font-sans text-slate-900 flex flex-col w-full max-w-full">
        <DrillEngine
          vocabList={activeVocab.filter(v => !masteredTerms[v.id])}
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
          onSkip={(id) => setMasteredTerms(prev => ({ ...prev, [id]: true }))}
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
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeMode === 'production' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Production
              </button>
              <button
                onClick={() => setActiveMode('recognition')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeMode === 'recognition' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Reading Recognition
              </button>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 mt-6 md:mt-0">
            <button
              onClick={() => setAppState('terms')}
              disabled={activeVocab.length === 0}
              className="h-11 px-6 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium tracking-wide hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
            >
              View Terms
            </button>
            <button
              onClick={() => {
                if (activeMode === 'production' && !fcActive) {
                  setFcActive(true);
                }
                setAppState('drill');
              }}
              disabled={activeVocab.length === 0}
              className="h-11 px-8 bg-slate-800 text-white rounded-xl font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-sm"
            >
              {(activeMode === 'production' && fcActive) ? 'Resume Session' : 'Start Session'} <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="mb-6 text-center md:text-left text-sm text-slate-500 font-medium">
          {Object.values(selectedLessons).filter(Boolean).length} Lessons Selected • {activeVocab.length} terms loaded
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

          {/* Left Column: Lesson Select */}
          <div className="md:col-span-7 space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4 relative overflow-hidden">
              {fcActive && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
                  <div className="text-slate-800 font-semibold mb-2">Session in Progress</div>
                  <div className="text-slate-500 text-sm mb-4">You must complete or discard the active session to change its scope.</div>
                  <button
                    onClick={() => setFcActive(false)}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium text-sm hover:bg-red-100 transition-colors"
                  >
                    Discard Session
                  </button>
                </div>
              )}
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Select Lesson</h2>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {lessons.map(lessonId => {
                  const isSelected = selectedLessons[lessonId];
                  return (
                    <button
                      key={lessonId}
                      onClick={() => setSelectedLessons(prev => ({ ...prev, [lessonId]: !prev[lessonId] }))}
                      className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      L {lessonId}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Mode-specific settings */}
          <div className="md:col-span-5">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Settings</h2>
              {activeMode === 'recognition' ? (
                <button
                  onClick={() => setStrictPitch(!strictPitch)}
                  className="w-full text-left flex items-center justify-between p-2 cursor-pointer hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <div className="pointer-events-none">
                    <div className="font-medium text-slate-700">Strict Pitch Accent</div>
                    <div className="text-xs text-slate-400">Require pitch selection before next question</div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative pointer-events-none ${strictPitch ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${strictPitch ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              ) : (
                <div className={`${fcActive ? 'opacity-50 pointer-events-none' : ''}`}>
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
          </div>

        </div>

        <div className="md:hidden flex flex-col gap-3 mt-8 w-full">
          <button
            onClick={() => setAppState('terms')}
            disabled={activeVocab.length === 0}
            className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-medium tracking-wide hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            View Terms
          </button>
          <button
            onClick={() => {
              if (activeMode === 'production' && !fcActive) {
                setFcActive(true);
              }
              setAppState('drill');
            }}
            disabled={activeVocab.length === 0}
            className="w-full py-4 bg-slate-800 text-white rounded-2xl font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
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
