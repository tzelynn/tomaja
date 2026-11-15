# tomaja — research notes

Research behind the decisions in [mvp.md](./mvp.md) and [implementation-plan.md](./implementation-plan.md).

**How to read the evidence labels**

- **[checked]** — looked up during this research pass (November 2026); source linked.
- **[background]** — well-known finding cited from memory, not re-read in this pass. Verify before quoting it publicly.
- **[practice]** — practitioner consensus (teachers, apps, guides), not controlled research.

---

## 1. How people actually remember characters

### 1.1 Retrieval practice beats re-reading

Testing yourself produces much better long-term retention than re-studying the same material, even when the test feels harder.

- Dunlosky et al. (2013) reviewed ten study techniques and rated only two as **high utility**: practice testing and distributed practice. **[checked]**
- Roediger & Karpicke (2006), the classic "testing effect" result. **[background]**

**Decision:** every screen after the first introduction of a character is a question. There is no "flip through the chart" mode that counts as study. The kana chart exists as a reference, not as the learning loop.

### 1.2 Spacing beats cramming

Reviews spread over increasing intervals beat the same number of reviews massed together (Cepeda et al. 2006 meta-analysis **[background]**; Dunlosky 2013 "high utility" **[checked]**).

**Decision:** a spaced repetition scheduler decides when each item comes back. See §3.

### 1.3 Successive relearning

Recalling an item correctly several times in the first session, then again in later spaced sessions, combines both effects (Rawson & Dunlosky 2011 **[background]**).

**Decision:** a lesson does not end until each new character has been answered correctly twice in a mixed quiz. Only then is it handed to the scheduler.

### 1.4 Mnemonics help the first encounter, not the long run

- Picture/keyword mnemonics that link a character's shape to its sound (き looks like a **key**) are the most common recommendation for kana. **[practice]**
- A conference paper on hiragana apps reports mnemonics beating rote memorisation; Matsunaga has published on mnemonics for kana retention. Neither was read in full. **[checked that they exist, not their results]**
- Counterweight: Dunlosky 2013 rates the keyword mnemonic **low utility** overall, because the advantage fades and it does not generalise. A 2021 meta-analysis puts mnemonics at d ≈ 0.50. **[checked]**

**Decision:** every character gets one short mnemonic, shown on first introduction and available as a hint afterwards. The mnemonic is a scaffold for the first few days; retrieval and spacing carry the rest. Using the hint lowers the grade for that review.

### 1.5 Interleave look-alikes

Mixing items you might confuse forces you to notice what distinguishes them ("discriminative contrast"). Dunlosky 2013 rates interleaving moderate utility. **[checked]** Kornell & Bjork (2008). **[background]**

**Decision:** multiple-choice distractors are drawn first from a hand-written confusables table (さ/ち/き, ぬ/め, わ/ね/れ, る/ろ, は/ほ, シ/ツ, ソ/ン, ク/ケ/タ, and cross-script pairs such as か/カ, り/リ, へ/ヘ). Review sessions shuffle all item types together.

### 1.6 Short and daily

Several short sessions beat one long one. **[practice, consistent with 1.2]**

**Decision:** a session is 3–5 minutes. New items are capped per day (default 10) so reviews never snowball.

### 1.7 Sound and shape together

Pairing each character with its sound gives two retrieval routes (dual coding, Paivio **[background]**). Kana are a sound system; learning them silently through romaji bakes in English pronunciation.

**Decision:** audio on every introduction and every answer reveal. Romaji is the typing bridge, not the thing being learned (see §2.1).

### 1.8 Handwriting

Handwriting characters improves later visual recognition compared with typing them (Longcamp et al. 2005 **[background]**). Often recommended for kana. **[practice]**

**Decision:** stroke-order animation plus an optional finger-tracing step in lessons. Tracing is self-assessed and does not affect scheduling. Automatic stroke recognition is out of scope for the MVP.

---

## 2. Japanese-specific choices

### 2.1 Romaji is a bridge, not a goal

The original brief lists "romanji" as a character set to learn. Romaji (ローマ字) is Latin-alphabet transcription; an English reader already knows it. The risk is the opposite: learners who lean on romaji read slowly for a long time. **[practice]**

**Decision:** romaji appears (a) as the typed answer for kana, and (b) under vocabulary only until every character in the word has left the seedling stage. After that it is hidden behind a tap.

### 2.2 Order

- Hiragana first, in gojūon rows (あ-row, か-row, …), five at a time. Then voiced marks (dakuten/handakuten), then combinations (yōon), small っ and long vowels.
- Katakana second, same order. First katakana word: **トマト**.
- Kanji third. There is no research consensus on the best kanji order (JLPT lists, school grade, frequency and component-based orders all have advocates). **[checked — sources disagree]**

