# tomaja — MVP spec

A cute, chill, tomato-themed website for learning to read Japanese.
(tomaja = tomato + ja. The Japanese word for tomato, トマト, is the first katakana word you learn.)

- Evidence and reasoning: [research.md](./research.md)
- How to build it: [implementation-plan.md](./implementation-plan.md)
- Kanji, the first add-on after the MVP: [kanji-addon.md](./kanji-addon.md)
- The original brief is kept verbatim at the [bottom of this file](#appendix-original-brief).

---

## 1. Product in one paragraph

You grow a tomato garden. Every kana character, word and grammar pattern is a plant. Learning something new plants a seed; recalling it correctly over the following days and weeks makes it grow from sprout to ripe tomato. The garden is an honest picture of your memory: what is ripe you really know, what is wilting needs water. Sessions take three to five minutes on a phone.

## 2. Who it is for

An English-reading beginner with no Japanese, studying a few minutes a day on a phone, who wants to be able to read kana and a first set of words. Not for JLPT cramming, and not a full course.

## 3. Goals and non-goals

**Goals**

1. Learner can read all hiragana and katakana, including voiced and combined sounds.
2. Learner picks up about 130 words and about 12 basic grammar patterns, all written in kana, each introduced only when they can read every character in it.
3. Progress follows the learner across devices.
4. It feels calm. Nothing is lost by missing a day.

**Non-goals for the MVP**

- Kanji. It is the first add-on after the MVP and has its own spec, [kanji-addon.md](./kanji-addon.md). The MVP must not make it harder to add: items, unlock rules and sync treat it as more content.
- Speaking or listening comprehension beyond hearing each item pronounced.
- Automatic handwriting recognition (tracing is self-checked).
- Social features, leaderboards, notifications, a shop.
- Content beyond the starter set; the content format must make adding more a data-only change.
- Email, passwords, password reset.
- Spending tomatoes. They only earn collectables (§5.4).

## 4. Learning design

Each rule traces back to a finding in [research.md](./research.md).

| # | Rule | Why |
|---|---|---|
| L1 | Everything after an item's first introduction is a recall question. | Retrieval practice |
| L2 | A spaced repetition scheduler (FSRS, target 90% recall) decides when each item returns. | Spacing |
| L3 | New items arrive in "seed packets" of 5. A lesson ends only when each has been answered correctly twice in a mixed quiz. | Small batches, successive relearning |
| L4 | Each character has one short mnemonic, shown at introduction and available later as a hint. Using the hint lowers the grade. | Mnemonics help encoding, then fade |
| L5 | Wrong-answer options are look-alikes first (さ/ち, シ/ツ). Reviews mix all item types. | Interleaving |
| L6 | Audio plays on introduction and on every answer reveal. | Sound + shape |
| L7 | Exercises get harder as the plant grows: pick from choices → type the answer → produce the Japanese. | Desirable difficulty |
| L8 | Romaji is a typing bridge. Under words it disappears once the word's characters are past the seedling stage. | Avoid romaji dependence |
| L9 | A word unlocks when all its characters are learned; a grammar pattern unlocks when its example words are learned. | Characters get an immediate use |
| L10 | Default limit of 10 new items a day; due reviews come before new seeds. | Keep sessions short |
| L11 | Stroke order is animated for every character; finger tracing is optional and self-checked. | Handwriting aids recognition |

### 4.1 Content scope

| Unit | Items | Notes |
|---|---|---|
| Hiragana basics | 46 | gojūon rows, 5 per packet |
| Hiragana voiced | 25 | が-row … ぱ-row |
| Hiragana combos | 33 + 2 rules | きゃ etc.; small っ; long vowels |
| Katakana basics | 46 | same order |
| Katakana voiced + combos | 58 + 1 rule | plus the long-vowel mark ー |
| Vocabulary | ~130 | ~80 hiragana words, ~50 katakana loanwords |
| Grammar | ~12 | see below |

**Grammar patterns (proposed; every example is written in kana, for example いきます):**
A は B です · question か · これ/それ/あれ · possessive の · も (also) · negative じゃ ありません · object を + ます verbs · place に/へ + 行きます · place で + action · time に · adjectives (い/な) before nouns · あります/います

### 4.2 Item types and exercises

| Item | Seedling exercise | Grown exercise |
|---|---|---|
| Kana | see あ → pick the sound; hear the sound → pick the character | see あ → type `a` |
| Word | see いえ → pick the meaning | see "house" → build いえ from character tiles |
| Grammar | fill the missing particle | put shuffled tiles into a sentence |

Typed romaji accepts common variants (`shi`/`si`, `tsu`/`tu`, `fu`/`hu`, `ji`/`zi`, `wo`/`o` for を, `n`/`nn` for ん).

**Grading** is automatic: wrong → *Again*; right but used the hint or needed a second try → *Hard*; right → *Good*. There is no self-rating step.

### 4.3 Pronunciation audio

Accuracy matters more than where the sound comes from. A learner copies what they hear, so a wrong reading is worse than silence.

- Every kana sound, word and grammar example has a **short audio clip served by tomaja itself**, generated ahead of time and checked by ear before it ships. Hiragana and katakana share clips (あ and ア are one sound).
- **Browser speech is the fallback**, used only when a clip is missing or has not loaded. It is always given the kana reading.
- If neither is available the speaker button is hidden rather than playing something doubtful.
- Clips load on demand and are kept for offline use; they are not part of the first-load budget (§9).

## 5. Tomato mechanics

### 5.1 Growth stages

One plant per item. Stage is derived from the scheduler's memory stability (days until recall drops to 90%). Thresholds are starting values to tune.

| Stage | Meaning | Stability |
|---|---|---|
| Seed | not yet learned | — |
| Sprout | just planted | < 2 days |
| Seedling | taking root | 2–7 days |
| Flowering | holding | 7–21 days |
| Green tomato | nearly there | 21–45 days |
| Ripe tomato | known | ≥ 45 days |

A forgotten item drops back according to its new stability and shows as **wilting** until watered. Plants never die.

### 5.2 Vocabulary of the theme

| App concept | In the garden |
|---|---|
| Lesson | Planting a seed packet |
| Review session | Watering |
| Item due for review | Thirsty plant |
| Unit | Garden bed |
| Reference chart | Seed catalogue |
| Day with any study | Sunny day |
| Hint (mnemonic) | Plant label |

### 5.3 Tomatoes

- +1 tomato for each correct answer in a lesson or a due review.
- +5 the first time a plant ripens.
- Free practice outside the schedule earns nothing, so there is nothing to grind.
- Tomatoes are a running total and are never spent. What they earn is collectables (§5.4).

### 5.4 Collection

Reaching tomato totals and milestones adds a tomato **variety** to your basket, each with a small illustration and one line of trivia: Cherry (first lesson), Roma, Yellow Pear, Green Zebra, San Marzano, Beefsteak, and **Momotaro** — a real Japanese variety — for finishing hiragana. About 12 in total.

### 5.5 Sunny days

A week strip shows which days the garden was tended, plus a lifetime total. There is no streak counter that resets, no "you lost your streak" message, and no reminders.

### 5.6 Mascot

A small round tomato named **Toma** (トマ) reacts to answers (bounces when right, tilts sympathetically when wrong) and delivers the short lines of copy. Tone: warm, brief, never scolding.

## 6. Look and feel

- **Cute, minimalist, cheery.** One idea per screen, lots of cream-coloured space, big rounded shapes.
- **Palette:** tomato red `#E5493A`, leaf green `#4C9A5B`, cream `#FFF8EE`, sunshine `#FFC94D`, soft ink `#3B2F2F`. Check text contrast at AA.
- **Type:** one rounded typeface for Latin and Japanese (M PLUS Rounded 1c), subset to the characters the app uses. The character being studied is always huge.
- **Illustration:** flat inline SVG, drawn in code for the project: simple and cute first. Each drawing is its own component so better art can replace it later without touching anything else. No photos, no emoji as artwork.
- **Motion:** short and springy (plants pop, tomatoes drop into the basket). All motion is disabled under `prefers-reduced-motion`.
- **Sound effects:** none in the MVP; only pronunciation audio.

## 7. Screens

1. **Garden (home)** — beds of plants by stage, tomato total, week strip. One primary button: *Water N plants* when reviews are due, otherwise *Plant new seeds*.
2. **Planting (lesson)** — introduce → quick check → mixed quiz → summary with any newly unlocked words.
3. **Watering (review)** — question, answer, reveal with audio, next. Progress bar. Ends with tomatoes earned and plants that grew.
4. **Seed catalogue** — kana tables, word and grammar lists, each cell coloured by stage. Tap for details, mnemonic, stroke order, audio.
5. **Basket** — tomato total, varieties collected, simple stats (items per stage, sunny days).
6. **Settings** — account and sync, new-seeds-per-day, audio on/off, romaji help on/off, credits, delete data.

Bottom tab bar on phones: Garden · Catalogue · Basket · Settings.

## 8. Accounts and sync

The free Cloudflare database is small, so syncing is only for people who have been given the **secret code**. Everyone else can still use the whole app on one device.

There is **one code**. The owner sets it for the whole site and shares it with the people who may sync. A garden is identified by its name.

- **No account needed to start.** Progress is saved on the device immediately and uses no database space. A learner without the secret code never touches the database.
- **Create a synced garden** (Settings → *Sync my garden*): enter the secret code and choose a garden name.
- **On another device**, enter the same garden name and the secret code. Progress merges: for each item the most recently reviewed version wins; sunny days are combined.
- **Sign-up is closed by default.** If the owner has not set a secret code, no gardens can be created or signed in to.
- **Changing the secret code** leaves gardens and already signed-in devices alone. New devices need the new code.
- **A cap on the number of gardens** (default 500) is a second guard on database space. When it is reached, creating a garden says the plots are all taken; the app keeps working on the device.
- **What one code means for privacy:** anyone who has the secret code and knows a garden's name can open that garden. This is accepted because the code is only shared with trusted people and a garden holds nothing but learning progress. The app suggests choosing a garden name that is not easy to guess.
- **Privacy otherwise:** the server stores a garden name and learning progress. No email, no analytics, no third-party requests.
- A learner can delete their garden and all server data from Settings, which frees the space.

## 9. Platform requirements

- Deployed on Cloudflare as a single Worker serving the site and the API, with D1 for storage, at **https://tomaja.coodles.workers.dev/**. Fits the free plan.
- **Mobile first:** designed at 360 px wide; tap targets ≥ 48 px; works one-handed; respects safe-area insets. Scales up to desktop.
- **Fast:** first load ≤ 150 KB compressed including font; interactive in under 2 s on a mid-range phone on 4G; answers respond instantly because all learning logic runs on the device.
- **Offline:** installable PWA. Lessons and reviews work offline and sync when back online.
- **Accessible:** keyboard operable, screen-reader labels with correct `lang="ja"`, AA contrast, reduced motion.
- Supported browsers: current Safari (iOS), Chrome (Android), and current desktop Chrome, Safari, Firefox, Edge.

## 10. Success criteria

The MVP is done when:

1. A new visitor can start their first lesson within two taps and 10 seconds of landing.
2. A learner can complete all units using only a phone.
3. Progress made offline on one device appears on a second device after both have been online.
4. All content passes automated validation (no word uses an untaught character; no grammar example uses an untaught word).
5. The performance and accessibility requirements in §9 are met on a real iPhone and a real Android phone.
6. A garden cannot be created without the secret code, and studying without an account writes nothing to the database.
7. Every audio clip has been checked by ear against its reading.

## 11. Decisions

The questions that were open are all answered.

| # | Question | Decision |
|---|---|---|
| D1 | What is the secret code for? | It is the one code that allows syncing, because free database space is limited. It is needed to create a garden and to open it on another device. There is no second, per-garden code (§8). |
| D2 | Is kanji in the MVP? | No. Kanji is the first add-on after the MVP, with its own spec and plan: [kanji-addon.md](./kanji-addon.md), [kanji-addon-plan.md](./kanji-addon-plan.md). |
| D3 | Who draws the mascot and plant art? | Simple, cute SVG drawn in code during the build, made to be replaced later (§6). |
| D4 | Should tomatoes be spendable? | No. Tomatoes only earn collectable varieties (§5.3, §5.4). |
| D5 | Where does audio come from? | Whichever source is accurate: checked clips served by tomaja first, browser speech as fallback (§4.3). |
| D6 | Which address? | https://tomaja.coodles.workers.dev/ |

---

## Appendix: original brief

> # tomaja
>
> cute chill website to learn japanese characters
>
> ## objectives
>
> - learn japanese characters (hiragana, katakana, kanji, romanji) in an effective and engaging way
>     - research on the best learning techniques, to remember and recognise the characters
> - include learning of japanese vocab and grammar along the way as well as new characters are learnt
>     - this should be relevant to the characters earned
>
> ## theme & design
>
> - make it tomato themed
> - the design should be cute and minimalist and cheery
>
> ## gamefied mechanics
>
> - there should be some element of gamefied mechanics, such as tomato collecting
> - all learning mechanics should be on theme as well
>
> ## deployment
>
> - to be deployed using cloudflare
> - should allow account creation (with a secret code) so progress can be shared across multiple devices
> - must be compatible with mobile phone
> - efficient to load and seamless to use
