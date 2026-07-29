# Pick It Up - React + TypeScript + Vite + Tailwind CSS v4.0

An interactive Japanese vocabulary drill application for iPad, built around two complementary study modes that share a single lesson scope:

* **Production:** A mastery-based, stylus-writing loop (`<FlashcardEngine>` + `<ProductionDrill>`). Each term repeats until it's answered correctly enough times to be "mastered," rather than running a fixed-length session.
* **Reading Recognition:** A fixed-length, weighted-selection multiple-choice quiz (`<DrillEngine>` + `<RecognitionDrill>`), testing reading↔meaning recall with optional pitch-accent grading.

Both modes read from the same lesson-scoped vocabulary pool and the same Terms Viewer, so switching modes never changes which terms are in play mid-session.

> **Attribution:** The Japanese vocabulary dataset powering this application is provided by the Tokyo University of Foreign Studies and Kenta Li.

## 1. File Architecture & Domain Model

The codebase is structured into cohesive, domain-specific "fat files" to limit import fragmentation and optimize clarity.

```
src/
├── assets/
│   ├── processed_vocabulary.csv     # Original raw CSV source (historical, unused at runtime).
│   ├── processed_vocabulary_2.csv   # Second raw CSV source, merged in (historical, unused at runtime).
│   └── processed_vocabulary.json    # The only vocabulary file actually loaded by the app.
├── dictionary.ts                    # The Data Domain: Vocabulary type, database load, and the useVocabulary filtering hook.
├── Canvas.tsx                       # The Hardware Domain: Isolated Apple Pencil and pointer-event writing canvas.
├── Drills.tsx                       # The Core Engine: Furigana/pitch rendering, Recognition/Production drills, DrillEngine, and FlashcardEngine.
├── TermsList.tsx                    # The Terms Viewer: Searchable, spreadsheet-style vocabulary browser with mark/skip controls.
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
}
```

* **State Management:** This file is intentionally stateless and has no `localStorage` involvement. Statistics, skip/mark lists, and all other settings live in `App.tsx` (see 2.4), built on a shared generic `useLocalStorage` hook.
* The raw CSVs under `src/assets/` are historical source snapshots only — the running app never reads them. New vocabulary is merged into `processed_vocabulary.json` by hand/one-off script when a new CSV batch arrives.

### 2.2 The Hardware Domain (`src/Canvas.tsx`)

Encapsulates low-level canvas context interactions and pressure-sensitive drawing (`<DrawingCanvas>`). It is decoupled from game state, returning a pure canvas element plus a global `clear` handle.

* **Fixed Aspect Frame:** The canvas box is a centered `w-[80%]` panel constrained to `aspect-[4/5]` and `max-h-[55vh]`, so it keeps a consistent writing area across drill types instead of stretching to fill the viewport.
* **Palm-Rejection Integrity:** All interactive canvas elements (clear button, evaluation buttons) strictly enforce Apple Pencil gating (`pointerType === 'pen'`) combined with `select-none touch-none` CSS utility locks. An `allowMouse` debug flag can widen this to also accept `pointerType === 'mouse'` for development on a trackpad.

### 2.3 The Core Engine (`src/Drills.tsx`)

Bundles rendering helpers and both drill/session engines:

* `<AffixWrapper>`: Contextually formats prefixes (`お～`) and suffixes (`～さん`) — see the Affix Rendering Rules below.
* `<AnnotatedReading>`: Renders a reading string with the pitch-accent overline applied over the correct span of morae.
* `<AnnotatedTerm>`: Renders the term with per-segment furigana (`<ruby>`/`<rt>`) over kanji spans, aligning each kanji run against its slice of the reading via regex segment-matching, and falling back to one whole-term ruby block if segment alignment fails. The term's own glyphs render at `0.8em` (via a sibling `<span>`) to stay visually smaller than the furigana sitting above them — `<rt>`'s `em` unit is relative to the `<ruby>`'s own (unscaled) inherited font-size, so this scaling never shrinks the furigana itself.

* `<RecognitionDrill>`: Renders a 6-option multiple-choice question (1 correct + 5 randomized distractors) in one of 2 modes, chosen randomly per question by `<DrillEngine>`:
   * `Reading → Meaning`
   * `Meaning → Reading`

  After evaluation, the complement (reading or meaning) is revealed as an absolutely-positioned annotation beside the prompt, so the prompt itself stays perfectly centered. The 0–6 pitch-accent selector pad stays visible throughout (always testable, never blocking submission) and color-grades green/red against the correct value once evaluated; a `pitch_accent === -1` term instead shows a locked "Pitch Accent N/A" placeholder.

