<!-- Seed catalogue: kana tables, words and grammar, each cell coloured by stage (spec §7.4). -->
<script lang="ts">
  import type { Item, ItemId, Kana, Script } from '../../../shared/content-types';
  import { isWilting, stageOf, STAGES, STAGE_LABELS, type Stage } from '../../engine/stage';
  import { app } from '../../store/progress.svelte';
  import ItemDetail from '../components/ItemDetail.svelte';
  import Sheet from '../components/Sheet.svelte';

  type Tab = 'hira' | 'kata' | 'words' | 'grammar';
  let tab = $state<Tab>('hira');
  let selected = $state<ItemId | null>(null);
  let open = $state(false);

  $effect(() => {
    void app.loadAllUnits();
  });

  const COLS = ['a', 'i', 'u', 'e', 'o'];

  function kanaTables(script: Script) {
    const rows: (Kana | null)[][] = [];
    const combos: Kana[] = [];
    // Each character packet is one gojūon row; place each kana under its vowel.
    for (const pk of app.content.kanaPackets) {
      const kana = pk.items.map((id) => app.content.items.get(id)).filter((k): k is Kana => k?.kind === 'kana' && k.script === script);
      if (!kana.length) continue;
      if (kana.some((k) => [...k.char].length > 1)) {
        combos.push(...kana);
        continue;
      }
      const row: (Kana | null)[] = [null, null, null, null, null];
      for (const k of kana) {
        let at = COLS.indexOf(k.romaji.slice(-1));
        if (at < 0) at = 2; // ん sits in the middle of its row
        if (row[at]) at = row.findIndex((x) => !x);
        row[at] = k;
      }
      rows.push(row);
    }
    const comboRows: (Kana | null)[][] = [];
    for (let i = 0; i < combos.length; i += 3) comboRows.push(combos.slice(i, i + 3));
    const rules = [...app.content.items.values()].filter((i) => i.kind === 'rule' && i.script === script);
    return { rows, comboRows, rules };
  }

  const tables = $derived((app.contentVersion, tab === 'hira' || tab === 'kata' ? kanaTables(tab) : null));
  const words = $derived((app.contentVersion, [...app.content.items.values()].filter((i) => i.kind === 'vocab')));
  const grammar = $derived((app.contentVersion, [...app.content.items.values()].filter((i) => i.kind === 'grammar')));

  function stage(id: ItemId): Stage {
    app.version;
    return stageOf(app.progress.items.get(id));
  }
  function wilt(id: ItemId) {
    app.version;
    return isWilting(app.progress.items.get(id));
  }
  function show(item: Item) {
    selected = item.id;
    open = true;
  }
</script>

