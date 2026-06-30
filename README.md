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

* `<DrillEngine>`: Handles session queues, progress bar tracking, and mistakes management.
  * **Session Length:** Enforces a strict limit of 10 questions per drill session to prevent fatigue, re-queueing incorrect answers until they are resolved.
  * **Weighted Selection:** Implements a naive probability weighting algorithm. When building the 10-question queue, the system calculates the **Laplace smoothed correctness rate** `(correct + 1) / (attempts + 2)` for all available vocabulary in the selected lesson. The items in the lowest 40% tier of these smoothed rates are given a **2x probability multiplier** of being selected over the remaining 60%.

### 2.4 The Shell (`src/App.tsx`)

Coordinates top-level states and routing between the menu screen and active sessions. It includes controls for Lesson Selection, Active Mode toggles, Pitch Accent Policies, and allow-mouse debugging. **All user settings (selected modes, toggles) and the global correctness stats must be persisted across sessions/reloads** using `localStorage`.

---

## ⚠️ CRITICAL IMPLEMENTATION NOTES ⚠️

### A. Affix Rendering Rules

The application must strictly shield the user from ever having to manually draw the `～` symbol. The `affix_type` (`prefix`, `suffix`, or `none`) must dictate UI rendering under the following strict rules:

1. **In Recognition Drills (Multiple Choice):**
   * The affix is rendered inline as part of the text string prompt.
   * *Prefix example:* `お茶` is rendered as `お～` / `おちゃ`.
   * *Suffix example:* `さん` is rendered as `～さん`.

2. **In Production Drills (Canvas Writing):**
   * The affix is rendered as a static UI typography element **physically outside** the drawing canvas boundary, providing contextual framing.
   * *Prefix example:* `[ お～ ] [ CANVAS ]`
   * *Suffix example:* `[ CANVAS ] [ ～さん ]`
   * The user is *only* expected to draw the core `term` or `reading` inside the canvas itself.

### B. Pitch Accent Rules & Notation

Pitch accent UI (e.g., number pad 0-6 or options) is integrated into any mode where the `reading` is either the input (prompt) or the output (target), **with the strict exception of `Romaji → Reading`** (which ignores pitch accent entirely).
*Applicable Modes:* `Reading → Meaning`, `Meaning → Reading`.

* **The Test UI is Always Displayed:** The UI allowing the user to select/test the pitch accent is visible for these modes, but the user is completely **unblocked**; they are not forced to answer the pitch accent before submitting their multiple choice or reveal buttons.
* **Unavailable Targets (-1):** When a vocabulary term's `pitch_accent` is strictly equal to `-1`, it dictates that no pitch accent fundamentally applies. In these cases, the entire pitch accent testing interface is visually locked (e.g. `opacity-50`, `pointer-events-none`) and renders a placeholder `"Pitch Accent N/A"`.
* **Post-Answer Annotation (Upperscore Notation):** For tasks involving terms and readings, the application automatically displays an annotated version of the reading immediately after the user answers or reveals. This annotation uses an **upperscore** (an overline) spanning the exact number of kana characters dictated by the `pitch_accent` value (e.g., if `pitch_accent=3`, the first 3 characters receive an overline).
  * **0-6 Grading:** When an answer is evaluated, the 0-6 pitch accent selector buttons remain on screen but are color-graded. The correct target pitch button glows green (`bg-green-500`), and if the user selected an incorrect pitch, that button is highlighted red (`bg-red-500`).
* **Reveal Mechanics:** When the user taps "Reveal Answer", the correct answer is displayed inside an elegant, non-obscuring "result pill" anchored to the bottom center of the canvas area. This layout mimics the "big target, small inline complement" aesthetic of the Recognition Drills, allowing users to clearly compare their handwritten strokes against the correct answer without the canvas being covered up by an overlay.
  * **Inline Prompt Complements:** When the prompt itself is a Term or Reading (`Term → Meaning`, `Reading → Meaning`), the corresponding compliment is annotated immediately beside the prompt (anchored as an absolute offset) so that the original prompt remains perfectly centered on the screen.
  * **Exclusion:** The `Romaji → Reading` mode is strictly excluded from receiving any upperscore pitch accent annotations.

### C. Layout Constraints
* **Viewport Boundaries:** The app's root layout must strictly use `h-[100dvh]` combined with controlled overflow (`overflow-y-auto` or `overflow-hidden`), ensuring the app perfectly locks to the available vertical space of mobile and tablet screens without expanding the body height unnecessarily.