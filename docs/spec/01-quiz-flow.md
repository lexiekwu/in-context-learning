# 01 — Quiz Flow Specification

This document defines the complete quiz interaction flow for the Mandarin flashcard app. It covers the state machine, hover-to-save sub-flow, pinyin verification rules, edge cases, and mobile adaptations. A developer should be able to implement the entire quiz loop from this spec alone.

---

## 1. State Machine

### 1.1 States

| State | Description |
|---|---|
| `SESSION_START` | User clicks "Start Quiz" or "Continue Reviewing." System initializes the FSRS scheduler and loads the review queue. |
| `CARD_START` | FSRS scheduler selects the next due card (or a new card if no reviews are due). If the queue is empty, transition directly to `SESSION_SUMMARY`. |
| `SHOW_SENTENCE` | Display an LLM-generated Chinese sentence (in the user's preferred character set: traditional or simplified) with the target word visually highlighted. Non-target words are hoverable/tappable for tooltips. |
| `AWAITING_TRANSLATION` | The text input field is active and focused. The user types their English translation of the full sentence. |
| `CHECKING_TRANSLATION` | A loading indicator is shown. The LLM evaluates whether the user's translation is effectively correct, with particular weight on the target word's meaning. |
| `TRANSLATION_CORRECT` | A brief "Correct!" confirmation is displayed (auto-advances after 800 ms or on user tap/click). |
| `TRANSLATION_INCORRECT` | The system displays the correct English translation of the full sentence and highlights the target word's meaning specifically. An input field prompts the user to retype the target word's English meaning. |
| `RETYPING_TRANSLATION` | The user is typing the target word's correct English meaning. Submission is checked via case-insensitive string match against the flashcard's stored `englishMeaning` (no LLM call needed — this is a retype-to-confirm step, not a free-form evaluation). |
| `PINYIN_INPUT` | The target word is shown (highlighted in the sentence). An input field prompts the user to type the pinyin in numbered-tone format. |
| `VERIFY_PINYIN` | System performs server-side text-based pinyin verification via `POST /api/quiz/check-pinyin` (see Section 3). No LLM call required. |
| `PINYIN_CORRECT` | Brief "Correct!" feedback (auto-advances after 800 ms or on user tap/click). |
| `PINYIN_INCORRECT` | The correct pinyin is displayed. An input field prompts the user to retype the correct pinyin. |
| `RETYPING_PINYIN` | The user is retyping the correct pinyin. Checked via the same text-match rules as `VERIFY_PINYIN`. |
| `CARD_RESULT` | System computes the FSRS scheduling update. All parts correct on first attempt: `rating = Good`. Any part incorrect: `rating = Again`. The new interval and next review date are computed and persisted. |
| `CARD_COMPLETE` | A brief card summary is shown: next review date, current interval, and a "Next Card" button. Auto-advances after 2 seconds if user does not interact. There is no "End Session" button — users simply navigate away when done. |
| `SESSION_SUMMARY` | Displayed only when the review queue is exhausted (no cards due). Shows: today's stats — total cards reviewed, overall accuracy (%), longest streak, and a breakdown of correct vs. incorrect. Users can also view these stats on the dashboard at any time. |

### 1.2 State Transitions

```
SESSION_START
  │
  ├──[queue non-empty]──► CARD_START
  │
  └──[queue empty]──► SESSION_SUMMARY
        (display "No cards due for review")


CARD_START
  │
  └──[card selected, LLM generates sentence]──► SHOW_SENTENCE


SHOW_SENTENCE
  │
  └──[sentence rendered, input focused]──► AWAITING_TRANSLATION


AWAITING_TRANSLATION
  │
  └──[user submits translation]──► CHECKING_TRANSLATION


CHECKING_TRANSLATION
  │
  ├──[LLM: correct]──► TRANSLATION_CORRECT
  │
  └──[LLM: incorrect]──► TRANSLATION_INCORRECT


TRANSLATION_CORRECT
  │
  └──[after 800ms / user tap]──► PINYIN_INPUT


TRANSLATION_INCORRECT
  │
  └──[correct meaning displayed, input focused]──► RETYPING_TRANSLATION


RETYPING_TRANSLATION
  │
  ├──[user input matches target meaning]──► PINYIN_INPUT
  │
  └──[user input does not match]──► RETYPING_TRANSLATION
        (show inline hint: "Try again — type: {correct meaning}")


PINYIN_INPUT
  │
  └──[user submits pinyin]──► VERIFY_PINYIN


VERIFY_PINYIN
  │
  ├──[pinyin correct]──► PINYIN_CORRECT
  │
  └──[pinyin incorrect]──► PINYIN_INCORRECT


PINYIN_CORRECT
  │
  └──[after 800ms / user tap]──► CARD_RESULT


PINYIN_INCORRECT
  │
  └──[correct pinyin displayed, input focused]──► RETYPING_PINYIN


RETYPING_PINYIN
  │
  ├──[user input matches correct pinyin]──► CARD_RESULT
  │
  └──[user input does not match]──► RETYPING_PINYIN
        (show inline hint: "Try again — type: {correct pinyin}")


CARD_RESULT
  │
  └──[FSRS update persisted]──► CARD_COMPLETE


CARD_COMPLETE
  │
  └──[user clicks "Next Card" / auto-advance]──► CARD_START
       (if no cards due, transitions to SESSION_SUMMARY instead)


SESSION_SUMMARY
  │
  └──[user clicks "Review Again" / navigates away]──► (exit quiz)
       (shown only when queue is exhausted — "All caught up!")
```

### 1.3 Internal Tracking Variables

**Save-as-you-go:** All stats are persisted to the database after each card review (via `POST /api/quiz/submit-result`), not at session end. This means the user can close the app at any time without losing progress. Daily stats (cards reviewed, accuracy) are computed from `ReviewLog` entries for the current calendar day.

These variables are maintained client-side for the current browsing session:

| Variable | Type | Purpose |
|---|---|---|
| `currentCardCorrect` | boolean | Set to `true` at `CARD_START`. Flipped to `false` if the user fails translation or pinyin on the first attempt. Used at `CARD_RESULT` to determine FSRS rating. |
| `cardsReviewed` | int | Incremented at each `CARD_RESULT`. Reflects the current browsing session only; the dashboard shows full daily totals from `ReviewLog`. |
| `cardsCorrect` | int | Incremented at `CARD_RESULT` only if `currentCardCorrect` is still `true`. |
| `currentStreak` | int | Incremented when `currentCardCorrect` is `true`; reset to 0 otherwise. |
| `longestStreak` | int | Updated to `max(longestStreak, currentStreak)` at each `CARD_RESULT`. |

---

## 2. Hover-to-Save Sub-flow

During any state from `SHOW_SENTENCE` through `CARD_COMPLETE`, the Chinese sentence remains visible and all non-target words are interactive.

### 2.1 Desktop Interaction

1. **Hover** over any non-target Chinese word in the sentence.
2. After a 300 ms delay (to prevent flicker from cursor passing over), a **tooltip** appears directly above (or below if near the top of the viewport) the word, containing:
   - The word's English translation (concise, one-line)
   - The word's pinyin in numbered-tone format
   - A subtle "Double-click to save" hint (displayed only on the first 3 tooltips per session, then hidden)
3. **Mouse leaves** the word or tooltip: tooltip fades out after 200 ms.
4. **Double-click** on the word (while tooltip is visible or not):
   - If the word is **not** already in the user's flashcard deck:
     - A brief confirmation animation plays (e.g., a checkmark that fades in/out over 1 second).
     - The word is added to the user's flashcard deck as a new card with its translation and pinyin pre-populated. FSRS state is initialized as a new card.
     - The word receives a small visual indicator (e.g., a faint underline dot) for the rest of the session to show it has been saved.
   - If the word **is** already in the user's flashcard deck:
     - The tooltip shows an "Already saved" badge instead of the save hint.
     - Double-clicking shows a brief "Already in your deck" message (toast notification, 1.5 seconds).
     - No duplicate card is created.

### 2.2 Mobile Interaction

1. **Long-press** (500 ms) on any non-target Chinese word.
2. A tooltip appears with the same content as desktop, plus an explicit **"Save" button** within the tooltip.
3. Tapping the **"Save" button** triggers the same save-or-already-saved logic described above.
4. Tapping **anywhere outside** the tooltip dismisses it.
5. The tooltip does not interfere with the input field. If the input field is focused and the user long-presses a word, the keyboard may remain visible; the tooltip renders above the keyboard area.

### 2.3 Target Word Behavior

The target word (highlighted in the sentence) is **not** hoverable/tappable for a tooltip during the quiz — showing its meaning would undermine the quiz. After `CARD_COMPLETE`, the target word becomes hoverable like any other word.

### 2.4 Data Stored on Save

When a word is saved as a new flashcard, the following data is persisted:

| Field | Value |
|---|---|
| `word` | The traditional Chinese characters as they appear in the sentence |
| `pinyin` | Numbered-tone pinyin (from LLM context or dictionary lookup) |
| `translation` | English meaning (from tooltip) |
| `source_sentence` | The full sentence the word was encountered in |
| `created_at` | Timestamp |
| `fsrs_state` | Default new-card state (no reviews yet) |

---

## 3. Pinyin Verification Rules

Pinyin verification is performed client-side with no LLM call. The system compares the user's input against one or more accepted pinyin strings stored on the card.

### 3.1 Accepted Format

- **Numbered tones only.** Each syllable is followed by its tone number (1-4, or 0 for neutral tone).
- Tone 0 (neutral tone) may be written explicitly (`ma0`) or omitted (`ma`). Both are accepted.
- Syllables are concatenated without spaces or separators for multi-character words.

### 3.2 Normalization Steps (applied to user input before comparison)

1. Strip leading and trailing whitespace.
2. Convert to lowercase.
3. Remove all internal spaces.
4. Remove all internal hyphens and apostrophes (these are sometimes used as syllable separators but are not required).

The same normalization is applied to the stored accepted-pinyin values.

### 3.3 Rejection of Tone-Marked Pinyin

If the user's input contains any Unicode characters in the ranges used for tone-marked vowels (e.g., `U+0101` a-macron, `U+00E9` e-acute, `U+01D0` i-caron, etc.), the submission is **rejected before comparison** with the message:

> "Please use numbered tones instead of tone marks. For example, type **ni3hao3** instead of **nihao**."

This is a soft rejection — it does not count as an incorrect attempt for FSRS purposes. The user stays in the same state (`PINYIN_INPUT`) and can resubmit.

### 3.4 Multiple Valid Readings

Some characters have multiple standard readings depending on context. The card stores all valid pinyin readings for the target word as used in the generated sentence. The system accepts any of them.

Example: The character 了 can be `le0` / `le` (aspect particle) or `liao3` (to understand). If the sentence uses it as a particle, only `le0` / `le` is accepted.

The LLM provides the contextually correct reading(s) at sentence generation time.

### 3.5 Examples

Target word: 你好

| User Input | Normalized | Match? | Notes |
|---|---|---|---|
| `ni3hao3` | `ni3hao3` | Yes | Exact match |
| `Ni3Hao3` | `ni3hao3` | Yes | Case-insensitive |
| ` ni3hao3 ` | `ni3hao3` | Yes | Whitespace stripped |
| `ni3 hao3` | `ni3hao3` | Yes | Internal space removed |
| `ni3-hao3` | `ni3hao3` | Yes | Hyphen removed |
| `nihao` | `nihao` | No | Missing tone numbers (these are not neutral-tone syllables) |
| `ni2hao3` | `ni2hao3` | No | Wrong tone on first syllable |
| `nǐhǎo` | — | Rejected | Tone marks detected; soft error message shown |

---

## 4. Edge Cases

| Scenario | Current State | System Behavior | User Sees |
|---|---|---|---|
| **LLM timeout during sentence generation** | `CARD_START` | Retry once after 3 seconds. If second attempt also times out (or exceeds 10 s total), skip this card and move to the next. If no cards remain, go to `SESSION_SUMMARY`. Log the failure for diagnostics. | A loading spinner with "Generating sentence..." text. On failure: "Couldn't generate a sentence for this card. Skipping to the next one." (toast, 2 s). |
| **LLM timeout during translation checking** | `CHECKING_TRANSLATION` | Retry once after 3 seconds. If second attempt also times out, fall back to a basic string-similarity check (threshold: 0.6 cosine similarity against stored translations). If that also fails, accept the answer and mark the card as `rating = Good` to avoid penalizing the user for a system error. | Loading spinner with "Checking your answer..." On fallback: no special message; the flow continues as if the LLM responded. |
| **LLM returns malformed response** | `CHECKING_TRANSLATION` or `CARD_START` | Parse failure triggers one retry with the same prompt. If still malformed, apply the same fallback as timeout (skip card for generation; basic check for translation). Log the raw response for debugging. | Same as timeout UX — the user should not see raw error details. |
| **User submits empty translation** | `AWAITING_TRANSLATION` | Submission is blocked client-side. The submit button is disabled when the input field is empty. If somehow submitted (e.g., API call), treat as incorrect. | Input field border briefly flashes red. Placeholder text: "Type your English translation here." |
| **User types Chinese instead of English** | `AWAITING_TRANSLATION` | If the submitted text contains >50% CJK characters (Unicode block detection), reject with a soft error before sending to the LLM. Does not count as incorrect. | Inline message below input: "Please type your answer in English." Input is preserved so the user can edit it. |
| **User types English instead of pinyin** | `PINYIN_INPUT` | If the submitted text contains no digits and no tone-mark characters, reject with a soft error. Does not count as incorrect. | Inline message: "Please type the pinyin with tone numbers. For example: ni3hao3" |
| **Idle timeout (5 min no input)** | Any input state (`AWAITING_TRANSLATION`, `PINYIN_INPUT`, `RETYPING_TRANSLATION`, `RETYPING_PINYIN`) | After 4 minutes of inactivity, show a warning. After 5 minutes total, auto-save session progress (all completed cards are persisted; the current in-progress card is abandoned without an FSRS update) and return to `SESSION_SUMMARY`. | At 4 min: subtle banner "Still there? Your session will pause in 1 minute." At 5 min: "Session paused due to inactivity." with a "Resume" button that goes to `SESSION_START`. |
| **Page refresh mid-quiz** | Any state | Session state is saved to `localStorage` on every state transition. On page load, detect saved state. If the saved state is less than 30 minutes old, offer to resume. The in-progress card is restarted from `CARD_START` (a new sentence is generated). Completed cards' FSRS updates are already persisted. | On reload: "You have an unfinished session. Resume?" with "Resume" and "Start Fresh" buttons. |
| **Browser back button during quiz** | Any state | Push a history entry at `SESSION_START`. Intercept the `popstate` event. Show a confirmation dialog rather than navigating away. If confirmed, save session and exit. | Browser-native-style dialog: "Leave quiz? Your progress on the current card will be lost, but completed cards are saved." |
| **Network disconnection during quiz** | Any state requiring a server call (`CARD_START`, `CHECKING_TRANSLATION`) | Detect via `navigator.onLine` and/or failed fetch. Show an offline banner. Queue the request and retry automatically when connectivity returns (exponential backoff, max 30 s). Pinyin verification still works (client-side). | Persistent top banner: "You're offline. We'll retry automatically when you're back online." The sentence and input remain visible. |
| **Multiple valid translations (synonyms)** | `CHECKING_TRANSLATION` | The LLM is instructed to accept semantically equivalent translations. "She is happy" and "She's glad" are both correct. The LLM prompt includes: "Accept any translation that conveys the same meaning, especially for the target word." | If correct via synonym: normal "Correct!" feedback. No indication that a different wording was expected. |
| **Multiple valid pinyin readings** | `VERIFY_PINYIN` | The system checks against all accepted readings stored on the card. Any match is accepted. | Normal "Correct!" feedback. |
| **User submits translation in wrong language (not Chinese, not English)** | `AWAITING_TRANSLATION` | The LLM will evaluate it as incorrect in most cases. No special handling beyond the CJK detection described above. If the LLM determines the meaning is correct despite the language, it may accept it (this is acceptable — the user demonstrated understanding). | Normal incorrect/correct flow depending on LLM judgment. |
| **Card has no more sentences at user's level** | `CARD_START` | The LLM is given the user's proficiency level and the target word. If the LLM indicates it cannot generate an easier/harder sentence, use a fallback: generate a simple subject-verb-object sentence using the target word regardless of difficulty constraints. Log this for review. | Normal sentence display. The sentence may be simpler or harder than usual, but the quiz flow is unaffected. |

---

## 5. Mobile Adaptations

### 5.1 Tooltip Interaction

- **Hover is replaced by long-press** (500 ms threshold) on any non-target word.
- Tooltip appears anchored to the pressed word, positioned above it (or below if near the top of the screen).
- Tooltip contains: translation, pinyin, and a **"Save" button** (since double-tap is unreliable on mobile).
- Tooltip is dismissed by tapping anywhere outside it.
- Only one tooltip can be open at a time.

### 5.2 Virtual Keyboard Considerations

- When `AWAITING_TRANSLATION` or `RETYPING_TRANSLATION` is active, the system requests an **English keyboard layout** via `inputmode="text"` and `lang="en"`.
- When `PINYIN_INPUT` or `RETYPING_PINYIN` is active, the system requests an **alphanumeric layout** via `inputmode="text"`. The presence of numbers in pinyin (tone numbers) means a standard text keyboard is preferable to a numeric keypad. An `autocapitalize="none"` attribute is set to avoid capitalizing the first letter.
- `autocorrect="off"` and `spellcheck="false"` are set on all input fields to prevent the OS from "correcting" pinyin or partial translations.
- The input field and submit button are always visible above the keyboard. The sentence scrolls up if necessary to remain partially visible, but the input area is prioritized.

### 5.3 Swipe Gestures

- **Swipe left** on the `CARD_COMPLETE` screen: advance to the next card (same as tapping "Next Card").
- **Swipe right** on the `CARD_COMPLETE` screen: no action (prevents accidental back-navigation).
- No swipe gestures during active input states to avoid interfering with text selection or keyboard interaction.

### 5.4 Layout Changes for Small Screens (<640px width)

| Element | Desktop | Mobile |
|---|---|---|
| Chinese sentence | Large font (24px), centered, generous padding | Medium font (20px), left-aligned, reduced padding |
| Target word highlight | Background color highlight + subtle underline | Background color highlight + bold weight (underline is harder to see on small screens) |
| Input field | Below the sentence, 60% container width | Full width, fixed to bottom of content area (above keyboard) |
| Submit button | Inline with input field, to the right | Full width, below input field, large tap target (min 48px height) |
| "Correct/Incorrect" feedback | Appears between sentence and input | Appears as a full-width banner above the input field |
| Card summary (`CARD_COMPLETE`) | Side-by-side stats | Stacked vertically |
| Session summary (`SESSION_SUMMARY`) | Grid layout | Single-column list |
| Tooltip | Appears on hover, positioned by cursor | Appears on long-press, centered above the word, max-width 80vw |

### 5.5 Orientation

- The app supports both portrait and landscape.
- In landscape on small devices, the sentence and input field are shown side by side if viewport height is less than 400px (to prevent the keyboard from obscuring the sentence entirely).
