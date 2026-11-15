# tomaja — kanji add-on implementation plan

Builds the add-on described in [kanji-addon.md](./kanji-addon.md) on top of the finished MVP ([implementation-plan.md](./implementation-plan.md)). Section numbers marked "MVP plan" refer to that file.

Starts after the MVP has launched. The content writing in K1 needs no code and can be drafted earlier.

---

## 1. What the MVP already provides

The add-on relies on these, all of which the MVP plan builds:

| MVP feature | Used for |
|---|---|
| Content as validated JSON; prerequisites computed from content (MVP plan §4) | Kanji and kanji words are more content |
| Open-ended item ids, `<letter>:<text>` (MVP plan §8.3) | New prefix `j:` for kanji needs no server change |
| Unknown items survive sync (MVP plan §8.3) | Old app versions pass kanji progress through untouched |
| Per-character stroke files, loaded on demand (MVP plan §7.2) | Kanji strokes come from the same KanjiVG build |
| Audio clips keyed by reading (MVP plan §7.3) | Kanji word clips use the same pipeline |
| Scheduler, stages, queue, grading, rewards (MVP plan §6) | Unchanged |
| Garden cap sized for ~500 items per garden (MVP plan §8.3) | No capacity change |

**No database migration and no API change.**

## 2. Content model

Added to `src/shared/content-types.ts`:

```ts
interface Kanji { id: ItemId; kind: 'kanji'; char: string;          // id "j:山"
                  meaning: string; altMeanings: string[];
                  mnemonic: string; components: ItemId[];           // other kanji ids
}
```

`Vocab` is unchanged. A kanji word has kanji in `jp` and kana in `reading`:

```ts
{ id: "v:日よう日", kind: "vocab", jp: "日よう日", reading: "にちようび", romaji: "nichiyoubi", meaning: "Sunday", altMeanings: [] }
```

New and changed files:

- `content/kanji.json`: the ~80 kanji.
- `content/vocab.json`: ~70 kanji words added.
- `content/confusables.json`: look-alike kanji groups (人/入, 土/士, 日/目, 大/犬, 千/干 …).
- `content/units.json`: the *Kanji starter* bed and its packets, 5 kanji each, by theme.
- `content/varieties.json`: the kanji varieties.

**Computed prerequisites** (`build-content.ts`), extended:

- kanji → its `components`, plus the last katakana packet for the first kanji packet (this is what makes the bed open after katakana);
- vocab → every kana **and kanji** in `jp`.

**Validation** (`validate-content.ts`), added rules. The build fails when:

- a kanji is placed before one of its components;
- a kanji is used by fewer than two words;
- a kanji word's `reading` contains anything other than kana;
- a kanji `components` entry references a missing item;
- a kanji has no stroke data in the pinned KanjiVG release.

The existing rules (no word before its characters, mnemonic length, a checked audio clip for every word) already cover the new items.

## 3. Engine

Only `exercises.ts` and `unlocks.ts` change; both stay pure and unit-tested.

- **`exercises.ts`**
  - Kanji, sprout/seedling: show the kanji, pick the meaning from four.
  - Kanji, flowering onward: show the meaning, pick the kanji from four, distractors from `confusables` first, then same theme.
  - Kanji word, sprout/seedling: show the word with its reading above (furigana), pick the meaning.
  - Kanji word, flowering onward: show the word with no reading, build the reading from kana tiles with the existing `TileBuilder`.
  - Furigana fade (spec K7): hidden once every kanji in the word is past seedling. Same shape as the romaji fade already in the MVP.
- **`unlocks.ts`**: no logic change expected, since it follows `requires`. Add tests over the real kanji content: the bed is closed until katakana is done; 本 is unavailable until 木 is learned; each word appears right after its last kanji.
- **Simulation test** from MVP M2 re-run with the kanji bed added: daily reviews stay within the same ceiling.

## 4. User interface

