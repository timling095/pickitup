# Pick It Up — Architecture & Design Decisions

Technical/internal documentation for `Pick It Up` (React + TypeScript + Vite + Tailwind CSS v4). For what the app does and how to use it, see [README.md](README.md).

## 1. File Architecture & Domain Model

The codebase is structured into cohesive, domain-specific "fat files" to limit import fragmentation and optimize clarity.

```
src/
├── assets/
│   ├── processed_vocabulary.csv     # Original raw CSV source (historical, unused at runtime).
│   ├── processed_vocabulary_2.csv   # Second raw CSV source, merged in (historical, unused at runtime).
│   ├── tableConvert.com_*.csv       # Source for verb dictionary-form data (historical, unused at runtime).
│   └── processed_vocabulary.json    # The only vocabulary file actually loaded by the app.
├── dictionary.ts                    # The Data Domain: Vocabulary type, database load, and the useVocabulary filtering hook.
├── Canvas.tsx                       # The Hardware Domain: Isolated Apple Pencil and pointer-event writing canvas.
├── Drills.tsx                       # The Core Engine: Furigana/pitch rendering, Recognition/Production drills, DrillEngine, and FlashcardEngine.
├── TermsList.tsx                    # The Terms Viewer: Searchable, spreadsheet-style vocabulary browser with a marking control.
├── App.tsx                          # The Shell: Global settings, localStorage persistence, and the menu/drill/terms router.
├── main.tsx                         # React application entry point.
├── index.css                        # Global stylesheet importing Tailwind CSS v4.0.
└── App.css                          # (Unused) Default stylesheet.
```

## 2. Domain Specification

### 2.1 The Data Domain (`src/dictionary.ts`)

Houses the type system (`Vocabulary`, `AffixType`), loads the parsed database from `src/assets/processed_vocabulary.json`, and exposes the `useVocabulary(selectedLessons: Record<string, boolean>)` hook, which memoizes the filtered vocabulary list for a multi-select map of lesson IDs.

```ts
interface Vocabulary {
  id: string;
  raw_term: string;
  term: string;
  reading: string;
  definition: string;
  pitch_accent: number;
  affix_type: AffixType; // 'none' | 'prefix' | 'suffix'
  lesson_id: string;
  pos: PosType;          // English enum; see below.
  pos_raw: string;       // Original Chinese 詞性 label (e.g. 'ナ形容詞'), kept for traceability.
  dic_form?: string;               // Verbs only: dictionary (辞書形) form.
  dic_form_reading?: string;
  dic_form_pitch_accent?: number;
}
```

* **State Management:** This file is intentionally stateless and has no `localStorage` involvement. Statistics, the marked-terms list, and all other settings live in `App.tsx` (see 2.4), built on a shared generic `useLocalStorage` hook.
* The raw CSVs under `src/assets/` are historical source snapshots only — the running app never reads them. New vocabulary is merged into `processed_vocabulary.json` by hand/one-off script when a new CSV batch arrives.
* **Part-of-Speech (`pos` / `pos_raw`):** Every entry in `processed_vocabulary.json` carries a `pos` field (one of `'verb' | 'na_adj' | 'i_adj' | 'noun' | 'adverb' | 'pronoun' | 'interjection' | 'conjunction' | 'pre_noun' | 'counter' | 'prefix' | 'suffix' | 'phrase' | 'other'`) and a `pos_raw` field (the original Chinese 詞性 label, e.g. `'ナ形容詞'`). These were backfilled from the `tableConvert.com_*.csv` source files using `enrich_pos.py`, a one-off preprocessing script at the project root. The script matches entries by (term, reading) exact pair, then by reading-is-dash fallback, then by term alone, with a final affix_type heuristic for unmatched entries.
* **Word Type Filter:** The five user-visible filter buckets map as follows: `verb` → 動詞; `na_adj` → ナ形容詞; `i_adj` → イ形容詞; `noun` → 名詞; `other` → everything else (adverbs, pronouns, phrases, affixes, etc.). `wordTypeOf(v)` maps a `Vocabulary` entry to its bucket. `filterByWordType(vocabList, selectedWordTypes)` narrows a list to the active bucket selection. `App.tsx` applies this to `activeVocab` before `applyVerbForm`, so it composes with the lesson scope and affects both drill modes and the Terms Viewer identically.
* **Verb Form Toggle:** `applyVerbForm(vocabList, useDicForm)` swaps a verb's `term`/`reading`/`pitch_accent` over to its `dic_form`/`dic_form_reading`/`dic_form_pitch_accent` when the toggle is on, leaving every other field (and non-verb entries, which lack `dic_form`) untouched. `App.tsx` applies this once to `activeVocab` before handing it to either drill engine or the Terms Viewer, so none of them need to know which form is active.
* `isVerb(v)` remains exported for backward compatibility and now reads `v.pos === 'verb'` instead of the previous `v.dic_form !== undefined` heuristic — both are equivalent on this dataset but `pos` is now the canonical source of truth.

