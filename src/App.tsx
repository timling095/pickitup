import { useState, useMemo, type ReactNode } from 'react';
import { Check, BookOpen, ChevronRight, Trash2 } from 'lucide-react';
import { DICTIONARY, useVocabulary, applyVerbForm, filterByWordType } from './dictionary';
import type { WordType } from './dictionary';
import { DrillEngine, FlashcardEngine, isMastered } from './Drills';
import type { FcRecord } from './Drills';
import { TermsList } from './TermsList';
import { TextButton } from './Button';
import { ModeSwitch } from './ModeSwitch';
import { MdCheckbox } from './MdCheckbox';
import { useLocalStorage } from './useLocalStorage';

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
      <div className="absolute left-0 right-0 h-1 rounded-full bg-slate-200" />
      <div
        className="absolute h-1.5 rounded-full bg-slate-800"
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
        className="absolute w-10 h-10 rounded-full bg-slate-800/[0.12] opacity-0 peer-hover/min:opacity-100 peer-focus/min:opacity-100 peer-active/min:opacity-100 transition-opacity duration-150 pointer-events-none"
        style={{ left: `${fracMin * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: minZ }}
      />
      <div
        className="absolute w-3 h-3 rounded-full bg-slate-800 pointer-events-none"
        style={{ left: `${fracMin * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: minZ }}
      />
      <div
        className="absolute w-10 h-10 rounded-full bg-slate-800/[0.12] opacity-0 peer-hover/max:opacity-100 peer-focus/max:opacity-100 peer-active/max:opacity-100 transition-opacity duration-150 pointer-events-none"
        style={{ left: `${fracMax * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: maxZ }}
      />
      <div
        className="absolute w-3 h-3 rounded-full bg-slate-800 pointer-events-none"
        style={{ left: `${fracMax * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: maxZ }}
      />
    </div>
  );
}

