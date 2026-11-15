<!-- Garden (home): beds of plants, tomato total, week strip, and one primary button (spec §7.1). -->
<script lang="ts">
  import type { ItemId } from '../../../shared/content-types';
  import { nextAction } from '../../engine/queue';
  import { totalTomatoes } from '../../engine/rewards';
  import { isWilting, stageOf } from '../../engine/stage';
  import { app } from '../../store/progress.svelte';
  import Plant from '../art/Plant.svelte';
  import Toma from '../art/Toma.svelte';
  import Button from '../components/Button.svelte';
  import ItemDetail from '../components/ItemDetail.svelte';
  import Sheet from '../components/Sheet.svelte';
  import WeekStrip from '../components/WeekStrip.svelte';
  import { go } from '../router.svelte';

  let now = $state(new Date());
  let selected = $state<ItemId | null>(null);
  let sheetOpen = $state(false);

  // Refresh "now" when the tab comes back so due counts are current.
  $effect(() => {
    const onVis = () => document.visibilityState === 'visible' && (now = new Date());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  });

  const action = $derived((app.version, nextAction(app.content, app.progress, app.sched, now)));
  const tomatoes = $derived((app.version, totalTomatoes(app.progress)));
  const days = $derived.by(() => {
    app.version;
    return new Set(app.progress.days);
  });
  const firstRun = $derived((app.version, app.progress.items.size === 0));

  const beds = $derived.by(() => {
    app.version;
    return app.content.index.units
      .map((u) => {
        const plants = app.content.index.items
          .filter((e) => e.unit === u.id && (app.progress.items.get(e.id)?.lastReview ?? 0) > 0)
          .map((e) => {
            const s = app.progress.items.get(e.id);
            const due = !!s && app.sched.isDue(s.card as never, now);
            return { id: e.id, stage: stageOf(s), wilting: isWilting(s), thirsty: due };
          });
        const total = app.content.index.items.filter((e) => e.unit === u.id).length;
        return { ...u, plants, total };
      })
      .filter((b) => b.plants.length > 0);
  });

  function labelOf(id: ItemId): string {
    app.contentVersion;
    const it = app.item(id);
    if (!it) return '';
    return it.kind === 'kana' || it.kind === 'rule' ? it.char : it.kind === 'vocab' ? it.jp : '文';
  }

  const line = $derived.by(() => {
    if (firstRun) return 'Hello! I’m Toma. Shall we plant your first seeds?';
    if (action.kind === 'water') return action.due === 1 ? 'One plant looks thirsty.' : `${action.due} plants look thirsty.`;
    if (action.kind === 'plant') return 'New seeds are ready to plant.';
    if (action.reason === 'limit') return 'All watered. That’s plenty for today. See you tomorrow!';
    return 'Every seed is planted. Keep watering and watch them ripen.';
  });

  function open(id: ItemId) {
    selected = id;
    sheetOpen = true;
  }
</script>

<div class="garden">
  <header class="top">
    <h1 class="sr-only">Your garden</h1>
    <div class="count" aria-label="{tomatoes} tomatoes">
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
        <circle cx="12" cy="14" r="8" fill="#e5493a" />
        <path d="M12 6 l-4 -1.5 l2.5 2.5 l-4 .8 l4.5 .4 l-1.5 2.5 l2.5 -2 l2.5 2 l-1.5 -2.5 l4.5 -.4 l-4 -.8 l2.5 -2.5z" fill="#4c9a5b" />
      </svg>
      <span>{tomatoes}</span>
    </div>
    <p class="sunny muted">{app.progress.days.size} sunny day{app.progress.days.size === 1 ? '' : 's'}</p>
  </header>

  <section class="hero" aria-live="polite">
    <Toma mood={action.kind === 'rest' ? 'sleepy' : 'idle'} size={firstRun ? 128 : 96} />
    <p class="bubble">{line}</p>
    <div class="cta">
      {#if action.kind === 'water'}
        <Button wide variant="leaf" onclick={() => go('water')}>Water {action.due} plant{action.due === 1 ? '' : 's'}</Button>
        {#if action.canPlant}
          <Button wide variant="quiet" onclick={() => go('plant')}>Plant new seeds</Button>
        {/if}
      {:else if action.kind === 'plant'}
        <Button wide onclick={() => go('plant')}>{firstRun ? 'Plant your first seeds' : 'Plant new seeds'}</Button>
      {/if}
    </div>
  </section>

  <WeekStrip {days} {now} />

  {#if firstRun}
    <div class="bed empty" role="img" aria-label="An empty garden bed">
      <Plant stage="seed" size={56} />
      <Plant stage="seed" size={56} />
      <Plant stage="seed" size={56} />
    </div>
  {:else}
    {#each beds as bed (bed.id)}
      <section class="bed-wrap" aria-labelledby="bed-{bed.id}">
        <h2 id="bed-{bed.id}">{bed.title} <span class="muted">{bed.plants.length}/{bed.total}</span></h2>
        <ul class="bed">
          {#each bed.plants as p (p.id)}
            <li>
              <button
                class="plant-btn"
                class:thirsty={p.thirsty}
                onclick={() => open(p.id)}
                aria-label="{labelOf(p.id)}, {p.stage}{p.wilting ? ', wilting' : ''}{p.thirsty ? ', thirsty' : ''}"
              >
                <Plant stage={p.stage} wilting={p.wilting} size={44} />
                <span lang="ja" class="char" class:small={labelOf(p.id).length > 2}>{labelOf(p.id)}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</div>

<Sheet bind:open={sheetOpen} title="Plant details">
  {#if selected}<ItemDetail id={selected} />{/if}
</Sheet>

<style>
  .garden {
    display: grid;
    gap: var(--space-5);
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .count {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 800;
    font-size: var(--text-xl);
    background: var(--white);
    padding: var(--space-1) var(--space-4) var(--space-1) var(--space-2);
    border-radius: var(--radius-full);
    box-shadow: var(--shadow);
  }
  .sunny {
    font-weight: 700;
    font-size: var(--text-s);
  }
  .hero {
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    text-align: center;
  }
  .bubble {
    background: var(--white);
    border-radius: var(--radius-m);
    padding: var(--space-3) var(--space-4);
    font-weight: 700;
    box-shadow: var(--shadow);
    position: relative;
    max-width: 32ch;
  }
  .bubble::before {
    content: '';
    position: absolute;
    top: -8px;
    left: 50%;
    margin-left: -8px;
    border: 8px solid transparent;
    border-top: 0;
    border-bottom-color: var(--white);
  }
  .cta {
    display: grid;
    gap: var(--space-3);
    width: 100%;
  }
  .bed-wrap h2 {
    font-size: var(--text-m);
    margin-bottom: var(--space-2);
  }
  .bed {
    list-style: none;
    margin: 0;
    padding: var(--space-3) var(--space-2);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: var(--space-1);
    background: linear-gradient(180deg, #ead3b4, #e2c39b);
    border-radius: var(--radius-m);
    box-shadow: inset 0 -4px 0 rgba(164, 118, 80, 0.35);
  }
  .bed.empty {
    display: flex;
    justify-content: space-around;
    padding: var(--space-5);
  }
  .plant-btn {
    width: 100%;
    min-height: 72px;
    border: none;
    background: none;
    display: grid;
    justify-items: center;
    padding: 2px;
    border-radius: var(--radius-s);
  }
  .plant-btn.thirsty {
    background: rgba(126, 200, 227, 0.25);
  }
  .char {
    font-weight: 700;
    font-size: 0.95rem;
    line-height: 1.1;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .char.small {
    font-size: 0.7rem;
  }
</style>