**Decision for kanji (now a post-MVP add-on, see [kanji-addon.md](./kanji-addon.md)):** a starter set of about 80 beginner (JLPT N5-level) kanji, ordered so that simple shapes come before the kanji built from them (日, 月 before 明; 木 before 本, 休), and grouped by theme (numbers, days of the week, people, nature, directions). Note that official JLPT kanji lists have not been published since 2010; "N5 kanji" lists are community approximations.

### 2.3 Readings through words

Kanji have several readings. Memorising reading lists per kanji is widely considered ineffective; learning one meaning plus the readings that occur in real words works better. **[practice]**

**Decision:** a kanji card teaches meaning and shape. Readings are learned through the vocabulary that the kanji unlocks (日 → 日よう日 にちようび, 日本 にほん).

### 2.4 Vocabulary and grammar ride on the characters

A word is unlocked the moment every character in it has been learned. After the first five hiragana the learner can already read あい (love), いえ (house), うえ (above), あおい (blue), いいえ (no). This gives the characters an immediate purpose and gives extra, varied retrieval of each character.

Grammar points are unlocked by vocabulary in the same way, and are taught as short patterns with examples built only from words the learner knows (これ は トマト です).

---

## 3. Scheduling algorithm

**FSRS** rather than SM-2.

- SM-2 (1987) keeps one "ease" number per card with fixed constants. FSRS models difficulty, stability and retrievability per card and can be fitted to review history. **[checked]**
- Anki has shipped FSRS as an option since 23.10 and its docs state it needs fewer reviews than the old algorithm for the same retention. **[checked]** Third-party figures of 20–30% fewer reviews are unverified.
- `ts-fsrs` is the MIT-licensed TypeScript implementation from the open-spaced-repetition project. **[checked]**

**Caution on `ts-fsrs` versions.** The repository README currently describes v6: FSRS-7 by default, Node ≥ 24, and an async API (`await DefaultScheduler()`, `scheduler.newCard()`, `scheduler.review({card, grade, now})`) that differs from the v4/v5 API (`fsrs()`, `createEmptyCard()`, `f.next()`) seen in most tutorials. The mention of a separate `binding` package suggests native/WASM parts. This was read through a summariser, so **confirm the API, bundle size and browser support at install time**. The plan isolates the library behind one module so either version, or a fallback, can be swapped in.

**Useful property:** FSRS "stability" is the number of days until recall probability falls to 90%. That single number maps directly onto plant growth stages (§4).

---

## 4. Gamification

Evidence here is thin and mostly commentary. **[checked]**

- Streaks do motivate: an INSEAD study found people will do unpleasant things to keep one alive. The same finding is the problem — streak-loss anxiety makes people serve the streak rather than the learning.
- Claims that gamification erodes intrinsic motivation (overjustification) are contested for language learning.
- The common design advice is to tie rewards to the real activity rather than bolt on points.

**Decisions:**

- The reward *is* the memory model. Each character is a tomato plant; its growth stage is its memory stability. Nothing is earned that does not reflect something learned.
- No punishment. A forgotten item wilts back a stage; it never dies. Missing a day costs nothing.
- "Sunny days" counts days on which the garden was tended, shown per week. It does not reset to zero.
- Tomatoes come only from lessons and due reviews, so there is nothing to farm.

---

## 5. Platform

### 5.1 Cloudflare

- **Workers with static assets** is where Cloudflare now directs new projects; Pages still works but new features land in Workers. **[checked]** One Worker serves the built site and the API.
- Static asset requests are free and unlimited. Worker (API) requests: 100,000/day and 10 ms CPU per request on the free plan. **[checked]**
- **D1** free plan: 5 million rows read/day, 100,000 rows written/day, 5 GB. Queries fail once a daily limit is exceeded. **[checked]** A single free-plan database is believed to be limited to 500 MB within that 5 GB; confirm when creating the database. A garden with every item learned is about 130 KB (about 200 KB once the kanji add-on exists), so space is the reason sign-up is gated by a secret code and capped.
- **KV** free plan allows only 1,000 writes/day, so it is unsuitable for progress data. **[checked]**
- SPA routing: `assets.not_found_handling = "single-page-application"` plus `run_worker_first = ["/api/*"]` (Wrangler ≥ 4.20). **[checked]**

**Consequences:** password hashing with a slow KDF does not fit in 10 ms CPU, so nothing is password-hashed: the one site-wide secret code lives in a Worker secret, is compared with a fast constant-time check, and is protected from guessing by throttling. Sync must batch: one request per session, not one per answer.

### 5.2 Audio