* `<ProductionDrill>`: Integrates the drawing canvas and a Correct/Incorrect self-grading step. Always drills `Meaning → Term` (writing the term freehand). Tapping "Reveal Answer" shows the term (with furigana) vertically centered beside the prompt, offset by `ml-12`; the user then self-grades their handwriting via Correct/Incorrect buttons (both pen-gated, matching the canvas's palm-rejection rules).

* `<DrillEngine>`: Powers Reading Recognition sessions.
  * **Session Length:** Builds a fixed 15-question queue per session. There is no recursive "mistakes queue" — errors are deferred entirely to the global `stats` dictionary for future weighted selection.
  * **Weighted Selection:** Computes the **Laplace-smoothed correctness rate** `(correct + 1) / (attempts + 2)` for every in-scope term. Terms in the lowest 50% tier of these rates get a **3x probability weight** over the remaining 50% when the 15-question queue is drawn.
  * **Progress UI:** A centered dot progress bar (no numeric counter); "Cancel Drill" and "Skip Term" sit on either side of it.

* `<FlashcardEngine>`: Powers Production sessions. No fixed session length and no weighted selection — instead it maintains a rotating **working set** bounded by `[minWorking, maxWorking]`:
  * On each refill, it tops the working set up to `maxWorking` with shuffled, not-yet-mastered terms; if the pool of fresh terms can't reach `minWorking`, it backfills with already-mastered terms (marked "permanent" so they don't get remastered, just recycled to keep the rotation full).
  * A term is **mastered** (`isMastered`) once it's answered correctly on the very first attempt, or once it reaches a correctness **streak of 2** — an incorrect answer resets that term's streak to 0 and requeues it at the back of the rotation.
  * The session ends once every in-scope term is mastered. Flashcard attempts write to their own `fcRecords` (`{ attempts, streak }` per term) and never touch the global Recognition `stats` dictionary.

### 2.4 The Shell (`src/App.tsx`)

Coordinates top-level state and routes between the menu screen, the Terms Viewer, and an active drill session (`appState: 'menu' | 'drill' | 'terms'`). It defines a generic `useLocalStorage<T>` hook that every piece of persisted state below is built on top of.

* **Mode Toggle:** A single Production / Reading Recognition switch (`activeMode`) drives which engine `appState === 'drill'` renders. Both modes share one lesson scope (`selectedLessons`) and one skip list (`skippedTerms`) — there is no independent per-mode scope.
* **Settings Panel:** Mode-dependent, shown alongside lesson selection:
  * *Reading Recognition:* a **Strict Pitch Accent** toggle (require pitch selection before advancing — currently informational only, not session-blocking).
  * *Production:* **Min/Max Working Terms** sliders (1–30, min ≤ max is enforced by clamping the other slider) controlling the Flashcard rotation size described above.
* **Scope Lock:** Whenever a Flashcard session is in progress (`fcActive`), the lesson-select panel is covered by a blocking "Session in Progress" overlay with a "Discard Session" escape hatch — this lock applies regardless of which mode tab is currently displayed, since both modes share the same `selectedLessons` state and changing it mid-session would leave the Flashcard working set referencing terms that are no longer in scope.
* **Terms Viewer (`src/TermsList.tsx`):** A spreadsheet-style grid (Term / Reading / Meaning / Error% / skip button) over the active lesson scope, live-searchable by term/reading/meaning, with a Default/Skipped view toggle.
  * **Marking:** Clicking anywhere on a row toggles a "marked" highlight (`#FCE4EC` background) — a lightweight, private way to flag terms for attention with no effect on drill selection.
  * **Skip/Unskip:** A dedicated circular ✕ button (transparent background, event-isolated from the row's mark-toggle click) skips a term out of both drill engines' pools; skipped terms surface in the "Skipped" view for unskipping.
* **Persistence:** Active mode, selected lessons, both settings panels' values, the skip list, marked terms, the Flashcard working-set bounds and per-term `fcRecords`, and the global Recognition `stats` dictionary are all persisted across sessions/reloads via `localStorage`.

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
* **Reveal Mechanics (Production):** Tapping "Reveal Answer" shows the correct term — with furigana and pitch overline — vertically centered beside the prompt (not overlaying the canvas), so handwritten strokes stay visible for comparison.
* **Furigana Scaling:** Term glyphs render at `0.8em` relative to their furigana so the reading annotation reads clearly above smaller kanji, without shrinking the `<rt>` furigana itself (see `AnnotatedTerm` in 2.3).
* **Typography:** English/non-Japanese prompts and meanings use the injected `Noto Serif TC` typeface, decoupling them visually from Japanese characters and bypassing unreliable system font substitutions. The top-level app header uses `Space Grotesk` at 700 weight for branding.

### C. Layout Constraints

* **Viewport Boundaries:** The app's root layout must strictly use `h-[100dvh]` combined with controlled overflow (`overflow-y-auto` or `overflow-hidden`), ensuring the app perfectly locks to the available vertical space of mobile and tablet screens without expanding the body height unnecessarily.
