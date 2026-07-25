# Pick It Up - React + TypeScript + Vite + Tailwind CSS v4.0

An interactive Japanese vocabulary drill application optimized for modern styling and clean, domain-driven colocation. The app is organized into three top-level tabs:

* **Terms:** Lesson-scoped Recognition (Multiple Choice) and Production (Stylus/Mouse Writing) drills, run through a fixed-length, weighted-selection session (`<DrillEngine>`).
* **Glyphs:** A Production-only writing drill for raw hiragana/katakana characters (`Romaji → Reading`), scoped by alphabet system instead of by lesson.
* **Flashcards:** A mastery-based Production writing loop (`<FlashcardEngine>`) that repeats each term until it's answered correctly a configurable number of times, rather than running a fixed-length session.

> **Attribution:** The Japanese vocabulary dataset powering this application is provided by the Tokyo University of Foreign Studies and Kenta Li.

## 1. File Architecture & Domain Model

The codebase is structured into cohesive, domain-specific "fat files" to limit import fragmentation and optimize clarity.

```
src/
├── assets/
│   ├── processed_vocabulary.csv   # Raw CSV source dataset.
│   └── processed_vocabulary.json  # Converted JSON database.
├── dictionary.ts                  # The Data Domain: Vocabulary types, database load, and the useVocabulary filtering hook.
├── Canvas.tsx                     # The Hardware Domain: Isolated Apple Pencil and pointer-event writing canvas.
├── Drills.tsx                     # The Core Engine: Recognition, Production, Affix wrappers, DrillEngine, and FlashcardEngine.
├── TermsList.tsx                  # The Terms Viewer: Sortable/searchable vocabulary browser with Skip/Unskip controls.
├── App.tsx                        # The Shell: Global settings, localStorage persistence, and the Terms/Glyphs/Flashcards tab router.
├── main.tsx                       # React application entry point.
├── index.css                      # Global stylesheet importing Tailwind CSS v4.0.
└── App.css                        # (Unused) Default stylesheet.
```

## 2. Domain Specification

### 2.1 The Data Domain (`src/dictionary.ts`)

Houses the type systems (`Vocabulary`, `AffixType`), loads the parsed database from `src/assets/processed_vocabulary.json`, and exposes the `useVocabulary(selectedLessons: Record<string, boolean>)` hook. The hook takes a multi-select map of lesson IDs (not a single lesson ID) and memoizes the filtered vocabulary list; it's invoked twice in `App.tsx` — once for the Terms tab's lesson scope and once for the Flashcards tab's independent lesson scope.

* **State Management:** This file is intentionally stateless and has no `localStorage` involvement. The persistent statistics dictionary (`Record<vocab_id, { attempts: number, correct: number }>`), skip lists, and all other settings actually live in `App.tsx` (see 2.4), built on a shared generic `useLocalStorage` hook.

### 2.2 The Hardware Domain (`src/Canvas.tsx`)

Encapsulates low-level canvas context interactions and pressure-sensitive drawing. It is decoupled from game states, returning pure canvas elements and clear handles.
* **Palm-Rejection Integrity:** All interactive canvas elements (clear buttons, evaluation buttons, and text tracking metrics) strictly enforce Apple Pencil gating (`pointerType === 'pen'`) combined with `select-none touch-none` CSS utility locks. This design counteracts iPadOS touch-bleed and aggressive text-highlighting behaviors during handwriting.

### 2.3 The Core Engine (`src/Drills.tsx`)

Bundles drill execution components:

* `<AffixWrapper>`: Contextually formats prefixes (`お～`) and suffixes (`～さん`). *(See critical Implementation Note below).*

* `<RecognitionDrill>`: Renders multiple-choice questions with 6 options (1 correct answer, 5 randomized distractors). Supports 4 modes:
   * `Term → Meaning`
   * `Reading → Meaning`
   * `Meaning → Term`
   * `Meaning → Reading`

* `<ProductionDrill>`: Integrates the drawing canvas, pitch accent numberpad selectors, and grading states. Supports 3 modes:
  * `Meaning → Term` (Writing)
  * `Meaning → Reading` (Writing)
  * `Romaji → Reading` (Writing)

* `<DrillEngine>`: Handles session queues, progress bar tracking, and session routing.
  * **Session Length:** Enforces a strict, unyielding limit of 10 questions per drill session to prevent fatigue. The engine explicitly eliminates recursive "mistakes queues," deferring error tracking entirely to the global stats to be dynamically resolved in future spaced-repetition cycles.
  * **Weighted Selection:** Implements a naive probability weighting algorithm. When building the 10-question queue, the system calculates the **Laplace smoothed correctness rate** `(correct + 1) / (attempts + 2)` for all available vocabulary in the selected lesson. The items in the lowest 50% tier of these smoothed rates are given a **2x probability multiplier** of being selected over the remaining 50%.

