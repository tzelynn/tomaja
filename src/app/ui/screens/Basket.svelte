<!-- Basket: tomato total, varieties collected, simple stats (spec §7.5). -->
<script lang="ts">
  import { totalTomatoes, varieties } from '../../engine/rewards';
  import { stageOf, STAGES, STAGE_LABELS, type Stage } from '../../engine/stage';
  import { app } from '../../store/progress.svelte';
  import Plant from '../art/Plant.svelte';
  import VarietyArt from '../art/VarietyArt.svelte';

  const total = $derived((app.version, totalTomatoes(app.progress)));
  const earned = $derived((app.version, new Set(varieties(app.content, app.progress).map((v) => v.id))));
  const perStage = $derived.by(() => {
    app.version;
    const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
    for (const e of app.content.index.items) counts[stageOf(app.progress.items.get(e.id))]++;
    return counts;
  });

  function hint(c: (typeof app.content.index.varieties)[number]['condition']): string {
    if ('tomatoes' in c) return `Collect ${c.tomatoes} tomatoes`;
    if ('sunnyDays' in c) return `Tend your garden on ${c.sunnyDays} days`;
    if ('ripe' in c) return c.ripe === 1 ? 'Ripen your first plant' : `Ripen ${c.ripe} plants`;
    if ('firstLesson' in c) return 'Plant your first seeds';
    const unit = app.content.index.units.find((u) => u.id === c.unitComplete);
    return c.unitComplete === 'hira-combos' ? 'Finish all of hiragana' : c.unitComplete === 'kata-more' ? 'Finish all of katakana' : `Finish ${unit?.title ?? 'a bed'}`;
  }
</script>

<div class="basket">
  <h1>Basket</h1>
  <div class="total">
    <VarietyArt id="round" colour="#e5493a" size={72} />
    <p><span class="num">{total}</span> tomatoes</p>
  </div>

  <section aria-labelledby="var-h">
    <h2 id="var-h">Varieties <span class="muted">{earned.size}/{app.content.index.varieties.length}</span></h2>
    <ul class="varieties">
      {#each app.content.index.varieties as v}
        {@const got = earned.has(v.id)}
        <li class:got>
          <VarietyArt id={v.id} colour={v.colour} size={64} locked={!got} />
          <p class="name">{got ? v.name : '???'}</p>
          <p class="small">{got ? v.trivia : hint(v.condition)}</p>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="stats-h">
    <h2 id="stats-h">Your garden</h2>
    <ul class="stats">
      {#each STAGES as s}
        <li>
          <Plant stage={s} size={40} />
          <span>{STAGE_LABELS[s]}</span>
          <strong>{perStage[s]}</strong>
        </li>
      {/each}
      <li class="sun">
        <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="#ffc94d" /></svg>
        <span>Sunny days</span>
        <strong>{app.progress.days.size}</strong>
      </li>
    </ul>
  </section>
</div>

<style>
  .basket {
    display: grid;
    gap: var(--space-5);
  }
  h1 {
    font-size: var(--text-xl);
  }
  h2 {
    font-size: var(--text-m);
    margin-bottom: var(--space-3);
  }
  .total {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    background: var(--white);
    border-radius: var(--radius-m);
    padding: var(--space-3) var(--space-4);
    box-shadow: var(--shadow);
    font-weight: 800;
    font-size: var(--text-l);
  }
  .num {
    font-size: 2.4rem;
    color: var(--tomato-ink);
  }
  .varieties {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--space-3);
  }
  .varieties li {
    background: var(--white);
    border-radius: var(--radius-m);
    padding: var(--space-3);
    display: grid;
    justify-items: center;
    text-align: center;
    gap: var(--space-1);
  }
  .varieties li.got {
    opacity: 1;
    box-shadow: var(--shadow);
  }
  .name {
    font-weight: 800;
  }
  .small {
    font-size: 0.8rem;
    color: var(--ink-soft);
  }
  .stats {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
  }
  .stats li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    background: var(--white);
    border-radius: var(--radius-s);
    padding: var(--space-1) var(--space-3);
  }
  .stats span {
    flex: 1;
    font-weight: 600;
  }
  .stats strong {
    font-size: var(--text-l);
  }
</style>
