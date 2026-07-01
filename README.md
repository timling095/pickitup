# Pick It Up - React + TypeScript + Vite + Tailwind CSS v4.0

An interactive Japanese vocabulary drill application optimized for modern styling and clean, domain-driven colocation. The app features Recognition (Multiple Choice) drills and Production (Stylus/Mouse Writing) drills, enforcing a streamlined, micro-learning loop.

> **Attribution:** The Japanese vocabulary dataset powering this application is provided by the Tokyo University of Foreign Studies and Kenta Li.

## 1. File Architecture & Domain Model

The codebase is structured into cohesive, domain-specific "fat files" to limit import fragmentation and optimize clarity.

src/
├── assets/
│   ├── processed_vocabulary.csv   # Raw CSV source dataset.
│   └── processed_vocabulary.json  # Converted JSON database.
├── dictionary.ts                  # The Data Domain: Vocabulary types, database load, and custom filtering hooks.
├── Canvas.tsx                     # The Hardware Domain: Isolated Apple Pencil and pointer-event writing canvas.
├── Drills.tsx                     # The Core Engine: Orchestrates Recognition, Production, Affix wrappers, and DrillEngine.
├── App.tsx                        # The Shell: Global settings, lesson select router, and top-level view wrapper.
├── main.tsx                       # React application entry point.
├── index.css                      # Global stylesheet importing Tailwind CSS v4.0.
└── App.css                        # (Unused) Default stylesheet.

## 2. Domain Specification

### 2.1 The Data Domain (`src/dictionary.ts`)

Houses the type systems (`Vocabulary`, `AffixType`), loads the parsed database from `src/assets/processed_vocabulary.json`, and exposes the `useVocabulary(lessonId)` hook. This hook enables menu controllers to filter drill sessions dynamically.

* **State Management:** This domain must also handle a naive persistent statistics dictionary (e.g., `Record<vocab_id, { attempts: number, correct: number }>`) loaded from `localStorage`.

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
  * **Weighted Selection:** Implements a naive probability weighting algorithm. When building the 10-question queue, the system calculates the **Laplace smoothed correctness rate** `(correct + 1) / (attempts + 2)` for all available vocabulary in the selected lesson. The items in the lowest 40% tier of these smoothed rates are given a **2x probability multiplier** of being selected over the remaining 60%.

### 2.4 The Shell (`src/App.tsx`)

Coordinates top-level states and routing between the menu screen and active sessions. It includes controls for Lesson Selection, Active Mode toggles, Pitch Accent Policies, and allow-mouse debugging. 
* **Terms Viewer (`src/TermsList.tsx`):** Exposes a dedicated UI to view all vocabulary loaded under the active filter configuration, featuring an interactive sorting mode that ranks vocabulary exclusively by its descending **Laplace smoothed error rate**.
* **Persistence:** All user settings (selected modes, toggles) and global correctness stats must be persisted across sessions/reloads using `localStorage`.

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
* **Typography:** English/non-Japanese prompts and meanings are explicitly rendered using the injected `Noto Serif TC` (`NotoSerifTC.ttf`) typeface to visually decouple them from Japanese characters, bypassing unreliable default system fonts like macOS "Songti TC". Furthermore, prompt texts in Production modes are scaled up (`text-3xl`) to exactly match the sizing aesthetics of Recognition modes.

### C. Layout Constraints
* **Viewport Boundaries:** The app's root layout must strictly use `h-[100dvh]` combined with controlled overflow (`overflow-y-auto` or `overflow-hidden`), ensuring the app perfectly locks to the available vertical space of mobile and tablet screens without expanding the body height unnecessarily.