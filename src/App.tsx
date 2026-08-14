import { useState, useMemo, type ReactNode } from 'react';
import { Trash2, BookOpen, Search, Settings as SettingsIcon } from 'lucide-react';
import { DICTIONARY, useVocabulary, applyVerbForm, filterByWordType, WORD_TYPE_LABELS } from './dictionary';
import type { WordType } from './dictionary';
import { DrillEngine, FlashcardEngine, isMastered } from './Drills';
import type { FcRecord } from './Drills';
import { TermsList } from './TermsList';
import { TextButton } from './Button';
import { Card, SectionLabel } from './Card';
import { Chip } from './Chip';
import { ModeSwitch } from './ModeSwitch';
import { SearchSheet } from './SearchSheet';
import { Settings } from './Settings';
import { useLocalStorage } from './useLocalStorage';

// The circular, unfilled icon buttons in the header — Search and Settings. Both are
// navigational, not "do a thing" actions, so neither gets the filled/colored treatment
// the app reserves for major clickables (the mode buttons, the status pill's View
// button) — an icon-only button reads as navigation by convention already, without
// needing a fill on top of that.
function HeaderIconButton({ onClick, label, children }: { onClick: () => void, label: string, children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-800/[0.06] hover:text-slate-800 transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

// The single status row sitting below the mode buttons — this is what used to be a
// plain "X Lessons Selected • Y terms loaded" subtitle, now doing double duty as the
// entry point to the Terms Viewer (View) and, once a Production session is paused,
// the discard control too. One row, content swaps on `sessionActive` rather than two
// separate rows stacking (which would just repeat "how many terms" twice — the mastered
// count already implies the total).
// Both View and Discard are plain text buttons — same weight, since neither is more
// "the" action of this row than the other. On phone widths both drop their labels down
// to a bare icon, matching their own unfilled desktop style, just without the word.
function StatusPill({
  sessionActive, masteredCount, termsCount, lessonsCount, onViewTerms, onDiscard, viewDisabled
}: {
  sessionActive: boolean,
  masteredCount: number,
  termsCount: number,
  lessonsCount: number,
  onViewTerms: () => void,
  onDiscard: () => void,
  viewDisabled: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl pl-3.5 pr-2.5 py-2 mt-4">
      <div className="min-w-0 truncate text-xs text-slate-500 tabular-nums">
        {sessionActive ? <>{masteredCount} / {termsCount} mastered</> : <>{lessonsCount} Lessons · {termsCount} terms loaded</>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {sessionActive && (
          <>
            <div className="hidden md:block">
              <TextButton variant="pink" onClick={onDiscard}>
                <Trash2 size={16} strokeWidth={2} /> Discard
              </TextButton>
            </div>
            <div className="md:hidden">
              <button
                onClick={onDiscard}
                aria-label="Discard session"
                className="w-8 h-8 rounded-full flex items-center justify-center text-md-accent active:bg-md-accent/[0.12] transition-colors cursor-pointer"
              >
                <Trash2 size={15} strokeWidth={2} />
              </button>
            </div>
          </>
        )}
        <div className="hidden md:block">
          <TextButton variant="neutral" onClick={onViewTerms} disabled={viewDisabled}>
            <BookOpen size={16} strokeWidth={2} /> View
          </TextButton>
        </div>
        <div className="md:hidden">
          <button
            onClick={onViewTerms}
            disabled={viewDisabled}
            aria-label="View terms"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-700 active:bg-slate-800/[0.12] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <BookOpen size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [appState, setAppState] = useState<'menu' | 'drill' | 'terms'>('menu');
  // Global Search's and Settings' bottom sheets — plain component state, not
  // persisted, since both are momentary overlays (opened from the header's icons)
  // rather than real navigation destinations.
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // Extract unique lesson IDs from DICTIONARY dynamically
  const lessons = useMemo(() => {
    const ids = Array.from(new Set(DICTIONARY.map(v => v.lesson_id)));
    return ids.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, []);

  // Filter vocabulary by selected lesson + word type using the query hook (shared across both modes)
  const activeVocab = useVocabulary(selectedLessons);
  const scopedVocab = useMemo(() => filterByWordType(activeVocab, selectedWordTypes), [activeVocab, selectedWordTypes]);
  // Also what an active/paused Production session drills — the Lessons/Word Type
  // chips are disabled for the whole lifetime of a session (see the Chip usages
  // below), so `selectedLessons`/`selectedWordTypes` can no longer drift from what
  // the session started with. That used to require a separate snapshot
  // (`fcSessionLessons`/`fcSessionWordTypes`) to protect against; freezing the chips
  // makes the snapshot redundant, since the live scope IS the session's scope now.
  const displayVocab = useMemo(() => applyVerbForm(scopedVocab, useDicForm), [scopedVocab, useDicForm]);
  const sessionMasteredCount = useMemo(() => displayVocab.filter(v => isMastered(fcRecords[v.id])).length, [displayVocab, fcRecords]);

  // Tapping either mode button launches (or, for Production, resumes) that mode
  // directly — no separate "select a mode" step first, so this both records which mode
  // was tapped and launches it in the same call.
  const handleLaunchSession = (mode: 'production' | 'recognition') => {
    setActiveMode(mode);
    if (mode === 'production' && !fcActive) {
      setFcActive(true);
      setFcRecords({});
    }
    setAppState('drill');
  };
  // Production stays launchable whenever a session is already paused (resuming a
  // frozen, previously-valid scope never needs a non-empty check); Recognition has no
  // paused state, so it's disabled outright whenever the current scope is empty.
  const productionDisabled = !fcActive && displayVocab.length === 0;
  const recognitionDisabled = displayVocab.length === 0;

  if (appState === 'terms') {
    return (
      <TermsList
        vocabList={scopedVocab}
        defaultUseDicForm={true}
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
            vocabList={displayVocab}
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
    <main className="h-[100dvh] overflow-y-auto overscroll-y-contain bg-slate-50 p-6 md:p-12 font-sans text-slate-900 flex justify-center items-start">
      <div className="w-full max-w-2xl flex flex-col min-h-full">

        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-4xl tracking-tight text-slate-800" style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 }}>Pick It Up</h1>
          <div className="flex items-center gap-1">
            <HeaderIconButton onClick={() => setSearchSheetOpen(true)} label="Search">
              <Search size={19} strokeWidth={2} />
            </HeaderIconButton>
            <HeaderIconButton onClick={() => setSettingsOpen(true)} label="Settings">
              <SettingsIcon size={19} strokeWidth={2} />
            </HeaderIconButton>
          </div>
        </div>

        {/* One card now holds the whole session-setup flow — Lessons/Word Type, the
            mode buttons, and the status pill (View Terms, plus Discard once a session
            is paused) below them — rather than splitting scope config and mode config
            across two side-by-side cards. Verb Form, Working Terms Range, and Strict
            Pitch Accent all moved out to Settings: none of them change every session
            the way Lessons/Word Type do, so they no longer need to compete for space
            here. */}
        <Card>
          {/* Frozen (not hidden) while a session is active/paused — Lessons/Word Type
              can no longer drift from what a running session actually locked in, so
              freezing them here doubles as the drilling scope's display: what you see
              is exactly what's being drilled, no separate summary needed. */}
          <SectionLabel>Lessons</SectionLabel>
          <div className="flex flex-wrap gap-2 mb-6">
            {lessons.map(lessonId => (
              <Chip
                key={lessonId}
                selected={!!selectedLessons[lessonId]}
                onClick={() => setSelectedLessons(prev => ({ ...prev, [lessonId]: !prev[lessonId] }))}
                disabled={fcActive}
              >
                L{lessonId}
              </Chip>
            ))}
          </div>

          <SectionLabel>Word Type</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(WORD_TYPE_LABELS) as WordType[]).map((key) => (
              <Chip
                key={key}
                selected={selectedWordTypes[key]}
                onClick={() => setSelectedWordTypes(prev => ({ ...prev, [key]: !prev[key] }))}
                disabled={fcActive}
              >
                {WORD_TYPE_LABELS[key]}
              </Chip>
            ))}
          </div>

          <div className="border-t border-slate-100 -mx-5 my-5" />

          <ModeSwitch
            onLaunch={handleLaunchSession}
            productionDisabled={productionDisabled}
            recognitionDisabled={recognitionDisabled}
            resuming={fcActive}
          />

          <StatusPill
            sessionActive={fcActive}
            masteredCount={sessionMasteredCount}
            termsCount={displayVocab.length}
            lessonsCount={Object.values(selectedLessons).filter(Boolean).length}
            onViewTerms={() => setAppState('terms')}
            onDiscard={() => {
              setFcActive(false);
              setFcRecords({});
            }}
            viewDisabled={displayVocab.length === 0}
          />
        </Card>

        <div className="mt-auto pt-12 pb-1 text-center text-[11px] font-normal text-slate-400 tracking-wide uppercase">
          Vocabulary list provided by Tokyo University of Foreign Studies and Kenta Li
        </div>

      </div>

      <SearchSheet
        open={searchSheetOpen}
        onClose={() => setSearchSheetOpen(false)}
        markedTerms={markedTerms}
        onToggleMark={(id) => setMarkedTerms(prev => ({ ...prev, [id]: !prev[id] }))}
      />

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        useDicForm={useDicForm}
        onSetUseDicForm={setUseDicForm}
        sessionActive={fcActive}
        fcMinWorking={fcMinWorking}
        fcMaxWorking={fcMaxWorking}
        onChangeFcMinWorking={setFcMinWorking}
        onChangeFcMaxWorking={setFcMaxWorking}
        strictPitch={strictPitch}
        onToggleStrictPitch={() => setStrictPitch(v => !v)}
      />
    </main>
  );
}
