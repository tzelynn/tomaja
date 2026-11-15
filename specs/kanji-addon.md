# tomaja — kanji add-on spec

The first addition after the MVP: a starter set of kanji and the words that use them.

- The product it adds to: [mvp.md](./mvp.md)
- How to build it: [kanji-addon-plan.md](./kanji-addon-plan.md)
- Evidence and reasoning: [research.md](./research.md) (§3 on kanji order and readings)

Everything in the MVP spec still applies: the garden, tomatoes, grading, audio, sync, look and feel. This document only describes what is new.

---

## 1. What it adds

A new garden bed, **Kanji starter**, that opens once the learner has finished katakana. It holds about 80 kanji and about 70 words written with them. The learner ends up able to recognise each kanji by meaning and read it inside common words.

## 2. Why it is separate from the MVP

Nothing technical blocks kanji. It is separate because of cost and timing:

1. **Writing the content is the big job.** Each kanji needs a meaning, a mnemonic and a parts list, and the words need ordering so simple shapes come before the kanji built from them. This is hand work.
2. **It depends on everything before it.** Kanji words are written with kana and use the word and grammar machinery from the MVP.
3. **It needs three exercise types nothing else uses** (§4).
4. **It adds weight:** 80 more glyphs in the font and 80 stroke files, which must load separately so the first load does not grow.
5. **Nobody needs it on day one.** At 10 new items a day a learner meets about 350 kana, words and patterns first, which is about five weeks.

## 3. Goals and non-goals

**Goals**

1. Learner can recognise about 80 kanji by meaning.
2. Learner can read those kanji inside about 70 common words.
3. A learner who is mid-way through the MVP content notices nothing until they reach the new bed. Nobody's existing progress changes.
4. The first-load size of the site does not grow.

**Non-goals**

- Lists of readings per kanji. Readings are learned through words (§4).
- Writing kanji from memory. Stroke order is shown and tracing is optional, as for kana.
- Changing words already learned in kana into kanji spellings.
- Kanji beyond the starter set. More sets should be a content-only change after this add-on.

## 4. Learning design

The MVP rules L1–L11 apply unchanged. Kanji adds:

| # | Rule | Why |
|---|---|---|
| K1 | A kanji card teaches **meaning and shape** only. | Memorising reading lists does not work well |
| K2 | Readings are learned through the words the kanji unlocks (日 → 日よう日 にちようび, 日本 にほん). | Readings stick in real words |
| K3 | Simple kanji come before the kanji built from them (木 before 本 and 休). The mnemonic for a built kanji refers to its parts. | Parts make shapes memorable |
| K4 | Kanji are grouped by theme, 5 per seed packet. | Small, related batches |
| K5 | Every kanji is used by at least two words in the set. | Each kanji gets an immediate use |
| K6 | Wrong-answer options are look-alike kanji first (人/入, 土/士, 日/目). | Tell similar shapes apart |
| K7 | Kanji words show their kana reading above the kanji at first; it disappears once the word's kanji are past the seedling stage. | Same idea as the romaji rule L8 |

### 4.1 Content scope

| Unit | Items | Notes |
|---|---|---|
| Kanji starter | ~80 kanji | list below, to be finalised during content work |
| Kanji words | ~70 words | each unlocks when all its kanji and kana are learned |

**Proposed kanji:**
numbers 一二三四五六七八九十百千万円 · calendar 日月火水木金土年時分半今週毎 · people 人子女男父母友先生学校名 · nature 山川田天気雨花空 · place 上下中外右左前後北南東西国 · describing 大小高安新古長白 · doing 見行来食飲読書聞話買出入休 · other 本何語電車間午

These are beginner (JLPT N5-level) kanji. Official JLPT lists have not been published since 2010, so "N5" here is a community approximation.

### 4.2 Exercises

| Item | Seedling exercise | Grown exercise |
|---|---|---|
| Kanji | see 山 → pick the meaning | see "mountain" → pick 山 among look-alikes |
| Kanji word | see 山 with reading shown → pick the meaning | see 山 with no reading → build the reading やま from kana tiles |

Grading, hints and tomatoes work exactly as in the MVP.

### 4.3 Audio

A kanji on its own has no single pronunciation, so a kanji card has no speaker button. Kanji words have checked clips like every other word (MVP spec §4.3).

## 5. Garden and collection

- A new bed in the garden and a kanji grid in the seed catalogue, each cell coloured by stage. The detail sheet shows meaning, mnemonic, parts, stroke order, and the words that use the kanji.
- One or two new tomato varieties for kanji milestones (first kanji packet, whole bed ripe).

## 6. Platform

- Kanji glyphs and stroke files load only when first needed. The first-load budget in the MVP spec (§9) is unchanged.
- Kanji progress syncs through the existing account system with no server change. A device that has not updated yet keeps kanji progress it receives and passes it on untouched.
- A garden with the add-on fully learned is about 200 KB in the database, up from about 130 KB. The garden cap in the MVP already allows for this.

## 7. Success criteria

The add-on is done when:

1. A learner who has finished katakana is offered the first kanji packet, and one who has not is offered nothing new.
2. No kanji is introduced before its parts, and no word before every character in it. This is checked automatically.
3. Every kanji is used by at least two words.
4. First-load size is the same as before the add-on.
5. Kanji progress made on one device appears on another, including when one of them was running the older version.
6. Every kanji word's audio clip has been checked by ear.

## 8. Open questions

| # | Question | Default taken |
|---|---|---|
| K-Q1 | Is the proposed list of ~80 the right set? | Yes as a starting point; finalise while writing the words, dropping any kanji that cannot get two good words |
| K-Q2 | Should words already learned in kana later appear in their kanji spelling? | No. Kanji words are new items |
| K-Q3 | Should kanji open only after all of katakana, or earlier for learners who want it? | After katakana |