The browser Speech Synthesis API is supported on iOS Safari and Android Chrome, but: voices come from the OS and a Japanese voice is not guaranteed; voices load asynchronously; playback needs a user gesture; some Android builds report `ja_JP` rather than `ja-JP`; Firefox for Android has no synthesis. **[checked]**

Speech synthesis is also weakest exactly where a beginner needs it most: a single kana said alone can come out clipped, oddly pitched, or read as a particle (は as "wa", へ as "e"). **[practice]**

**Decision (revised):** accuracy comes first. The MVP serves its own pre-generated clips for every kana sound, word and grammar example (about 275 short files, roughly 1.5 MB in total, loaded on demand), each checked by ear before it ships. Speech synthesis stays as the fallback for a missing clip, with feature detection; the speaker button is hidden when neither exists. The clip source is chosen at the start of the audio work from candidates whose licence allows redistribution (a locally run open-source Japanese voice such as VOICEVOX, a cloud neural voice, or openly licensed native recordings). The licence and credit terms of whichever is chosen must be confirmed then; they have not been checked yet. Must be tested on real phones.

### 5.3 Stroke order data

| Source | Covers | Licence | Notes |
|---|---|---|---|
| KanjiVG | kana + kanji, Japanese stroke order | CC BY-SA 3.0 | SVG paths per stroke; needs own renderer |
| animCJK | 177 kana, 7,343 kanji | kana: LGPL; kanji: Arphic Public License | includes median paths for animation |
| Hanzi Writer | renderer + quiz (MIT) | data is Chinese (Make Me a Hanzi) | Chinese stroke order differs for some characters |

**[checked]**

**Decision:** KanjiVG, rendered with a small custom SVG component (animate `stroke-dashoffset` per stroke). Attribution on a credits page; the derived stroke data files are published under CC BY-SA. This is a reading of the licence, not legal advice.

### 5.4 Dictionary data

JMdict and KANJIDIC2 (EDRDG, CC BY-SA 4.0 **[background]**) are used only to cross-check hand-curated vocabulary and kanji meanings. The MVP content set is small enough (~300 items) to curate by hand, which also avoids shipping dictionary-style glosses to beginners.

### 5.5 Fonts

Full Japanese webfonts are several megabytes. A rounded font suits the theme (M PLUS Rounded 1c or Zen Maru Gothic, both SIL OFL **[background]**). Subsetting to kana + the MVP kanji + Latin brings it to tens of kilobytes.

---

## Sources

- [Dunlosky et al. 2013, Improving Students' Learning With Effective Learning Techniques](https://journals.sagepub.com/doi/abs/10.1177/1529100612453266)
- [Frontiers in Education 2021 meta-analysis of learning techniques](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2021.581216/full)
- [Matsunaga, Journal of the NCOLCTL (2009)](https://doaj.org/article/af5ca5db2c014ed2aa0b0dbf67be6406)
- [Mnemonic hiragana app conference paper](https://www.atlantis-press.com/article/125911420.pdf)
- [Anki FAQ: what spaced repetition algorithm](https://docs.ankiweb.net/faqs/what-spaced-repetition-algorithm)
- [Main differences between SM-2 and FSRS](https://l-m-sherlock.notion.site/What-are-the-main-differences-between-SM-2-and-FSRS-135c250163a180ca9029ea460136254c)
- [RemNote: the FSRS algorithm](https://help.remnote.com/en/articles/9124137-the-fsrs-spaced-repetition-algorithm)
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)
- [INSEAD: consumer streaks are motivating](https://knowledge.insead.edu/marketing/consumer-streaks-are-motivating-key-keeping-them-alive)
- [The Decision Lab: streak creep](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)
- [Cloudflare Workers pricing and limits](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare: SPA routing with static assets](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Cloudflare: Workers vs Pages compatibility matrix](https://developers.cloudflare.com/workers/static-assets/compatibility-matrix)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [caniuse: Speech Synthesis API](https://caniuse.com/speech-synthesis)
- [Readium: SpeechSynthesis in browsers and OSes](https://readium.org/speech/docs/WebSpeech.html)
- [Web Speech API pitfalls in a Japanese quiz](https://dev.to/sendotltd/i-built-a-japanese-poetry-quiz-and-the-web-speech-api-showed-me-its-teeth-3bce)
- [KanjiVG](https://kanjivg.tagaini.net/)
- [animCJK](https://github.com/parsimonhi/animCJK)
- [Hanzi Writer](https://hanziwriter.org/)
- [WaniKani community: kanji order](https://community.wanikani.com/t/is-there-any-specific-order-in-which-kanji-and-words-on-wanikani-are-taught/42149)