### 2.2 The Hardware Domain (`src/Canvas.tsx`)

Encapsulates low-level canvas context interactions and pressure-sensitive drawing (`<DrawingCanvas>`). It is decoupled from game state, returning a pure canvas element plus a global `clear` handle.

* **Fixed Aspect Frame:** The canvas box is a centered `w-[80%]` panel constrained to `aspect-[4/3.75]` and `max-h-[41vh]`, so it keeps a consistent writing area across drill types instead of stretching to fill the viewport.
* **Palm-Rejection Integrity:** All interactive canvas elements (clear button, evaluation buttons) strictly enforce Apple Pencil gating (`pointerType === 'pen'`) combined with `select-none touch-none` CSS utility locks. An `allowMouse` debug flag can widen this to also accept `pointerType === 'mouse'` for development on a trackpad.
* **Disable Lock:** An optional `disabled` prop applies `pointer-events-none` to the canvas's shared parent `<div>`, disabling both drawing and the clear button in one shot. Used by `<ProductionDrill>` to force grading before the canvas can be touched again.

### 2.3 The Core Engine (`src/Drills.tsx`)

Bundles rendering helpers and both drill/session engines:

* `<AffixWrapper>`: Contextually formats prefixes (`お～`) and suffixes (`～さん`) — see the Affix Rendering Rules below.
* `<AnnotatedReading>`: Renders a reading string with the pitch-accent overline applied over the correct span of morae.
* `<AnnotatedTerm>`: Renders the term with per-segment furigana (`<ruby>`/`<rt>`) over kanji spans, aligning each kanji run against its slice of the reading via regex segment-matching, and falling back to one whole-term ruby block if segment alignment fails. The term's own glyphs render at `0.8em` (via a sibling `<span>`) to stay visually smaller than the furigana sitting above them — `<rt>`'s `em` unit is relative to the `<ruby>`'s own (unscaled) inherited font-size, so this scaling never shrinks the furigana itself.

* `<RecognitionDrill>`: Renders a 6-option multiple-choice question (1 correct + 5 randomized distractors) in one of 2 modes, chosen randomly per question by `<DrillEngine>`:
   * `Reading → Meaning`
   * `Meaning → Reading`

  After evaluation, the complement (reading or meaning) is revealed as an absolutely-positioned annotation beside the prompt, so the prompt itself stays perfectly centered. The 0–6 pitch-accent selector pad stays visible throughout (always testable, never blocking submission) and color-grades green/red against the correct value once evaluated; a `pitch_accent === -1` term instead shows a locked "Pitch Accent N/A" placeholder.

* `<ProductionDrill>`: Integrates the drawing canvas and a Correct/Incorrect self-grading step. Always drills `Meaning → Term` (writing the term freehand). Tapping "Reveal Answer" shows the term (with furigana) vertically centered beside the prompt, offset by `ml-12`, and locks the canvas (`pointer-events-none`) so the user must grade before touching it again.
  * **Correct:** advances immediately (`onComplete(true)`).
  * **Incorrect:** does *not* advance. It unlocks the canvas for correction and swaps the button row for a single "Proceed" button (guarded by the same 400ms mis-tap delay as the reveal step). Only pressing "Proceed" calls `onComplete(false)`, which triggers the streak-reset/requeue logic in `<FlashcardEngine>`.

