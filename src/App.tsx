import { useState, useMemo } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { DICTIONARY, useVocabulary } from './dictionary';
import { DrillEngine } from './Drills';

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
  const [appState, setAppState] = useState<'menu' | 'drill'>('menu');
  
  const [activeTab, setActiveTab] = useLocalStorage<'meaning' | 'alphabets'>('nd_activeTab', 'meaning');
  
  // Persisted Settings
  const [strictPitch, setStrictPitch] = useLocalStorage('nd_strictPitch', false);
  const [allowMouse, setAllowMouse] = useLocalStorage('nd_allowMouse', false); // Default debug option to true
  const [selectedLesson, setSelectedLesson] = useLocalStorage<string>('nd_selectedLesson', 'all');
  
  const [selectedAlphabetSystems, setSelectedAlphabetSystems] = useLocalStorage<Record<string, boolean>>('nd_alphabetSystems', {
    'hiragana': true,
    'katakana': true,
    'mixed': true,
  });

  const [selectedModes, setSelectedModes] = useLocalStorage<Record<string, boolean>>('nd_selectedModes', {
    'term-meaning': true,
    'meaning-reading': true,
  });
  
  const [stats, setStats] = useLocalStorage<Record<string, { attempts: number, correct: number }>>('nd_stats', {});

  const availableModes = [
    { id: 'term-meaning', label: 'Term → Meaning', type: 'Recognition' },
    { id: 'reading-meaning', label: 'Reading → Meaning', type: 'Recognition' },
    { id: 'meaning-term-rec', label: 'Meaning → Term', type: 'Recognition' },
    { id: 'meaning-reading-rec', label: 'Meaning → Reading', type: 'Recognition' },
    { id: 'meaning-term', label: 'Meaning → Term', type: 'Production (Write)' },
    { id: 'meaning-reading', label: 'Meaning → Reading', type: 'Production (Write)' },
  ];

  const activeModes = Object.entries(selectedModes).filter(([_, active]) => active).map(([id]) => id);

  // Extract unique lesson IDs from DICTIONARY dynamically
  const lessons = useMemo(() => {
    const ids = Array.from(new Set(DICTIONARY.map(v => v.lesson_id)));
    return ids.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, []);

  // Filter vocabulary by selected lesson using the query hook
  const baseFilteredVocab = useVocabulary(selectedLesson);
  const alphabetsVocab = useMemo(() => {
    return DICTIONARY.filter(v => selectedAlphabetSystems[v.system]);
  }, [selectedAlphabetSystems]);

  const activeVocab = activeTab === 'meaning' ? baseFilteredVocab : alphabetsVocab;
  const computedActiveModes = activeTab === 'meaning' ? activeModes : ['romaji-reading'];

  if (appState === 'drill') {
    return (
      <main className="h-[100dvh] overflow-hidden bg-slate-50 p-4 md:p-8 font-sans text-slate-900 flex flex-col w-full max-w-full">
        <DrillEngine 
          vocabList={activeVocab} 
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
            <h1 className="text-4xl font-light tracking-tight text-slate-800 mb-6">Pick It Up</h1>
            <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit mx-auto md:mx-0">
              <button 
                onClick={() => setActiveTab('meaning')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'meaning' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Meanings
              </button>
              <button 
                onClick={() => setActiveTab('alphabets')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'alphabets' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Glyphs
              </button>
            </div>
          </div>
          <button 
            onClick={() => setAppState('drill')}
            disabled={computedActiveModes.length === 0 || activeVocab.length === 0}
            className="hidden md:flex h-11 px-8 mt-6 md:mt-0 bg-slate-800 text-white rounded-xl font-medium tracking-wide items-center justify-center gap-2 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-sm"
          >
            Start Session <ChevronRight size={18} />
          </button>
        </div>

        <div className="mb-6 text-center md:text-left text-sm text-slate-500 font-medium">
          {activeTab === 'meaning' ? (selectedLesson === 'all' ? 'All Lessons' : `Lesson ${selectedLesson}`) : 'All Lessons (Glyphs)'} • {activeVocab.length} terms loaded
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Left Column: Lesson Select & Settings */}
          <div className="md:col-span-7 space-y-4">
            {/* Lesson or System Selection UI */}
            {activeTab === 'meaning' ? (
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Select Lesson</h2>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  <button
                    onClick={() => setSelectedLesson('all')}
                    className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                      selectedLesson === 'all'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {lessons.map(lessonId => (
                    <button
                      key={lessonId}
                      onClick={() => setSelectedLesson(lessonId)}
                      className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                        selectedLesson === lessonId
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
                  {['hiragana', 'katakana', 'mixed'].map(sys => (
                    <label key={sys} className="flex items-center p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                      <button 
                        className={`w-4 h-4 rounded-md flex items-center justify-center mr-3 transition-colors ${selectedAlphabetSystems[sys] ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-300'}`}
                        onClick={() => setSelectedAlphabetSystems(prev => ({ ...prev, [sys]: !prev[sys] }))}
                      >
                        {selectedAlphabetSystems[sys] && <Check size={12} strokeWidth={3} />}
                      </button>
                      <div className="text-sm font-medium text-slate-700 capitalize">{sys}</div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-6">
           <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Settings</h2>
           
           {activeTab === 'meaning' && (
             <label className="flex items-center justify-between p-2 cursor-pointer mb-4 hover:bg-slate-50 rounded-xl transition-colors">
               <div>
                  <div className="font-medium text-slate-700">Strict Pitch Accent</div>
                  <div className="text-xs text-slate-400">Require pitch selection before next question</div>
               </div>
               <button 
                  className={`w-12 h-6 rounded-full transition-colors relative ${strictPitch ? 'bg-slate-800' : 'bg-slate-200'}`}
                  onClick={() => setStrictPitch(!strictPitch)}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${strictPitch ? 'translate-x-6' : 'translate-x-0.5'}`} />
               </button>
             </label>
           )}

           <label className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-50 rounded-xl transition-colors">
                 <div>
                    <div className="font-medium text-slate-700">Debug: Allow Mouse</div>
                    <div className="text-xs text-slate-400">Draw with trackpad/mouse (for desktop testing)</div>
                 </div>
                 <button 
                    className={`w-12 h-6 rounded-full transition-colors relative ${allowMouse ? 'bg-orange-500' : 'bg-slate-200'}`}
                    onClick={() => setAllowMouse(!allowMouse)}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${allowMouse ? 'translate-x-6' : 'translate-x-0.5'}`} />
                 </button>
               </label>
            </div>
          </div>

          {/* Right Column: Modes Selection */}
          {activeTab === 'meaning' && (
            <div className="md:col-span-5">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 h-full">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Modes</h2>
                <div className="space-y-0">
                  {availableModes.map(mode => (
                    <label key={mode.id} className="flex items-center p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                      <button 
                        className={`w-4 h-4 rounded-md flex items-center justify-center mr-3 transition-colors ${selectedModes[mode.id] ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-300'}`}
                        onClick={() => setSelectedModes(prev => ({ ...prev, [mode.id]: !prev[mode.id] }))}
                      >
                        {selectedModes[mode.id] && <Check size={12} strokeWidth={3} />}
                      </button>
                      <div className="flex-1 flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-700">{mode.label}</div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">{mode.type}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          
        </div>

        <button 
          onClick={() => setAppState('drill')}
          disabled={computedActiveModes.length === 0 || activeVocab.length === 0}
          className="md:hidden mt-8 w-full py-4 bg-slate-800 text-white rounded-2xl font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
        >
          Start Session <ChevronRight size={20} />
        </button>

        <div className="mt-auto pt-12 pb-4 text-center text-xs font-medium text-slate-400 tracking-wide uppercase">
          Vocabulary list provided by Tokyo University of Foreign Studies and Kenta Li
        </div>

      </div>
    </main>
  );
}