// Material Design filter chip: fully-rounded, neutral grayscale in both states — MD2
// filter chips don't need the primary/accent color at all, and selecting one never
// inverts its text to white; the darker tonal fill + leading checkmark alone communicate
// "selected". Used for every multi-select filter control (Lessons, Word Type) so they
// all read as one consistent chip group.
function Chip({ selected, onClick, children }: { selected: boolean, onClick: () => void, children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors cursor-pointer inline-flex items-center justify-center gap-1 ${
        selected
          ? 'bg-slate-200 border-slate-200 text-slate-800'
          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {selected && <Check size={12} strokeWidth={3.5} />}
      {children}
    </button>
  );
}

// Choice chip: same shape/coloring as Chip, but for a single-select group where exactly
// one option is always active — no checkmark, since "selected" here means "the current
// choice", not "added to a set".
function ChoiceChip({ selected, onClick, children }: { selected: boolean, onClick: () => void, children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors cursor-pointer inline-flex items-center justify-center ${
        selected
          ? 'bg-slate-200 border-slate-200 text-slate-800'
          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
    >
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

  // Shared by both ModeSwitch instances (Session Status card and Settings card) —
  // tapping the switch's active side now does what the old Start/Resume Session
  // button did.
  const handleLaunchSession = () => {
    if (activeMode === 'production' && !fcActive) {
      setFcActive(true);
      setFcSessionLessons(selectedLessons);
      setFcSessionWordTypes(selectedWordTypes);
      setFcRecords({});
    }
    setAppState('drill');
  };
  const launchResuming = activeMode === 'production' && fcActive;
  const launchDisabled = launchResuming ? false : displayVocab.length === 0;

  if (appState === 'terms') {
    return (
      <TermsList
        vocabList={scopedVocab}
        defaultUseDicForm={useDicForm}
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
    <main className="h-[100dvh] overflow-y-auto overscroll-y-contain bg-slate-50 p-6 md:p-12 font-sans text-slate-900 flex justify-center items-start">
      <div className="w-full max-w-5xl flex flex-col min-h-full">

        <div className="mb-6">
          <h1 className="text-4xl tracking-tight text-slate-800 text-center sm:text-left" style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 }}>Pick It Up</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

          {/* Left Column: Lesson Select */}
          <div className="md:col-span-6 space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4 relative overflow-hidden">
              {/* Actionable title: a main title + a small action prompt underneath, both
                  inside one interactive slab — same treatment (and size) as a single
                  ModeSwitch lever SIDE, not the full track: bg-slate-800, rounded-xl,
                  shadow-md, bold label + caption, both centered, at roughly half the
                  card's width, sitting at the card's left edge — same object, same
                  proportions, just one action instead of two. The subtitle below it —
                  which briefly explains what's going on, not what tapping it does —
                  lives outside the button, left-aligned under it, same mt-3 gap as the
                  Drill card's subtitle below its lever. */}
              <button
                onClick={() => setAppState('terms')}
                disabled={displayVocab.length === 0}
                className="w-full h-[62px] rounded-xl bg-slate-800 text-white shadow-md flex flex-col items-center justify-center cursor-pointer active:scale-95 transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="flex items-center gap-1.5 text-base font-medium">
                  <BookOpen size={18} strokeWidth={2} />
                  Glossary
                </span>
                <span className="flex items-center gap-0.5 text-[10px] font-normal text-white/60 mt-0.5">
                  View Terms
                  <ChevronRight size={9} strokeWidth={2} />
                </span>
              </button>
              <div className="text-xs text-slate-400 text-left mt-3">
                {Object.values(selectedLessons).filter(Boolean).length} Lessons Selected • {displayVocab.length} terms loaded
              </div>

              <div className="border-t border-slate-100 -mx-5 my-5" />

              <div className="font-medium text-slate-700 mb-3">Lessons</div>
              <div className="flex flex-wrap gap-2 mb-7">
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

              <div>
                <div className="font-medium text-slate-700 mb-3">Word Type</div>
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

          {/* Right Column: mode-switch card. Kept as ONE persistent card/ModeSwitch/
              sliding-panel structure regardless of session state — only the content
              inside the "production slot" of the sliding panel varies (Working Terms
              Range when idle, Discard Drill when a session is active). Splitting this
              into two entirely different top-level branches (as it used to be) meant
              switching Production↔Recognition while a session was active hard-cut
              between disconnected DOM trees instead of sliding, unlike every other
              lever-driven transition in the app. */}
          <div className="md:col-span-6">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
              {/* No separate card title here, by design — ModeSwitch's own
                  Production/Recognition labels + captions already function as this
                  card's actionable title, mirroring the Glossary button. The subtitle
                  below uses the same mt-3 gap and left alignment as Glossary's.
                  py-[9px] wrapper: the lever visually overshoots its own track by 9px
                  top/bottom (see ModeSwitch's absolute -9px lever offsets) — the track's
                  own flow-box doesn't account for that, so a plain margin on either the
                  track or this subtitle would partially collapse away (adjacent-sibling
                  margins collapse to their max, not their sum). Padding on a wrapper
                  never collapses, so it's what actually reserves the lever's true 9px
                  of extra visual space on both sides, measured off the *lever*, not the
                  track's own (smaller) box. */}
              <div className="py-[9px]">
                <ModeSwitch
                  activeMode={activeMode}
                  onChangeMode={setActiveMode}
                  onLaunch={handleLaunchSession}
                  launchDisabled={launchDisabled}
                  resuming={launchResuming}
                />
              </div>
              <div className="text-xs text-slate-400 text-left mt-3">
                {activeMode === 'production' && fcActive
                  ? `${sessionMasteredCount} / ${sessionVocab.length} mastered`
                  : 'Load terms from the glossary'}
              </div>
              <div className="border-t border-slate-100 -mx-5 my-5" />
              {/* Both panels stay mounted, stacked in the same grid cell, and slide
                  fully past each other, each one exiting in the direction the lever
                  just moved while the other enters from the opposite edge, so the
                  bottom of the card visibly "follows" the switch instead of hard-
                  cutting between two unrelated pieces of content. Each panel gets an
                  opaque white background so the one sliding in front visibly occludes
                  the other rather than the two cross-dissolving. The entering panel's
                  class list only puts `transform` in its transition-property, so its
                  opacity snaps to 1 instantly (no fade-in) while it slides into place;
                  the exiting panel's class list adds `opacity` alongside `transform`,
                  so it fades out as it slides away. Same duration/easing either way —
                  only which properties animate differs. */}
              {/* p-3 -m-3: both the working-size slider's and the Strict Pitch Accent
                  checkbox's hover/focus halos (40px circles riding much smaller rows)
                  overshoot their own row by more than this panel's edges leave room
                  for, so `overflow-hidden` (needed below to clip the slide-in animation
                  horizontally) was clipping the halos too — vertically for the slider,
                  horizontally for the checkbox (it sits flush against the row's right
                  edge). Padding pushes the clip boundary out past both halos on every
                  side; the equal negative margin pulls the box back to its original
                  footprint so surrounding spacing is unaffected. */}
              <div className="grid overflow-hidden p-3 -m-3">
                <div
                  className={`col-start-1 row-start-1 bg-white duration-200 ease-out ${
                    activeMode === 'production'
                      ? 'transition-transform translate-x-0 opacity-100'
                      : 'transition-[transform,opacity] translate-x-full opacity-0 pointer-events-none'
                  }`}
                >
                  {fcActive ? (
                    <div className="flex items-center justify-end">
                      <TextButton
                        variant="pink"
                        align="end"
                        onClick={() => {
                          setFcActive(false);
                          setFcRecords({});
                        }}
                      >
                        <Trash2 size={16} strokeWidth={2} />
                        Discard Drill
                      </TextButton>
                    </div>
                  ) : (
                    <>
                      <div className="font-medium text-slate-700 mb-1">Working Terms Range</div>
                      <div className="text-xs text-slate-400 mb-3">How many terms stay active in the rotation at once</div>
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 min-w-[2.5rem] text-center bg-slate-100 rounded-lg py-1.5 text-xs font-normal text-slate-800 tabular-nums">
                          {fcMinWorking}
                        </div>
                        <div className="flex-1">
                          <DualRangeSlider
                            min={1}
                            max={30}
                            valueMin={fcMinWorking}
                            valueMax={fcMaxWorking}
                            onChangeMin={setFcMinWorking}
                            onChangeMax={setFcMaxWorking}
                          />
                        </div>
                        <div className="flex-shrink-0 min-w-[2.5rem] text-center bg-slate-100 rounded-lg py-1.5 text-xs font-normal text-slate-800 tabular-nums">
                          {fcMaxWorking}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div
                  className={`col-start-1 row-start-1 flex items-center justify-between bg-white duration-200 ease-out ${
                    activeMode === 'recognition'
                      ? 'transition-transform translate-x-0 opacity-100'
                      : 'transition-[transform,opacity] -translate-x-full opacity-0 pointer-events-none'
                  }`}
                >
                  <div>
                    <div className="font-medium text-slate-700 mb-1">Strict Pitch Accent</div>
                    <div className="text-xs text-slate-400">Require pitch selection before next question</div>
                  </div>
                  <MdCheckbox checked={strictPitch} onChange={() => setStrictPitch(!strictPitch)} />
                </div>
              </div>
              {/* Verb Form determines what actually gets drilled (both modes read
                  `useDicForm`), so it lives here with the other drill-affecting
                  controls rather than in the Glossary card — and unlike the sliding
                  panel above, it applies to both modes equally, so it's not part of
                  that slide transition, just a static section below it. Hidden
                  whenever a session is active/paused (`fcActive`), regardless of which
                  mode is currently selected: a paused Production session's vocab reads
                  this setting live, so leaving it editable mid-session would silently
                  change that session's content out from under it. */}
              {!fcActive && (
                <>
                  <div className="border-t border-slate-100 -mx-5 my-5" />
                  <div>
                    <div className="font-medium text-slate-700 mb-3">Verb Form</div>
                    <div className="flex flex-wrap gap-2">
                      <ChoiceChip selected={!useDicForm} onClick={() => setUseDicForm(false)}>
                        ます形
                      </ChoiceChip>
                      <ChoiceChip selected={useDicForm} onClick={() => setUseDicForm(true)}>
                        辞書形
                      </ChoiceChip>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>

        <div className="mt-auto pt-12 pb-1 text-center text-[11px] font-normal text-slate-400 tracking-wide uppercase">
          Vocabulary list provided by Tokyo University of Foreign Studies and Kenta Li
        </div>

      </div>
    </main>
  );
}
