# tomaja — implementation plan

Builds the product described in [mvp.md](./mvp.md). Reasons for the choices are in [research.md](./research.md).

The plan is nine milestones. Each ends in something that runs and can be checked. Milestones 0–5 produce a launchable hiragana app with sync; 6–7 add the rest of the content; 8 is polish and launch.

Kanji is not part of this plan. It is the first add-on after the MVP: [kanji-addon.md](./kanji-addon.md) and [kanji-addon-plan.md](./kanji-addon-plan.md). §8.3 and §12 list the few things this plan does to keep that add-on easy.

---

## 1. Architecture

```
 Phone / browser                                  Cloudflare
┌──────────────────────────────────┐      ┌──────────────────────────────┐
│ Svelte SPA (PWA)                 │      │ one Worker                   │
│  ├ content/   static JSON, lazy  │ GET  │  ├ static assets (dist/)     │
│  ├ engine/    FSRS, queue,       │◄─────┤  │   free, served first      │
│  │            unlocks, grading   │      │  └ /api/*  (Hono)            │
│  ├ store/     IndexedDB          │ POST │      ├ account, session      │
│  └ sync/      batch push/pull    ├─────►│      └ sync ──► D1 (SQLite)  │
└──────────────────────────────────┘      └──────────────────────────────┘
```

**Principles**

1. **Local first.** All learning logic and state live on the device. The server only stores and merges progress. Answers never wait on the network; the app works offline.
2. **Content is data.** Characters, words, grammar and unlock rules are JSON checked by a validation script. Adding more content later is mostly a data change.
3. **One deployable.** A single Worker serves the built site and the API on the same origin, so there is no CORS and cookies are first-party.
4. **Small.** No UI framework runtime to speak of, no CSS framework, one subset font.