* `<DrillEngine>`: Powers Reading Recognition sessions.
  * **Session Length:** Always builds a fixed 15-question queue per session. When the pool has ≥ 8 terms (i.e. `pool × 2 ≥ 15`), no term appears more than twice — the queue is assembled pass-by-pass, each pass contributing at most one slot per term via the weighted draw, stopping at 15. When the pool is smaller than 8, the per-term cap is lifted and terms repeat as needed to reach 15 (or fewer if the pool is tiny and exhausts all repetitions). There is no recursive "mistakes queue" — errors are deferred entirely to the global `stats` dictionary for future weighted selection.
  * **Weighted Selection:** Each pass computes the **Laplace-smoothed correctness rate** `(correct + 1) / (attempts + 2)` for every in-scope term. Terms in the lowest 50% tier of these rates get a **3x probability weight** over the remaining 50% via the `random() ** (1/weight)` Gumbel trick. The weight is recomputed independently per pass, so pass 2 is not a deterministic copy of pass 1.
  * **Progress UI:** A dot progress bar pinned to the right of the top bar, with "Cancel Drill" on the left.

* `<FlashcardEngine>`: Powers Production sessions. No fixed session length and no weighted selection — instead it maintains a rotating **working set** bounded by `[minWorking, maxWorking]`:
  * On each refill (triggered when a term is mastered and removed from the working set), it tops the set back up to `maxWorking` with shuffled, not-yet-mastered terms. If the pool of fresh terms cannot bring the set to `minWorking`, it backfills with already-mastered terms (marked "permanent" so they don't get re-mastered, just recycled to keep the rotation full). The `useEffect` initialiser only fires when `workingIds` is empty (i.e. session start), so changing `minWorking`/`maxWorking` mid-session has no effect — but since the Settings card is fully replaced by the Session Status card while a session is active, those controls are never reachable during a session anyway.
  * A term is **mastered** (`isMastered`) once it's answered correctly on the very first attempt, or once it reaches a correctness **streak of 2** — an incorrect answer resets that term's streak to 0 and requeues it at the back of the rotation.
  * The session ends once every in-scope term is mastered. Flashcard attempts write to their own `fcRecords` (`{ attempts, streak }` per term) and never touch the global Recognition `stats` dictionary.
  * **Progress UI:** `{masteredIds.size} / {vocabList.length} mastered` counter pinned to the right of the top bar, with "Exit Session" on the left. "Exit Session" only navigates back to the menu (`appState: 'menu'`) — it does *not* end the session (`fcActive` stays `true`), so it doubles as a quick way to check the Terms Viewer or browse lessons mid-session without losing progress. Discarding is a separate, explicit action (see Session Status Card below).

### 2.4 The Shell (`src/App.tsx`)

Coordinates top-level state and routes between the menu screen, the Terms Viewer, and an active drill session (`appState: 'menu' | 'drill' | 'terms'`). It defines a generic `useLocalStorage<T>` hook that every piece of persisted state below is built on top of.

* **Design System (Material Design 2):** The whole UI follows the classic Android "Indigo + Pink A200" MD2 default palette, registered as Tailwind v4 theme tokens in `src/index.css` (`@theme { --color-md-primary: #3F51B5; --color-md-primary-dark: #303F9F; --color-md-primary-light: #C5CAE9; --color-md-accent: #FF4081; --color-md-accent-light: #FCE4EC; }`), which generates `bg-md-primary`, `text-md-primary`, `border-md-primary`, `bg-md-primary/12` (opacity variants), etc. across every file. `colorPrimary` (indigo) drives every selected/interactive/primary-action element (contained buttons, chips, checkboxes, the slider, selected tab text); `colorAccent` (pink) is reserved for the Terms Viewer's marked-row highlight (`bg-md-accent-light`) rather than being spread across primary controls, keeping the two-color contrast legible. `App.tsx` defines two small reusable MD primitives used throughout the Filters/Settings cards:
  * `<MdCheckbox checked onChange>`: an 18px square, 2px-border checkbox — indigo fill + a white `lucide-react` `Check` icon when checked, a plain white box with a gray border (indigo on hover) when not. Used for the boolean settings toggles.
  * `<Chip selected onClick>`: a Material filter chip — fully rounded (`rounded-full`), filled indigo with a leading checkmark when selected, outlined gray-on-white when not. Used for every multi-select filter (Lessons, Word Type), laid out with `flex flex-wrap` (chips wrap and auto-size to their label, unlike a fixed grid) so both filter groups read as one consistent chip system.
* **Mode Toggle:** A single Production / Reading Recognition switch (`activeMode`) drives which engine `appState === 'drill'` renders. Both modes share one scope — one lesson selection (`selectedLessons`) and one word-type selection (`selectedWordTypes`) — there is no independent per-mode scope, and no term can be permanently hidden from within the app (editing `processed_vocabulary.json` directly is the intended way to drop a term for good — there is deliberately no manual skip/hide mechanic in the UI).
* **Settings Panel:** A **Verb Form: 辞書形** `<MdCheckbox>` (`useDicForm`) is mode-independent and always shown — it swaps every verb over to its dictionary form (see 2.1) across both drill modes and the Terms Viewer at once. Below it, mode-dependent settings:
  * *Reading Recognition:* a **Strict Pitch Accent** `<MdCheckbox>` (require pitch selection before advancing — currently informational only, not session-blocking).
  * *Production:* **Min/Max Working Terms** dual-thumb slider (1–30, min ≤ max is enforced by clamping the other thumb) controlling the Flashcard rotation size described above.
* **Dual Range Slider (`DualRangeSlider`):** Two overlapping native `<input type="range">` elements drive value/drag logic only — their thumbs are made fully invisible (`bg-transparent`, no drawn pseudo-element) and widened 44px beyond the track (`left`/`right: -22px`) so each one is a Material-Design-style invisible touch target. The visible dot, its filled track, and its focus/hover halo (`bg-md-primary`) are separate plain `<div>`s positioned at a plain `frac * 100%` + `translate(-50%, -50%)`, sharing the exact same widened reference frame as the (invisible) native inputs — this sidesteps relying on any given browser's internal "keep the thumb inside the track" inset math, so the dot's center always lands exactly on the track's true ends, never past them, in every browser. The halo is a `peer/min`/`peer/max`-driven `opacity` transition (`peer-hover:opacity-100 peer-focus:opacity-100 peer-active:opacity-100`) rather than a pseudo-element background, since `opacity` animates reliably cross-browser where a radial-gradient background swap does not. The `peer-active` class is required for iPadOS Safari, which does not fire `:hover` (no cursor) and may not reliably fire `:focus` on range inputs from touch; `:active` fires on every touch interaction, so the halo appears correctly on iPad. A z-index heuristic (whichever thumb's value is on the far side of the range's midpoint gets a higher z-index) keeps the correct thumb grabbable when the two are close together. Rather than a separate collision/gap mechanism, `App.tsx` simply clamps each `onChange` handler so `valueMin` and `valueMax` can never become equal (`Math.min(next, valueMax - 1)` / `Math.max(next, valueMin + 1)`) — two overlapping handles can't happen in the first place. iPadOS Safari specifically draws a UA default `box-shadow` on `::-webkit-slider-thumb` (its native focus/active glow) that survives `appearance-none` plus a transparent background, showing up as a stray shadow under the decorative halo; both the pseudo-element and the `<input>` itself carry an explicit `shadow-none` to clear it (a reasoned fix for a real device quirk that can't be verified from this Chromium-only dev environment).
* **Filters Card:** Lesson selection and word-type selection live together in one card (no card title). "Lessons" and "Word Type" are rendered as `card-title`-style section labels (`text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4`), consistent with the other card headers. Both sections render their options as `<Chip>`s: Lessons shows one chip per lesson ID; Word Type shows five: **Verbs** (動詞), **な-adj** (ナ形容詞), **い-adj** (イ形容詞), **Nouns** (名詞), and **Others** (everything else). There is no session-in-progress notice — the Filters card stays fully live and editable at all times, including while a Flashcard session is in progress — see Session Scope Snapshot below for how that's made safe.
* **Session Scope Snapshot:** `selectedLessons`/`selectedWordTypes` always drive the home screen's live counts and the Terms Viewer, in and out of a session. A Flashcard session instead reads from a separate, once-per-session snapshot — `fcSessionLessons`/`fcSessionWordTypes` — captured only at the moment "Start Session" transitions `fcActive` from `false` to `true` (not on "Resume Session", which reuses the existing snapshot). `FlashcardEngine` is always fed the snapshot-derived `sessionVocab`, never the live `displayVocab`. This lets the Filters card stay unlocked mid-session: editing filters changes what the Terms Viewer shows, but can never leave a running session's working set referencing terms that fell out of scope, since the session doesn't read the live filters at all.
* **Session Status Card:** Whenever a Flashcard session is in progress (`fcActive`), the right-column Settings card is entirely replaced by a Session Status card — a single inline row showing `{sessionMasteredCount} / {sessionVocab.length} mastered` and a **Discard Session** button side-by-side (`setFcActive(false)`) as the only way to end a session without finishing it. This applies regardless of which mode tab is currently displayed, since `fcActive` is a single global flag independent of `activeMode`.
* **Terms Viewer (`src/TermsList.tsx`):** A spreadsheet-style grid (Term / Reading / Meaning) over the active lesson scope, live-searchable by term/reading/meaning. The meaning column uses the same text color as the term column.
  * **Marking:** Clicking anywhere on a row toggles a "marked" highlight (`bg-md-accent-light`, i.e. Material Pink 50) — a lightweight, private way to flag terms for attention with no effect on drill selection. This is the app's one deliberate use of the accent color, kept distinct from the indigo primary used everywhere else.
  * **Practicing View (Production, session-active only):** A second tab, "Practicing", filters the grid down to terms that aren't yet mastered (derived live from `fcRecords`/`isMastered`, the same session-mastery data the Flashcard engine itself tracks — there's no separate manual mastery toggle). `showTabs = mode === 'production' && sessionActive` — the tabs (and the `TermsList` `sessionActive` prop, wired to `fcActive`) only appear while a Flashcard session is actually in progress, since "Practicing" has no meaning without a session to be practicing toward. Reading Recognition, and Production with no active session, show a single unfiltered list with no tabs.
* **Persistence:** Active mode, selected lessons, selected word types, both settings panels' values, marked terms, the Flashcard working-set bounds and per-term `fcRecords`, and the global Recognition `stats` dictionary are all persisted across sessions/reloads via `localStorage`.

---

## ⚠️ CRITICAL IMPLEMENTATION NOTES ⚠️

### A. Affix Rendering Rules

The application must strictly shield the user from ever having to manually draw the `～` symbol. The `affix_type` (`prefix`, `suffix`, or `none`) must dictate UI rendering under the following strict rules:

1. **In Recognition Drills (Multiple Choice):**
   * The affix is rendered inline as part of the text string prompt.
   * *Suffix example:* `さん` is rendered as `～さん`.

2. **In Production Drills (Canvas Writing):**
   * The affix is rendered as a static UI typography element **inside** the drawing canvas, providing contextual framing.
   * *Prefix example:* `[ CANVAS ～]`
   * *Suffix example:* `[～ CANVAS ]`
   * The user is *only* expected to draw the core `term` or `reading` inside the canvas itself.

### B. Pitch Accent Rules & Notation

Pitch accent UI (0–6 number pad) is integrated **only into Recognition Drill mode**. In Production Drills, the number pad is omitted entirely — the user is expected to draw the pitch accent overline directly onto the canvas alongside their handwritten reading.

* **The Test UI is Always Displayed:** In Recognition mode, the pitch-accent selector is visible but never blocks submission; the user can submit without selecting a pitch.
* **Unavailable Targets (-1):** When a term's `pitch_accent` is strictly `-1`, no pitch accent applies. The entire pitch UI is visually locked (`opacity-50`, `pointer-events-none`) and shows a `"Pitch Accent N/A"` placeholder instead.
* **Post-Answer Annotation (Overline Notation):** Immediately after answering/revealing, the reading is annotated with an overline spanning exactly the number of morae dictated by `pitch_accent`. All reading targets receive this annotation.
  * **0–6 Grading:** After a Recognition answer is evaluated, the pitch buttons stay on screen but color-grade: the correct pitch glows green (`bg-green-50 border-green-500 text-green-700`); an incorrect selection glows red (`bg-red-50 border-red-500 text-red-700`).
* **Reveal Mechanics (Production):** Tapping "Reveal Answer" shows the correct term — with furigana and pitch overline — vertically centered beside the prompt (not overlaying the canvas), so handwritten strokes stay visible for comparison. The canvas is locked until the user self-grades.
* **Furigana Scaling:** Term glyphs render at `0.8em` relative to their furigana so the reading annotation reads clearly above smaller kanji, without shrinking the `<rt>` furigana itself (see `AnnotatedTerm` in 2.3).
* **Typography:** English/non-Japanese prompts and meanings use the injected `Noto Serif TC` typeface, decoupling them visually from Japanese characters and bypassing unreliable system font substitutions. The top-level app header uses `Space Grotesk` at 700 weight for branding.

### C. Layout Constraints

* **Viewport Boundaries:** The app's root layout must strictly use `h-[100dvh]` combined with controlled overflow (`overflow-y-auto` or `overflow-hidden`), ensuring the app perfectly locks to the available vertical space of mobile and tablet screens without expanding the body height unnecessarily.
