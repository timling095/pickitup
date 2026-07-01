import { useState, useMemo } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { DICTIONARY, useVocabulary } from './dictionary';
import { DrillEngine } from './Drills';
import { TermsList } from './TermsList';

// Custom hook to persist state in localStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
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

export default function App() {
  const [appState, setAppState] = useState<'menu' | 'drill' | 'terms'>('menu');
  
  const [activeTab, setActiveTab] = useLocalStorage<'meaning' | 'alphabets'>('nd_activeTab', 'meaning');
  
  // Persisted Settings
  const [strictPitch, setStrictPitch] = useLocalStorage('nd_strictPitch', false);
  const [allowMouse] = useLocalStorage('nd_allowMouse', false); // Default debug option to true
  const [selectedLessons, setSelectedLessons] = useLocalStorage<Record<string, boolean>>('nd_selectedLessons_v2', { '1': true });
  
  const [selectedAlphabetSystem, setSelectedAlphabetSystem] = useLocalStorage<'hiragana' | 'katakana'>('nd_alphabetSystem_v2', 'hiragana');

  const [selectedModes, setSelectedModes] = useLocalStorage<Record<string, boolean>>('nd_selectedModes', {
    'term-meaning': true,
    'meaning-reading': true,
  });
  
  const [stats, setStats] = useLocalStorage<Record<string, { attempts: number, correct: number }>>('nd_stats', {});
  const [skippedTerms, setSkippedTerms] = useLocalStorage<Record<string, boolean>>('nd_skippedTerms', {});

  const availableModes = [
    { id: 'term-meaning', label: 'Term → Meaning', type: 'Recognition' },
    { id: 'reading-meaning', label: 'Reading → Meaning', type: 'Recognition' },
    { id: 'meaning-term-rec', label: 'Meaning → Term', type: 'Recognition' },
    { id: 'meaning-reading-rec', label: 'Meaning → Reading', type: 'Recognition' },
    { id: 'meaning-term', label: 'Meaning → Term', type: 'Write' },
    { id: 'meaning-reading', label: 'Meaning → Reading', type: 'Write' },
  ];

  const activeModes = Object.entries(selectedModes)
    .filter(([id, active]) => active && availableModes.some(m => m.id === id))
    .map(([id]) => id);

  // Extract unique lesson IDs from DICTIONARY dynamically
  const lessons = useMemo(() => {
    const ids = Array.from(new Set(DICTIONARY.map(v => v.lesson_id)));
    return ids.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, []);

  // Filter vocabulary by selected lesson using the query hook
  const baseFilteredVocab = useVocabulary(selectedLessons);
  const alphabetsVocab = useMemo(() => {
    return DICTIONARY.filter(v => v.system === selectedAlphabetSystem);
  }, [selectedAlphabetSystem]);

  const activeVocab = activeTab === 'meaning' ? baseFilteredVocab : alphabetsVocab;
  const computedActiveModes = activeTab === 'meaning' ? activeModes : ['romaji-reading'];

  if (appState === 'terms') {
    return (
      <TermsList 
        vocabList={activeVocab} 
        stats={stats} 
        skippedTerms={skippedTerms}
        onSkip={(id) => setSkippedTerms(prev => ({ ...prev, [id]: true }))}
        onUnskip={(id) => setSkippedTerms(prev => ({ ...prev, [id]: false }))}
        onBack={() => setAppState('menu')} 
      />
    );
  }

  if (appState === 'drill') {
    return (
      <main className="h-[100dvh] overflow-hidden bg-slate-50 p-4 md:p-8 font-sans text-slate-900 flex flex-col w-full max-w-full">
        <DrillEngine 
          vocabList={activeVocab.filter(v => !skippedTerms[v.id])} 
          modes={computedActiveModes} 
          strictPitch={strictPitch}
          allowMouse={allowMouse}
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
          onSkip={(id) => setSkippedTerms(prev => ({ ...prev, [id]: true }))}
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
                onClick={() => setActiveTab('meaning')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'meaning' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Terms
              </button>
              <button 
                onClick={() => setActiveTab('alphabets')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'alphabets' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Glyphs
              </button>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 mt-6 md:mt-0">
            {activeTab === 'meaning' && (
              <button
                onClick={() => setAppState('terms')}
                disabled={activeVocab.length === 0}
                className="h-11 px-6 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium tracking-wide hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
              >
                View Terms
              </button>
            )}
            <button 
              onClick={() => setAppState('drill')}
              disabled={computedActiveModes.length === 0 || activeVocab.length === 0}
              className="h-11 px-8 bg-slate-800 text-white rounded-xl font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-sm"
            >
              Start Session <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="mb-6 text-center md:text-left text-sm text-slate-500 font-medium">
          {activeTab === 'meaning' ? `${Object.values(selectedLessons).filter(Boolean).length} Lessons Selected` : 'All Lessons (Glyphs)'} • {activeVocab.length} terms loaded
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Left Column: Lesson Select & Settings */}
          <div className="md:col-span-7 space-y-4">
            {/* Lesson or System Selection UI */}
            {activeTab === 'meaning' ? (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Select Lesson</h2>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {lessons.map(lessonId => (
                    <button
                      key={lessonId}
                      onClick={() => setSelectedLessons(prev => ({ ...prev, [lessonId]: !prev[lessonId] }))}
                      className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                        selectedLessons[lessonId]
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      L {lessonId}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Systems</h2>
                <div className="space-y-0">
                  {['hiragana', 'katakana'].map(sys => (
                    <button 
                      key={sys}
                      onClick={() => setSelectedAlphabetSystem(sys as any)}
                      className="w-full text-left flex items-center p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100"
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center mr-3 transition-colors border ${selectedAlphabetSystem === sys ? 'border-slate-800 bg-slate-800' : 'border-slate-300 bg-transparent'}`}>
                        {selectedAlphabetSystem === sys && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div className="text-sm font-medium text-slate-700 capitalize pointer-events-none">{sys}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'meaning' && (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-6">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Settings</h2>
                <button 
                  onClick={() => setStrictPitch(!strictPitch)}
                  className="w-full text-left flex items-center justify-between p-2 cursor-pointer mb-4 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <div className="pointer-events-none">
                    <div className="font-medium text-slate-700">Strict Pitch Accent</div>
                    <div className="text-xs text-slate-400">Require pitch selection before next question</div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative pointer-events-none ${strictPitch ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${strictPitch ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Modes Selection */}
          {activeTab === 'meaning' && (
            <div className="md:col-span-5">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 h-full">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Modes</h2>
                <div className="space-y-0">
                  {availableModes.map(mode => (
                    <button 
                      key={mode.id}
                      onClick={() => setSelectedModes(prev => ({ ...prev, [mode.id]: !prev[mode.id] }))}
                      className="w-full text-left flex items-center p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100"
                    >
                      <div className={`w-4 h-4 rounded-md flex items-center justify-center mr-3 transition-colors ${selectedModes[mode.id] ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-300'}`}>
                        {selectedModes[mode.id] && <Check size={12} strokeWidth={3} />}
                      </div>
                      <div className="flex-1 flex items-center justify-between pointer-events-none">
                        <div className="text-sm font-medium text-slate-700">{mode.label}</div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">{mode.type}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
        </div>

        <div className="md:hidden flex flex-col gap-3 mt-8 w-full">
          {activeTab === 'meaning' && (
            <button
              onClick={() => setAppState('terms')}
              disabled={activeVocab.length === 0}
              className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-medium tracking-wide hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              View Terms
            </button>
          )}
          <button 
            onClick={() => setAppState('drill')}
            disabled={computedActiveModes.length === 0 || activeVocab.length === 0}
            className="w-full py-4 bg-slate-800 text-white rounded-2xl font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            Start Session <ChevronRight size={20} />
          </button>
        </div>

        <div className="mt-auto pt-12 pb-4 text-center text-xs font-medium text-slate-400 tracking-wide uppercase">
          Vocabulary list provided by Tokyo University of Foreign Studies and Kenta Li
        </div>

      </div>
    </main>
  );
}