## 2. Stack

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript, strict | shared types between app, content and API |
| UI | Svelte 5 + Vite (plain SPA, no SvelteKit) | very small bundles; built-in transitions suit the springy motion; no server rendering needed |
| Routing | tiny hash/History router (≈50 lines) or `svelte-spa-router` | six screens |
| Styling | plain CSS with custom properties as design tokens | nothing to download |
| Local storage | IndexedDB through `idb` | structured, async, enough quota |
| Scheduler | `ts-fsrs` behind `engine/scheduler.ts` | FSRS; see caution in §6.1 |
| API | Hono on Cloudflare Workers | small, typed, good Workers support |
| Database | Cloudflare D1 | SQL, generous free writes (KV's 1,000 writes/day is too low) |
| Dev/deploy | `@cloudflare/vite-plugin` + Wrangler ≥ 4.20 | runs the Worker inside Vite dev; needed for `run_worker_first` |
| Offline | `vite-plugin-pwa` (Workbox) | precache shell + content |
| Tests | Vitest (unit), `@cloudflare/vitest-pool-workers` (API against local D1), Playwright (mobile viewport end-to-end) | |
| Strokes | KanjiVG paths, custom `<StrokeOrder>` component | Japanese stroke order, CC BY-SA |
| Audio | Self-hosted MP3 clips, generated ahead of time; Speech Synthesis API as fallback | accuracy first (spec §4.3); clips are static assets, so free to serve |
| Font | M PLUS Rounded 1c, subset at build | cute, one file for Latin + Japanese |

If React is preferred over Svelte, substitute Preact + signals; nothing outside `src/app/ui` changes.

## 3. Repository layout

```
tomaja/
├ specs/
├ content/                      source of truth for learning content (hand-edited)
│  ├ kana.hiragana.json
│  ├ kana.katakana.json
│  ├ vocab.json
│  ├ grammar.json
│  ├ confusables.json
│  ├ units.json                 beds and packets, in teaching order
│  ├ varieties.json             collectible tomato varieties
│  └ audio/                     checked pronunciation clips (committed) + manifest.json
├ scripts/
│  ├ generate-audio.ts          run by hand: makes clips for readings that have none
│  ├ validate-content.ts        fails the build on bad content
│  ├ build-content.ts           content/ → public/content/*.json (per unit, minified)
│  ├ build-strokes.ts           KanjiVG → public/strokes/*.json (only used characters)
│  └ subset-font.ts             font → public/fonts/tomaja.woff2
├ src/
│  ├ shared/                    types used by app, scripts and worker
│  │  ├ content-types.ts
│  │  └ sync-types.ts
│  ├ app/
│  │  ├ main.ts
│  │  ├ engine/                 pure logic, no DOM, fully unit-tested
│  │  │  ├ scheduler.ts         FSRS wrapper
│  │  │  ├ stage.ts             stability → growth stage
│  │  │  ├ unlocks.ts           which items are available
│  │  │  ├ queue.ts             builds lesson and review sessions
│  │  │  ├ exercises.ts         picks exercise type + distractors
│  │  │  ├ grading.ts           answer → rating; romaji matching
│  │  │  └ rewards.ts           tomatoes, varieties, sunny days
│  │  ├ store/
│  │  │  ├ db.ts                IndexedDB schema + migrations
│  │  │  └ progress.svelte.ts   reactive state over the db
│  │  ├ sync/
│  │  │  ├ client.ts            push/pull, retry, online detection
│  │  │  └ merge.ts             same merge rule as the server
│  │  ├ audio/play.ts           clip first, browser speech as fallback
│  │  └ ui/
│  │     ├ tokens.css
│  │     ├ components/          Button, Card, Plant, Toma, StrokeOrder, ChoiceGrid, TileBuilder, RomajiInput, WeekStrip…
│  │     └ screens/             Garden, Planting, Watering, Catalogue, Basket, Settings
│  └ worker/
│     ├ index.ts                Hono app
│     ├ auth.ts                 secret code check, sessions, rate limit
│     └ sync.ts
├ migrations/                   D1 SQL
├ tests/                        e2e
├ wrangler.jsonc
├ vite.config.ts
└ package.json
```

## 4. Content model

```ts
// src/shared/content-types.ts
type ItemId = string;                    // "h:あ" "k:ト" "v:いえ" "g:wa-desu"

interface Kana  { id: ItemId; kind: 'kana'; script: 'hira' | 'kata';
                  char: string; romaji: string; accept: string[];   // ["shi","si"]
                  mnemonic: string; }
interface Vocab { id: ItemId; kind: 'vocab'; jp: string;            // as displayed: にちようび
                  reading: string; romaji: string;                  // にちようび / nichiyoubi
                  meaning: string; altMeanings: string[]; }
interface Grammar { id: ItemId; kind: 'grammar'; title: string; explain: string;
                  examples: { tiles: string[]; reading: string; en: string;
                              blank?: number }[];                   // index of particle to fill
                  usesVocab: ItemId[]; }

interface Unit   { id: string; title: string; packets: Packet[]; }  // a garden bed
interface Packet { id: string; items: ItemId[]; }                   // ≤ 5 new characters, or a word/grammar batch
```

**Prerequisites are computed, not written.** `build-content.ts` derives `requires` for each item:

- vocab → every kana appearing in `jp`
- grammar → its `usesVocab`

**Validation (`validate-content.ts`) fails the build when:**

- an id is duplicated or malformed;
- a word contains a character that is not an item;
- a word in a packet comes before a character it needs;
- a grammar example tile is neither a known word nor a particle on the allowed list;
- a kana `accept` list is missing its Hepburn form;
- a `confusables` entry references a missing item;
- a mnemonic is missing or longer than 140 characters;
- a kana, word or grammar example has no clip in `content/audio/manifest.json`, or its clip is not marked as checked (§7.3).

Built content is emitted per unit (`/content/hira-basic.json`, …) plus a small `index.json` with ids, kinds, requires and packet order, so the garden can render without loading every unit.

## 5. Progress model (device)

IndexedDB database `tomaja`, version 1:

| Store | Key | Value |
|---|---|---|
| `items` | `itemId` | `ItemState` |
| `days` | `YYYY-MM-DD` (local date) | `{ day, rev }` |
| `meta` | string | profile, settings, sync cursor, device id |
| `outbox` | `itemId` or `day:…` | marker for changes not yet pushed |

```ts
interface ItemState {
  itemId: ItemId;
  card: SchedulerCard;     // opaque FSRS card: due, stability, difficulty, reps, lapses, state…
  lastReview: number;      // ms epoch; 0 if never — the merge key
  tomatoes: number;        // earned from this item
  ripenedAt: number | null;
}
```

Everything shown in the UI is derived from these: stage from `card.stability`, tomato total from `Σ tomatoes`, varieties from the total plus milestones, sunny days from `days`. Because totals are sums over per-item records, merging two devices can never corrupt a counter.

## 6. Learning engine

All modules in `src/app/engine` are pure functions over content and state, with the clock passed in.

### 6.1 `scheduler.ts`

```ts
interface Scheduler {
  newCard(now: Date): SchedulerCard;
  review(card: SchedulerCard, rating: 'again' | 'hard' | 'good', now: Date): SchedulerCard;
  isDue(card: SchedulerCard, now: Date): boolean;
  stability(card: SchedulerCard): number;   // days
}
```

Target retention 0.90, maximum interval 365 days, default parameters, no per-user optimisation in the MVP.

**Verify first (M2, step 1):** the `ts-fsrs` README currently describes a v6 with an async `DefaultScheduler()` and a separate binding package, unlike the older `fsrs()` / `createEmptyCard()` API. Before writing the wrapper: install, read `packages/fsrs/README.md`, confirm it runs in the browser without WASM surprises, and measure its bundled size. If v6 is heavy or awkward in the browser, pin the latest pure-TypeScript v5. The rest of the app only sees the interface above. Serialised cards must round-trip through JSON (dates as ISO strings).

### 6.2 `stage.ts`

`seed | sprout | seedling | flowering | green | ripe` from stability with the thresholds in the spec (§5.1), kept in one constants object for tuning. `wilting = isDue && lapsedOnLastReview`.

### 6.3 `unlocks.ts`

- An item is **learned** once it has an `ItemState` with `lastReview > 0`.
- An item is **available** when all `requires` are learned and its packet's predecessor packet in the unit is fully learned.
- Character packets are offered in unit order. Word and grammar items are injected as their own packets as soon as they become available, so new words appear right after the characters that enable them.

### 6.4 `queue.ts`

- `nextAction(state, now)` → `'water' | 'plant' | 'rest'` for the home button: reviews first; new seeds only if due reviews ≤ 5 and today's new-item count is under the limit; otherwise rest ("All watered. See you tomorrow.").
- `reviewSession(state, now)` → up to 20 due items, most overdue first, then shuffled so that item kinds mix and two confusable items are not adjacent.
- `lessonSession(packet)` → the step list for Planting:
  1. for each item: **introduce** (character, audio, mnemonic, stroke order, optional trace) → **check** (one multiple-choice question on it);
  2. after items 3 and 5: mini mixed quiz of items so far;
  3. final mixed quiz, repeating until every item has two correct answers; a wrong answer re-shows the introduction card and re-queues the item three places later;
  4. summary: plants planted, tomatoes earned, newly unlocked words.
- A session that is abandoned keeps the reviews already answered; unfinished lesson items stay unplanted.

### 6.5 `exercises.ts`

Chooses exercise by item kind and stage (spec §4.2): choice at sprout/seedling, typed or tile-building from flowering onward, with one in four reviews of grown items using the reverse direction.

Distractors (3 per question): confusables first, then same unit, then same kind; only learned items, except in a learner's first packets where unlearned neighbours are allowed to fill the grid. Never two options with the same accepted answer.

### 6.6 `grading.ts`

- `matchRomaji(input, kana)` — trims, lowercases, checks the `accept` list.
- `matchMeaning(input, item)` — for typed meanings: case-insensitive, ignores leading "to "/"a "/"the ", allows edit distance 1 on words longer than 4 letters. (Typed meanings are only used on desktop; phones get choices.)
- `rate(result)` — wrong → `again`; hint used or second attempt → `hard`; else `good`.

### 6.7 `rewards.ts`

- `+1` tomato on each correct lesson or due-review answer (once per item per session); `+5` and `ripenedAt = now` when stage first becomes `ripe`.
- `varieties(state)` — evaluates `varieties.json` conditions (`tomatoes >= n`, `unitComplete: 'hira-basic'`, `sunnyDays >= n`).
- `markSunnyDay(now)` — records the local date.

### 6.8 Unit tests (Vitest)

Scheduler round-trip and monotonic stage growth on repeated `good`; a lapse lowers the stage; unlock graph over the real content (after packet 1, exactly the expected words are available); queue ordering and the confusable-adjacency rule; lesson completes only after two correct per item; romaji variants for every kana; rewards are idempotent per session; merge rule (§8.3).

## 7. User interface

### 7.1 Design system (`ui/tokens.css`, `ui/components`)

- Tokens: the five palette colours with tints, spacing scale (4 px base), radii (12/20/full), one shadow, type scale with a 96–144 px "specimen" size for the studied character.
- Art is simple, cute SVG drawn in code. `Plant`, `Toma` and each tomato variety are self-contained components with a fixed viewBox and props (`stage`, `wilting`, `mood`), so better artwork can replace the insides later without changing any caller.
- Components: `Button` (primary/quiet), `Card`, `ProgressBar`, `ChoiceGrid` (2×2, 64 px cells), `RomajiInput` (autocapitalize off, autocorrect off, `inputmode="text"`, `enterkeyhint="done"`), `TileBuilder` (tap tiles to assemble, tap to remove), `Plant` (one SVG with six stage variants and a wilting modifier), `Toma` (mascot with idle/happy/oops states), `StrokeOrder`, `SpeakerButton`, `WeekStrip`, `TabBar`, `Sheet` (bottom sheet for details).
- All Japanese text carries `lang="ja"`. Focus styles are visible. Animations use transform/opacity only and are wrapped in a `prefers-reduced-motion` check.

### 7.2 `StrokeOrder`

Loads `/strokes/<codepoint>.json` (array of SVG path strings in order, viewBox 109×109 from KanjiVG). Draws all strokes faintly, then animates each with `stroke-dasharray`/`stroke-dashoffset`. Tracing mode overlays a `<canvas>` capturing pointer events; the learner draws over the guide and taps *Looks right* / *Show again*. No recognition.

### 7.3 Audio (`audio/play.ts`, `content/audio/`)

Accuracy first (spec §4.3): a checked clip when there is one, browser speech only as the fallback.

**Clips**

- One clip per **reading**, not per item, so あ and ア share a file, as do a word and any other item with the same reading. About 104 kana sounds, 130 words and 40 grammar examples: roughly 275 files.
- Format: MP3, mono, about 48 kbps, silence trimmed, loudness normalised. A kana clip is about 4 KB; the whole set is about 1.5 MB. MP3 is chosen because every supported browser plays it.
- `content/audio/manifest.json` maps reading → `{ file, source, checked }`. The build copies clips to `/audio/<content-hash>.mp3` and writes the reading → URL map into each unit's content file.
- `scripts/generate-audio.ts` is run by hand, not in the build. It finds readings with no clip, generates them, and adds them to the manifest with `checked: false`. A person then listens to each new clip against its reading and sets `checked: true`. Validation (§4) refuses unchecked clips, so nothing unheard can ship. Clips are committed, so a normal build needs no audio tool and no network.
- **Choose the source first (M3, step 1).** Requirements: natural Japanese pitch on single kana, licence allows redistributing the files from a public site, credit terms can be met on the credits page. Candidates: a locally run open-source voice (VOICEVOX), a cloud neural voice, or openly licensed native recordings. Generate the 46 basic sounds with the leading candidate, listen to all of them, and confirm the licence before generating the rest. Particles get care: the kana は is recorded as "ha"; the particle reading "wa" appears only inside grammar example clips.

**Playback**

- `play(reading)`: plays the clip through one reused `<audio>` element; if there is no clip or it fails to load, falls back to `speak(reading)`.
- `speak(text)`: waits for `voiceschanged` (with retries), picks a voice matching `/^ja[-_]JP/i`, sets `lang = 'ja-JP'` and rate 0.9. It is always given the kana reading.
- `canPlay(reading)` is true when a clip exists or a Japanese voice exists; speaker buttons hide when it is false.
- Playback starts inside tap handlers; automatic playback on reveal is attempted and silently skipped if blocked.
- Clips for the packet being learned are fetched when the lesson opens, so audio is instant. The service worker caches clips as they are played and precaches those of the current unit (M8).

### 7.4 Screens

Built in this order: Planting → Watering → Garden → Catalogue → Basket → Settings. Layout targets 360×640 first; from 720 px wide the content column is capped at 480 px and centred with the tab bar becoming a side rail.

First-run: the Garden shows an empty bed, Toma, and one button, *Plant your first seeds* — no sign-up, no tutorial carousel.

## 8. Accounts and sync

There is **one code** (spec §8): the **secret code**, set per deployment as the Wrangler secret `SIGNUP_CODE`. It is required to create a garden and to sign in to one on another device. It exists to protect the small free database. A garden is identified by its name alone; there is no per-garden credential.

Guests never call the API, so they cost no database space or Worker requests.

### 8.1 Database (`migrations/0001_init.sql`)

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,               -- random 128-bit, hex
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  rev         INTEGER NOT NULL DEFAULT 0,     -- per-user change counter
  created_at  INTEGER NOT NULL
);
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,               -- SHA-256 of the cookie value
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE item_state (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  state       TEXT NOT NULL,                  -- JSON ItemState
  last_review INTEGER NOT NULL,
  rev         INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX item_state_rev ON item_state(user_id, rev);
CREATE TABLE days (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,
  rev         INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE profile (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,                  -- JSON settings
  updated_at  INTEGER NOT NULL,
  rev         INTEGER NOT NULL
);
CREATE TABLE attempts (                       -- secret-code and sign-up throttling
  key          TEXT PRIMARY KEY,              -- "code:<ip>" or "create:<ip>"
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
```

### 8.2 API

All under `/api`, JSON, same origin. Session cookie: `tomaja_session`, `HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=1 year`, renewed on use. State-changing routes also require the header `X-Tomaja: 1` (a cheap CSRF guard that forms cannot send).

| Route | Body → Response | Notes |
|---|---|---|
| `POST /api/account` | `{ name, secretCode }` → `{ name }` + cookie | create a garden. Name 3–20 chars, letters/digits/`-`/`_`; 403 if the secret code is wrong; 409 if the name is taken; 503 if syncing is closed or full |
| `POST /api/session` | `{ name, secretCode }` → `{ name }` + cookie | sign in on another device. 403 if the secret code is wrong; 404 if there is no such garden |
| `DELETE /api/session` | → 204 | sign out this device |
| `GET /api/me` | → `{ name }` or 401 | |
| `DELETE /api/account` | → 204 | cascades everything |
| `POST /api/sync` | `SyncRequest` → `SyncResponse` | see below |

**Secret code.** Both `POST /api/account` and `POST /api/session` check, in this order:

1. `SIGNUP_CODE` is set. If not, syncing is closed: 503. A deployment that forgets the secret can never be open by accident.
2. The throttle (below).
3. The submitted `secretCode`, trimmed and lowercased, equals `SIGNUP_CODE`. Both sides are hashed with SHA-256 and the digests compared in constant time. Otherwise 403.

Then `POST /api/account` checks that `SELECT COUNT(*) FROM users` is below `MAX_GARDENS` (otherwise 503, "plots are all taken") and that the name is free (otherwise 409). `POST /api/session` checks that the garden exists (otherwise 404; this is only reachable with the right code).

The secret code is never stored in D1 and never sent back to the client. Rotating it is `wrangler secret put SIGNUP_CODE`; gardens and existing sessions are unaffected, and new devices need the new code. Because the code is the only protection, it should be long: four or more random words. The deploy notes say so.

**Accepted trade-off.** Anyone holding the secret code who knows a garden name can open, change or delete that garden. The data is only learning progress, the code is shared with trusted people, and the Settings screen suggests a garden name that is hard to guess. A device always keeps its own local copy.

**Throttling.** 5 wrong secret codes per IP per 15 minutes and 20 per IP per day; 5 gardens created per IP per day. Counted in `attempts`; returns 429 with `Retry-After`.

**Housekeeping.** A daily Cron Trigger deletes expired sessions and `attempts` rows older than a day, so only real gardens take up space.

### 8.3 Sync protocol

```ts
interface SyncRequest  { cursor: number;                // highest server rev this device has seen
                         items: ItemState[]; days: string[];
                         profile?: { data: Settings; updatedAt: number } }
interface SyncResponse { cursor: number;
                         items: ItemState[]; days: string[];
                         profile?: { data: Settings; updatedAt: number } }
```

Server, in one D1 `batch` (transactional):

1. `rev = users.rev + 1`.
2. For each incoming item: upsert **only if** `incoming.lastReview > stored.last_review` (or no row). Stamp with `rev`.
3. Insert unseen days with `rev`. Upsert profile if `updatedAt` is newer.
4. Save `users.rev = rev` if anything was written.
5. Return every row with `rev > request.cursor` that this request did not itself just write, and the new cursor.

**Merge rule (identical on client in `merge.ts`):** per item, greater `lastReview` wins whole; days are a set union; profile is last-write-wins. Reviewing the same item on two offline devices keeps the later review and drops the earlier — acceptable, since the later review reflects the more recent memory state.

Client (`sync/client.ts`):

- Triggers: app start, session end, tab becoming visible, coming back online, and at most once every 30 s while dirty.
- Sends everything in `outbox`; on success clears those markers, applies the response, stores the cursor. On failure, keeps the outbox and backs off (5 s → 5 min).
- Limits: ≤ 500 items per request, chunked if larger. Body limit 256 KB enforced server-side; item ids validated against a general pattern (`<letter>:<text>`, not a list of known kinds); `state` size capped at 1 KB.
- **Unknown items are kept.** A device stores and re-syncs item states whose ids are not in its content, without showing them. This lets a later add-on such as kanji sync through devices that have not updated yet.
- **First sign-in on a device with guest progress:** send the full local state with `cursor: 0`; the normal merge handles it. The UI says "Merged your garden" with counts.

**Capacity check**

- *Writes:* a 20-item session is one request and about 21 row writes (plus index writes). The free plan's 100,000 row writes/day covers a few thousand sessions a day.
- *Space:* one `item_state` row is about 350 bytes with its index entry. A garden with all ~350 items learned is about 130 KB, or about 200 KB once the kanji add-on brings it to ~500 items; a typical one is far smaller. `MAX_GARDENS = 500` therefore tops out near 100 MB in the worst case, add-on included, well inside the free plan. Confirm the free-plan size limit per database when creating it in M0 (believed to be 500 MB) and set `MAX_GARDENS` from that.
- Deleting a garden cascades and frees its rows.

### 8.4 Worker tests

With `@cloudflare/vitest-pool-workers` against local D1: create → sign-in round trip; create and sign-in are both refused with a wrong secret code and with `SIGNUP_CODE` unset; create is refused at `MAX_GARDENS`; sign-in to an unknown garden is 404; wrong secret codes are throttled; an existing session still works after the secret code is changed; an item with an unknown id kind round-trips; the cron handler removes expired sessions and stale attempts; sync idempotency (same request twice changes nothing); LWW in both orders; cursor returns only unseen rows; account deletion removes all rows; unauthenticated sync is 401.

## 9. Configuration

```jsonc
// wrangler.jsonc
{
  "name": "tomaja",
  "main": "./src/worker/index.ts",
  "compatibility_date": "2026-11-15",
  "assets": {
    "directory": "./dist/",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "tomaja", "database_id": "<from wrangler d1 create>", "migrations_dir": "migrations" }
  ],
  "vars": { "MAX_GARDENS": "500" },
  "triggers": { "crons": ["0 3 * * *"] }
}
```

The Worker name `tomaja` on the `coodles` account subdomain gives the production address **https://tomaja.coodles.workers.dev/**. No custom domain.

Secrets: `SIGNUP_CODE` only (the secret code; syncing stays closed until it is set). Local values in `.dev.vars` (git-ignored).

Scripts: `dev` (vite), `build` (validate-content → build-content → build-strokes → subset-font → vite build), `test`, `test:e2e`, `deploy` (build → `wrangler d1 migrations apply tomaja --remote` → `wrangler deploy`).

Caching: hashed assets `immutable` for a year via `public/_headers`; `index.html` and the service worker `no-cache`; content JSON hashed by the build.

## 10. Milestones

Each lists what to build and how to know it is done.

### M0 — Skeleton and first deploy

- `git init`; `.gitignore`; Node 24+; `npm create vite` (Svelte + TS); add Hono, Wrangler, `@cloudflare/vite-plugin`, Vitest.
- Worker with `GET /api/health`; SPA placeholder page using the palette and font stack.
- `wrangler d1 create tomaja`; empty migration applied locally and remotely; first `wrangler deploy`.

- Note the free-plan D1 size limit shown for the new database and adjust `MAX_GARDENS` (§8.3).

**Done when:** https://tomaja.coodles.workers.dev/ shows the placeholder on a phone and `/api/health` returns `ok`; `npm test` runs.

### M1 — Content pipeline and hiragana data

- `content-types.ts`; `validate-content.ts`; `build-content.ts`.
- Write `kana.hiragana.json` (46 basics with mnemonics and accept lists), `confusables.json`, `units.json` for hiragana basics, and the first ~40 hiragana-only words in `vocab.json`.
- `build-strokes.ts`: download a pinned KanjiVG release into a git-ignored cache, extract paths for the characters in content, write `/strokes/*.json`; record version and licence in `CREDITS.md`.
- `subset-font.ts` (using `subset-font`): Latin + all characters found in content.

**Done when:** `npm run build` fails on a deliberately broken word and passes on real content; the font file is under 80 KB.

### M2 — Learning engine

- Resolve the `ts-fsrs` version question (§6.1), then `scheduler.ts`.
- `stage.ts`, `unlocks.ts`, `queue.ts`, `exercises.ts`, `grading.ts`, `rewards.ts` with the tests in §6.8.
- A simulation test: a scripted learner answering 90% correctly for 60 simulated days never gets more than ~25 reviews in a day at 10 new items/day and reaches ripe plants on the expected timeline. Use it to tune stage thresholds and the daily limit.

**Done when:** all engine tests pass with no DOM and no network.

### M3 — Playable hiragana (guest)

- `store/db.ts`, `progress.svelte.ts`.
- Audio (§7.3): choose and licence-check the clip source first; `generate-audio.ts`; clips for the 46 basic sounds and the first words, each listened to and marked checked; `play.ts` with the speech fallback.
- Design tokens and components; `StrokeOrder`.
- Planting and Watering screens end to end; minimal Garden with the single action button.
- Playwright test at 390×844: complete packet 1, reload, state persists; advance the clock, a review is due and can be completed.

**Done when:** on a real phone you can learn あ-row, close the tab, return and water it; keyboard never covers the question; audio plays on tap from a clip, and still plays through browser speech when clips are blocked in a test.

### M4 — The garden

- `Plant` stage art, `Toma`, growth and harvest animations.
- Garden beds, tomato counter, week strip; session summary screens.
- Basket with varieties; `varieties.json` (~12).
- Seed catalogue with stage colouring and detail sheet.

**Done when:** every number on screen is derived from `items`/`days` (verified by clearing and re-importing state in a test), and reduced-motion mode shows no animation.

### M5 — Accounts and sync

- Migration `0001_init.sql`; `auth.ts`; `sync.ts`; tests in §8.4.
- `sync/client.ts`, `merge.ts`, outbox.
- Cron handler for housekeeping; `MAX_GARDENS` check.
- Settings: *Sync my garden* with two choices, *Start a new garden* and *Open my garden from another device*; both ask for garden name + secret code. Sign out, delete garden, sync status line ("Synced just now" / "Will sync when online"). Clear messages for a wrong secret code, name taken, no such garden, syncing closed, and plots all taken. A hint to pick a garden name that is hard to guess.

**Done when:** two browsers signed into one garden converge after each studies offline; a garden cannot be created or opened without the secret code; wrong codes are throttled; a guest session makes no `/api` requests; deleting the garden empties D1 for that user.

**→ First public launch is possible here** (hiragana basics with words and sync), after the M8 checklist.

### M6 — Words and grammar in full

- Remaining hiragana (voiced, combos, small っ, long vowels) as rule-aware items.
- `TileBuilder` exercise; romaji fade rule (spec L8).
- `grammar.json` first 6 patterns; fill-the-particle and sentence-ordering exercises; grammar detail page in the catalogue.
- Unlocked-words panel in lesson summaries.

**Done when:** validation proves every example sentence is readable at its unlock point; a learner finishing hiragana has met ≥ 80 words and 6 patterns.

### M7 — Katakana

- `kana.katakana.json` with mnemonics; cross-script confusables; katakana units; ~50 loanwords starting with トマト; remaining grammar patterns that need them.
- Mixed-script reviews.

**Done when:** the Momotaro and katakana-completion varieties can be earned in a simulated run; font subset still under budget.

### M8 — Offline, performance, accessibility, launch

- `vite-plugin-pwa`: manifest, icons, precache shell + `index.json` + current unit; runtime cache for other content and strokes; "update available" prompt.
- Performance pass against the budget: Lighthouse mobile ≥ 95 performance; total first load ≤ 150 KB compressed; no layout shift when the font loads (`font-display: swap` with a metric-matched fallback).
- Accessibility pass: axe clean; full keyboard path through a lesson; VoiceOver and TalkBack read questions and Japanese correctly; contrast AA.
- Real-device matrix: recent iPhone Safari, Android Chrome, one small 360 px Android; installed-PWA mode; aeroplane mode session then sync.
- Precache the current unit's audio clips; runtime cache for the rest.
- Credits page (KanjiVG, font, FSRS, audio voice or recordings) and a short privacy note.
- Production at https://tomaja.coodles.workers.dev/: set `SIGNUP_CODE`; apply migrations; deploy; smoke test, including creating a garden with the secret code and being refused without it.

**Done when:** the success criteria in the spec (§10) are demonstrated on real phones.

## 11. Risks

| Risk | Mitigation |
|---|---|
| `ts-fsrs` v6 API or packaging does not suit the browser | Wrapper interface; decide in M2 step 1; v5 fallback |
| A pronunciation is wrong or unnatural | Own clips, each listened to before it ships; validation refuses unchecked clips; browser speech only as fallback |
| No clip source has both good single-kana audio and a licence that allows redistribution | Decide in M3 step 1 on the 46 basic sounds before generating more; fall back to openly licensed native recordings for kana and speech for the rest |
| The database fills up | Secret code required to sign up; `MAX_GARDENS` cap; guests use no space; daily cleanup; garden deletion frees rows |
| The secret code leaks | Rotate with `wrangler secret put SIGNUP_CODE`; existing gardens and signed-in devices unaffected; cap and throttle limit the damage meanwhile |
| Writing ~210 kana mnemonics and ~130 words is the largest single task | Spread over M1, M6, M7; validation catches structural mistakes; draft mnemonics in bulk then edit by hand |
| Review pile-ups make it stop feeling chill | Daily new-item limit; M2 simulation; session cap of 20 with "that's plenty for today" |
| Someone with the secret code opens another person's garden by its name | Accepted (§8.2): trusted group, progress data only, hard-to-guess name hint, each device keeps a local copy |
| A learner forgets their garden name | Shown in Settings on every signed-in device |
| Last-write-wins drops one of two simultaneous offline reviews | Accepted; documented in §8.3 |
| Licence obligations for stroke data | Credits page; publish derived stroke files under CC BY-SA; keep the build script that produces them |
| Free-plan limits | One sync request per session; static content never touches the Worker |

## 12. After the MVP

**Kanji add-on first** ([kanji-addon.md](./kanji-addon.md), [kanji-addon-plan.md](./kanji-addon-plan.md)). What this plan does to keep it easy: prerequisites are computed from content, item ids are open-ended, unknown items survive sync (§8.3), strokes and audio are built per character and per reading, and the garden cap already allows for the extra rows.

Then: native-speaker recordings in place of generated clips; replacement artwork; per-user FSRS optimisation from a synced review log; more collectable varieties; more vocabulary packs; listening exercises; dark mode; optional gentle reminders.
