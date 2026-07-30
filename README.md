# Pick It Up

A Japanese vocabulary study app for iPad, built for handwriting practice with an Apple Pencil and quick reading/meaning recall.

> **Attribution:** The Japanese vocabulary dataset powering this application is provided by the Tokyo University of Foreign Studies and Kenta Li.

For technical/architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Two Study Modes

Switch between these any time from the top of the menu screen — both share the same lesson selection, so the terms in play never change out from under you.

### Production

A handwriting loop: you're shown a meaning, then write the term by hand on the canvas.

1. Write your answer, then tap **Reveal Answer**.
2. Compare your writing to the correct term (shown with furigana and pitch accent) and self-grade:
   - **Correct** — moves on to the next term immediately.
   - **Incorrect** — the canvas unlocks again so you can correct your writing on top of it. Once you're done, tap **Proceed** to move on.

A term stays in rotation until it's **mastered** — either by getting it right on the very first try, or by building up a streak of 2 correct answers in a row. Getting one wrong resets its streak and sends it to the back of the rotation. The session ends once every term in scope is mastered.

### Reading Recognition

A 15-question multiple-choice quiz per session, testing reading↔meaning recall (question direction is randomized each time), with an optional 0–6 pitch accent selector alongside every question. Terms you tend to get wrong show up more often.

## Lessons

Pick one or more lessons from the grid on the main screen. Both modes pull from the same selection — you can't scope them separately, and you can't change lessons mid-session without discarding your current Production session first.

## Settings

- **Verb Form (辞書形):** toggles every verb between ます form and dictionary form, across both modes and the Terms Viewer.
- **Strict Pitch Accent** *(Reading Recognition only)*: require selecting a pitch accent before advancing.
- **Working Terms Range** *(Production only)*: a slider controlling how many terms stay active in the rotation at once (1–30). Drag either handle; the app keeps the low end at or below the high end automatically.

## Terms Viewer

Tap **View Terms** to browse every term in your current lesson selection as a searchable list (search matches term, reading, or meaning). Tap any row to mark it with a highlight — this is just a personal reminder and has no effect on drills. In Production mode, a **Practicing** tab filters the list down to terms you haven't mastered yet.

## Managing your vocabulary list

There's no in-app way to permanently hide or delete a term — if you want one gone for good, it needs to be removed from the underlying dataset directly.
