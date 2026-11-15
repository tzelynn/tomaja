<!-- Introducing a new item (Planting step 1): character, sound, mnemonic, stroke order. -->
<script lang="ts">
  import type { Item } from '../../../shared/content-types';
  import { readingOf } from '../../../shared/content-types';
  import { play } from '../../audio/play';
  import Button from './Button.svelte';
  import SpeakerButton from './SpeakerButton.svelte';
  import StrokeOrder from './StrokeOrder.svelte';

  let { item, again = false, onnext }: { item: Item; again?: boolean; onnext: () => void } = $props();
  let showStrokes = $state(false);

  $effect(() => {
    // Audio on introduction (spec L6); silently skipped if the browser blocks it.
    void play(readingOf(item));
    showStrokes = item.kind === 'kana' && !again;
  });
</script>

<article class="intro" aria-labelledby="intro-title">
  {#if again}<p class="again">Let's look at this one again</p>{/if}
  {#if item.kind === 'kana'}
    <p class="kind">New {item.script === 'hira' ? 'hiragana' : 'katakana'}</p>
    <h2 id="intro-title" class="specimen" lang="ja">{item.char}</h2>
    <div class="sound">
      <span class="romaji">{item.romaji}</span>
      <SpeakerButton reading={readingOf(item)} />
    </div>
    <div class="label" role="note"><span class="tag">Plant label</span>{item.mnemonic}</div>
    {#if showStrokes}
      <StrokeOrder text={item.char} size={item.char.length > 1 ? 120 : 150} />
    {:else}
      <button class="link" onclick={() => (showStrokes = true)}>How to write it</button>
    {/if}
  {:else if item.kind === 'rule'}
    <p class="kind">New rule</p>
    <h2 id="intro-title" class="specimen" lang="ja">{item.char}</h2>
    <p class="title">{item.title}</p>
    <p class="explain">{item.explain}</p>
    <div class="label" role="note"><span class="tag">Plant label</span>{item.mnemonic}</div>
    <ul class="examples">
      {#each item.examples.slice(0, 3) as ex}
        <li><span lang="ja" class="ex-jp">{ex.jp}</span> <span class="muted">{ex.romaji}</span> <SpeakerButton reading={ex.jp} size={40} /></li>
      {/each}
    </ul>
  {:else if item.kind === 'vocab'}
    <p class="kind">New word</p>
    <h2 id="intro-title" class="word" lang="ja">{item.jp}</h2>
    <div class="sound">
      <span class="romaji">{item.romaji}</span>
      <SpeakerButton reading={item.reading} />
    </div>
    <p class="meaning">{item.meaning}</p>
  {:else}
    <p class="kind">New grammar</p>
    <h2 id="intro-title" class="title" lang="ja">{item.title}</h2>
    <p class="explain">{item.explain}</p>
    <ul class="examples">
      {#each item.examples.slice(0, 3) as ex}
        <li class="sentence">
          <span lang="ja" class="ex-jp">{ex.tiles.join(' ')}</span>
          <span class="muted">{ex.en}</span>
          <SpeakerButton reading={ex.reading} size={40} />
        </li>
      {/each}
    </ul>
  {/if}
  <div class="next"><Button wide onclick={onnext}>Got it</Button></div>
</article>

<style>
  .intro {
    display: grid;
    gap: var(--space-3);
    justify-items: center;
    text-align: center;
  }
  .kind,
  .again {
    font-size: var(--text-s);
    font-weight: 800;
    color: var(--leaf-strong);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .again {
    color: var(--tomato-ink);
  }
  .specimen {
    font-size: var(--specimen);
    line-height: 1;
    font-weight: 700;
    animation: grow 0.45s var(--spring);
  }
  .word {
    font-size: clamp(56px, 16vw, 88px);
    line-height: 1.1;
    animation: grow 0.45s var(--spring);
  }
  .sound {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .romaji {
    font-size: var(--text-xl);
    font-weight: 800;
  }
  .meaning {
    font-size: var(--text-xl);
    font-weight: 800;
    color: var(--tomato-ink);
  }
  .title {
    font-size: var(--text-xl);
  }
  .explain {
    max-width: 36ch;
  }
  .label {
    background: var(--sun-soft);
    border-radius: var(--radius-s);
    padding: var(--space-3) var(--space-4);
    max-width: 40ch;
    position: relative;
    text-align: left;
  }
  .tag {
    display: block;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
  }
  .examples {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
    width: 100%;
  }
  .examples li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    background: var(--white);
    border-radius: var(--radius-s);
    padding: var(--space-2) var(--space-3);
    text-align: left;
  }
  .sentence {
    flex-wrap: wrap;
  }
  .sentence .muted {
    flex-basis: 100%;
    order: 3;
    font-size: var(--text-s);
  }
  .ex-jp {
    font-size: var(--text-l);
    font-weight: 700;
  }
  .link {
    background: none;
    border: none;
    color: var(--tomato-ink);
    font-weight: 700;
    text-decoration: underline;
    min-height: var(--tap);
  }
  .next {
    width: 100%;
    margin-top: var(--space-2);
  }
  @keyframes grow {
    from {
      transform: scale(0.6);
      opacity: 0;
    }
  }
</style>