<div class="catalogue">
  <h1>Seed catalogue</h1>
  <div class="tabs" role="tablist" aria-label="Catalogue sections">
    {#each [['hira', 'ひらがな'], ['kata', 'カタカナ'], ['words', 'Words'], ['grammar', 'Grammar']] as [key, label]}
      <button role="tab" aria-selected={tab === key} lang={key === 'hira' || key === 'kata' ? 'ja' : 'en'} onclick={() => (tab = key as Tab)}>{label}</button>
    {/each}
  </div>

  <ul class="legend" aria-label="Stage colours">
    {#each STAGES as s}<li><span class="dot st-{s}"></span>{STAGE_LABELS[s]}</li>{/each}
  </ul>

  {#if !app.allContentLoaded}
    <p class="muted">Opening the catalogue…</p>
  {:else if tables}
    <div class="table" role="grid" aria-label="Characters">
      {#each tables.rows as row}
        <div class="row" role="row">
          {#each row as k}
            {#if k}
              <button class="cell st-{stage(k.id)}" class:wilt={wilt(k.id)} role="gridcell" onclick={() => show(k)} aria-label="{k.char} {k.romaji}, {STAGE_LABELS[stage(k.id)]}">
                <span lang="ja" class="c">{k.char}</span><span class="r">{k.romaji}</span>
              </button>
            {:else}
              <span class="cell blank" role="gridcell"></span>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
    <h2>Combinations</h2>
    <div class="combos">
      {#each tables.comboRows.flat() as k}
        {#if k}
          <button class="cell st-{stage(k.id)}" onclick={() => show(k)} aria-label="{k.char} {k.romaji}, {STAGE_LABELS[stage(k.id)]}">
            <span lang="ja" class="c">{k.char}</span><span class="r">{k.romaji}</span>
          </button>
        {/if}
      {/each}
    </div>
    {#if tables.rules.length}
      <h2>Rules</h2>
      <div class="combos">
        {#each tables.rules as r}
          {#if r.kind === 'rule'}
            <button class="cell wide st-{stage(r.id)}" onclick={() => show(r)}>
              <span lang="ja" class="c">{r.char}</span><span class="r">{r.title}</span>
            </button>
          {/if}
        {/each}
      </div>
    {/if}
  {:else if tab === 'words'}
    <ul class="list">
      {#each words as w}
        {#if w.kind === 'vocab'}
          <li>
            <button class="line st-{stage(w.id)}" onclick={() => show(w)}>
              <span lang="ja" class="jp">{w.jp}</span>
              <span class="meaning">{stage(w.id) === 'seed' ? '' : w.meaning}</span>
            </button>
          </li>
        {/if}
      {/each}
    </ul>
  {:else}
    <ul class="list">
      {#each grammar as g}
        {#if g.kind === 'grammar'}
          <li>
            <button class="line st-{stage(g.id)}" onclick={() => show(g)}>
              <span lang="ja" class="jp">{g.title}</span>
            </button>
          </li>
        {/if}
      {/each}
    </ul>
  {/if}
</div>

<Sheet bind:open title="Seed details">
  {#if selected}<ItemDetail id={selected} />{/if}
</Sheet>

<style>
  .catalogue {
    display: grid;
    gap: var(--space-4);
  }
  h1 {
    font-size: var(--text-xl);
  }
  h2 {
    font-size: var(--text-m);
  }
  .tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: var(--white);
    border-radius: var(--radius-full);
    padding: 4px;
    box-shadow: var(--shadow);
  }
  .tabs button {
    min-height: 44px;
    border: none;
    border-radius: var(--radius-full);
    background: none;
    font-weight: 700;
    font-size: var(--text-s);
  }
  .tabs button[aria-selected='true'] {
    background: var(--tomato-strong);
    color: var(--white);
  }
  .legend {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
    font-size: 0.75rem;
    color: var(--ink-soft);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }
  .table {
    display: grid;
    gap: 6px;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  .combos {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .cell {
    min-height: 60px;
    border-radius: var(--radius-s);
    border: 2px solid transparent;
    display: grid;
    place-items: center;
    align-content: center;
    padding: 4px 2px;
    line-height: 1.1;
  }
  .cell.blank {
    background: none;
  }
  .cell.wilt {
    border-color: #7ec8e3;
    border-style: dashed;
  }
  .c {
    font-size: 1.5rem;
    font-weight: 700;
  }
  .r {
    font-size: 0.72rem;
    font-weight: 700;
  }
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 6px;
  }
  .line {
    width: 100%;
    min-height: var(--tap);
    border: none;
    border-radius: var(--radius-s);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 var(--space-4);
    text-align: left;
  }
  .jp {
    font-weight: 700;
    font-size: var(--text-l);
  }
  .meaning {
    font-size: var(--text-s);
    font-weight: 600;
  }
  /* stage colours: all keep AA contrast for the ink text */
  .st-seed {
    background: #f3e9da;
    color: #6e5c58;
  }
  .st-sprout {
    background: #e6f2d9;
  }
  .st-seedling {
    background: #c9e6c4;
  }
  .st-flowering {
    background: #ffe8a3;
  }
  .st-green {
    background: #cfe7a6;
  }
  .st-ripe {
    background: #f9b3a9;
  }
</style>