- `KanjiCard` introduction: huge kanji, meaning, mnemonic, its parts as small tappable kanji, stroke order. No speaker button (spec §4.3).
- `Furigana` component using `<ruby>`, with `lang="ja"`; screen readers read the kana reading.
- Catalogue: kanji grid coloured by stage; detail sheet with meaning, mnemonic, parts, stroke order and "words with this kanji".
- Garden: the new bed. Basket: the new varieties, drawn in the same simple SVG style.

## 5. Assets

- **Font.** The kanji go in a second file, `tomaja-kanji.woff2`, produced by `subset-font.ts` from the kanji found in content and declared with `unicode-range`. Browsers fetch it only when a kanji is first rendered. The kana font file is unchanged. Preload the kanji font when the learner is one packet away from the kanji bed so the first kanji does not flash in a fallback font.
- **Strokes.** `build-strokes.ts` already works from the characters in content, so kanji stroke files appear without code changes. Check a sample by eye: KanjiVG kanji have more strokes and the animation timing may need a per-stroke cap.
- **Audio.** Run `generate-audio.ts` for the new word readings, listen to each, mark checked.
- **Offline.** Service worker: runtime caching already covers the new content, strokes, clips and font. Add the kanji unit to the precache only for learners who have reached it.

## 6. Milestones

### K1 — Content

- Finalise the kanji list against the two rules: components first, at least two words each. Drop or swap kanji that fail.
- Write `kanji.json` (meanings, mnemonics, components), the ~70 words, the confusable groups, the packets.
- Cross-check meanings and readings against KANJIDIC2 and JMdict (research.md §5.4).
- Extend `content-types.ts`, `build-content.ts`, `validate-content.ts`.

**Done when:** `npm run build` passes on the real kanji content and fails on three deliberately broken cases (kanji before its component, a kanji with one word, a word reading containing kanji).

### K2 — Engine and exercises

- The four exercise variants and the furigana fade in `exercises.ts`, with tests.
- Unlock tests over real content; simulation re-run.

**Done when:** engine tests pass with no DOM; the simulation shows no review pile-up.

### K3 — Interface and assets

- `KanjiCard`, `Furigana`, catalogue grid and detail sheet, the garden bed, varieties.
- Kanji font file with `unicode-range` and the preload; stroke check; audio clips generated and checked.
- Playwright: a profile that has finished katakana completes the first kanji packet and its first unlocked word.

**Done when:** on a real phone the first kanji lesson works end to end, and the network panel shows no kanji font, kanji strokes or kanji content requested by a brand-new visitor.

### K4 — Release

- Sync check across versions: device A on the new version learns kanji; device B still on the old cached version syncs, studies kana, syncs; device B then updates and shows A's kanji progress intact.
- Performance: first-load size and Lighthouse score equal to the MVP's.
- Accessibility: kanji and furigana are read correctly by VoiceOver and TalkBack; look-alike choices have enough size and contrast to tell apart.
- Credits updated if the add-on brings new data sources. Deploy to https://tomaja.coodles.workers.dev/; the PWA "update available" prompt delivers it.

**Done when:** the six success criteria in the add-on spec (§7) are demonstrated.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Writing 80 good mnemonics and 70 well-chosen words takes longer than the code | K1 is content only and can start before the MVP is finished; validation catches structural mistakes |
| A chosen kanji cannot get two beginner-level words | Rule K5 is enforced by validation; swap the kanji during K1 |
| Kanji font flashes or shifts layout on first display | Preload one packet ahead; fixed-size specimen box |
| An old cached app version drops kanji progress during sync | The MVP keeps unknown items (MVP plan §8.3); tested explicitly in K4 |
| Look-alike kanji are too hard at small sizes | Choices rendered at specimen size in a 2×2 grid; tested on a 360 px phone |
| Audio for a kanji word is read with the wrong reading | Clips are generated from the kana reading, never the kanji spelling, and checked by ear |
