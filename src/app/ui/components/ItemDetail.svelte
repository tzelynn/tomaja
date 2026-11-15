<script lang="ts">
  import type { ItemId } from '../../../shared/content-types';
  import { readingOf } from '../../../shared/content-types';
  import { app } from '../../store/progress.svelte';
  import { isWilting, stageOf, STAGE_LABELS } from '../../engine/stage';
  import Plant from '../art/Plant.svelte';
  import SpeakerButton from './SpeakerButton.svelte';
  import StrokeOrder from './StrokeOrder.svelte';

  let { id }: { id: ItemId } = $props();
  const item = $derived((app.contentVersion, app.item(id)));
  const state = $derived((app.version, app.progress.items.get(id)));
  const stage = $derived(stageOf(state));
  const due = $derived(state && state.lastReview > 0 ? new Date(state.card.dueAt) : null);
  const dueText = $derived.by(() => {
    if (!due) return null;
    const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
    return days <= 0 ? 'Thirsty now' : days === 1 ? 'Needs water tomorrow' : `Needs water in ${days} days`;
  });
</script>

{#if item}
  <div class="detail">
    <div class="head">
      <Plant {stage} wilting={isWilting(state)} size={56} />
      <div>
        <p class="stage">{STAGE_LABELS[stage]}{isWilting(state) ? ' · wilting' : ''}</p>
        {#if dueText}<p class="muted small">{dueText}</p>{/if}
      </div>
    </div>
    {#if item.kind === 'kana'}
      <p class="big" lang="ja">{item.char}</p>
      <p class="row"><strong>{item.romaji}</strong> <SpeakerButton reading={readingOf(item)} /></p>
      <p class="label"><span class="tag">Plant label</span>{item.mnemonic}</p>
      <StrokeOrder text={item.char} size={item.char.length > 1 ? 110 : 140} />
    {:else if item.kind === 'rule'}
      <p class="big" lang="ja">{item.char}</p>
      <p><strong>{item.title}</strong></p>
      <p>{item.explain}</p>
      <ul>
        {#each item.examples as ex}<li><span lang="ja">{ex.jp}</span> — {ex.romaji} <SpeakerButton reading={ex.jp} size={40} /></li>{/each}
      </ul>
    {:else if item.kind === 'vocab'}
      <p class="big word" lang="ja">{item.jp}</p>
      <p class="row"><strong>{item.romaji}</strong> <SpeakerButton reading={item.reading} /></p>
      <p class="meaning">{item.meaning}{item.altMeanings.length ? ` (${item.altMeanings.join(', ')})` : ''}</p>
    {:else}
      <p class="big word" lang="ja">{item.title}</p>
      <p>{item.explain}</p>
      <ul>
        {#each item.examples as ex}
          <li><span lang="ja">{ex.tiles.join(' ')}</span><br /><span class="muted">{ex.en}</span> <SpeakerButton reading={ex.reading} size={40} /></li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .detail {
    display: grid;
    gap: var(--space-3);
    justify-items: center;
    text-align: center;
  }
  .head {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    justify-self: stretch;
    text-align: left;
  }
  .stage {
    font-weight: 800;
  }
  .small {
    font-size: var(--text-s);
  }
  .big {
    font-size: 96px;
    line-height: 1;
    font-weight: 700;
  }
  .big.word {
    font-size: clamp(36px, 12vw, 64px);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-xl);
  }
  .meaning {
    font-size: var(--text-l);
    font-weight: 800;
    color: var(--tomato-ink);
  }
  .label {
    background: var(--sun-soft);
    border-radius: var(--radius-s);
    padding: var(--space-3);
    text-align: left;
  }
  .tag {
    display: block;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
    text-align: left;
    width: 100%;
  }
  li {
    background: var(--cream);
    border-radius: var(--radius-s);
    padding: var(--space-2) var(--space-3);
  }
</style>