* `<FlashcardEngine>`: A second, independent session engine used exclusively by the Flashcards tab. It has no fixed session length and no weighted selection:
  * On session start, it shuffles every in-scope term whose `fcProgress` (correct tries so far) is below the user-configured **target correct tries** (1–5).
  * Every card is presented as a `<ProductionDrill>` in `meaning-term` (Writing) mode only — there is no mode selection for Flashcards.
  * A correct answer increments that term's progress and drops it from the session queue; an incorrect answer requeues it at the back of the same queue. Flashcard attempts do **not** write to the global `stats` dictionary used by Recognition/Production drills.
  * The session ends only once every in-scope term has reached the target correct-tries count.

### 2.4 The Shell (`src/App.tsx`)

Coordinates top-level state and routes between the menu screen, the Terms Viewer, and active drill sessions. It defines a generic `useLocalStorage<T>` hook that every piece of persisted state below is built on top of.

* **Top-Level Tabs:** The menu screen is a three-tab router:
  * **Terms:** Lesson-scoped Recognition + Production drills via `<DrillEngine>`, using the lessons and modes selected in the UI. Includes the Strict Pitch Accent and allow-mouse debug settings.
  * **Glyphs:** A Production-only `romaji-reading` writing drill (also via `<DrillEngine>`), scoped by hiragana/katakana `system` rather than by lesson — lesson selection is ignored entirely in this tab.
  * **Flashcards:** The mastery-based writing loop via `<FlashcardEngine>` (see 2.3), with its own independent lesson scope, its own skip list, and a configurable target correct-tries count (1–5).
* **Terms Viewer (`src/TermsList.tsx`):** Exposes a dedicated UI to view all vocabulary loaded under the active tab's filter configuration (Terms or Flashcards scope). Features interactive layout modes to rank vocabulary by descending **Laplace smoothed error rate**, a live search box (matches term/reading/definition/romaji), and a dedicated **'Skipped'** view to re-enable terms manually banished during drill sessions.
* **Persistence:** All user settings (active tab, selected lessons/modes/system, Strict Pitch toggle, allow-mouse debug flag), both skip lists, the Flashcards target and per-term progress, and the global correctness `stats` dictionary are persisted across sessions/reloads using `localStorage`, via the shared `useLocalStorage` hook.

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

Pitch accent UI (e.g., number pad 0-6) is integrated **only into Recognition Drill modes**. In **Production Drills (Canvas Writing)**, the 0-6 pitch selector pad is explicitly omitted, as the user is expected to manually draw the pitch accent symbols directly onto the canvas alongside their reading.

* **The Test UI is Always Displayed:** In Recognition modes, the UI allowing the user to select/test the pitch accent is visible, but the user is completely **unblocked**; they are not forced to answer the pitch accent before submitting.
* **Unavailable Targets (-1):** When a vocabulary term's `pitch_accent` is strictly equal to `-1`, it dictates that no pitch accent fundamentally applies. In these cases, the entire pitch accent testing interface is visually locked (e.g. `opacity-50`, `pointer-events-none`) and renders a placeholder `"Pitch Accent N/A"`.
* **Post-Answer Annotation (Upperscore Notation):** The application automatically displays an annotated version of the reading immediately after the user answers or reveals. This annotation uses an **upperscore** (an overline) spanning the exact number of kana characters dictated by the `pitch_accent` value. **All reading targets now receive this upperscore annotation**, including `Romaji → Reading`.
  * **0-6 Grading:** When a Recognition answer is evaluated, the 0-6 pitch accent selector buttons remain on screen but are color-graded. The correct target pitch button glows translucent green (`bg-green-50 border-green-500 text-green-700`), and if the user selected an incorrect pitch, that button is highlighted translucent red (`bg-red-50 border-red-500 text-red-700`).
* **Reveal Mechanics (Production):** When the user taps "Reveal Answer", the correct answer is displayed inside a flat, non-obscuring, white rectangular "result box" anchored to the bottom center of the canvas area. This allows users to clearly compare their handwritten strokes against the correct answer without the canvas being covered up by an overlay.
  * **Inline Prompt Complements:** When a Drill is evaluated or revealed (in both Recognition and Production modes), the corresponding complement (e.g. the Term or Reading) is annotated immediately beside the top screen prompt (anchored as an absolute offset) so that the original prompt remains perfectly centered on the screen.
* **Typography:** English/non-Japanese prompts and meanings are explicitly rendered using the injected `Noto Serif TC` (`NotoSerifTC.ttf`) typeface to visually decouple them from Japanese characters, bypassing unreliable default system fonts like macOS "Songti TC". Furthermore, prompt texts in Production modes are scaled up (`text-3xl`) to exactly match the sizing aesthetics of Recognition modes. The top-level application header enforces `Space Grotesk` at an absolute 700 font-weight for distinct branding.

### C. Layout Constraints
* **Viewport Boundaries:** The app's root layout must strictly use `h-[100dvh]` combined with controlled overflow (`overflow-y-auto` or `overflow-hidden`), ensuring the app perfectly locks to the available vertical space of mobile and tablet screens without expanding the body height unnecessarily.