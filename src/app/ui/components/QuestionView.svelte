<!--
  One recall question of any type. Reports the result once the learner moves on.
  Grading (spec §4.2): wrong → again; hint or second try → hard; right → good.
-->
<script lang="ts">
  import type { Question } from '../../engine/exercises';
  import { checkAnswer, type AnswerResult } from '../../engine/grading';
  import { play } from '../../audio/play';
  import { app } from '../../store/progress.svelte';
  import ChoiceGrid from './ChoiceGrid.svelte';
  import RomajiInput from './RomajiInput.svelte';
  import TileBuilder from './TileBuilder.svelte';
  import SpeakerButton from './SpeakerButton.svelte';
  import Button from './Button.svelte';

  let {
    question: q,
    hintAllowed = true,
    onanswer,
    oncontinue,
  }: {
    question: Question;
    hintAllowed?: boolean;
    /** Called as soon as the answer is known (for Toma's reaction). */
    onanswer?: (correct: boolean) => void;
    oncontinue: (r: AnswerResult) => void;
  } = $props();

  let picked = $state<number | null>(null);
  let typed = $state('');
  let attempts = $state(0);
  let usedHint = $state(false);
  let showHint = $state(false);
  let finished = $state<null | boolean>(null);
  let retryMsg = $state(false);
  let autoTimer: ReturnType<typeof setTimeout> | null = null;

  const item = $derived(app.item(q.itemId));
  const hint = $derived.by(() => {
    const it = item;
    if (!it) return '';
    if (it.kind === 'kana' || it.kind === 'rule') return it.mnemonic;
    if (it.kind === 'vocab') return q.mode === 'word-meaning' ? it.romaji : `${it.romaji} — starts with ${[...it.jp][0]}`;
    return it.explain;
  });

  $effect(() => {
    // New question: reset local state.
    q;
    picked = null;
    typed = '';
    attempts = 0;
    usedHint = false;
    showHint = false;
    finished = null;
    retryMsg = false;
    if (q.prompt.listen && q.prompt.audio) void play(q.prompt.audio);
    return () => {
      if (autoTimer) clearTimeout(autoTimer);
    };
  });

  function finish(correct: boolean) {
    finished = correct;
    onanswer?.(correct);
    void play(q.revealAudio); // audio on every reveal (spec L6)
    if (correct) autoTimer = setTimeout(next, 1100);
  }

  function next() {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = null;
    if (finished === null) return;
    oncontinue({ correct: finished, usedHint, attempts: Math.max(1, attempts) });
  }

  function pick(i: number) {
    if (finished !== null) return;
    picked = i;
    attempts = 1;
    finish(checkAnswer(q, i));
  }

  function submitTyped() {
    if (finished !== null) return;
    attempts++;
    const ok = checkAnswer(q, typed);
    if (ok) finish(true);
    else if (attempts < 2) {
      retryMsg = true;
      typed = '';
    } else finish(false);
  }

  function submitTiles(answer: string[]) {
    if (finished !== null) return;
    attempts = 1;
    finish(checkAnswer(q, answer));
  }

  function onkeydown(e: KeyboardEvent) {
    if (finished !== null && (e.key === 'Enter' || e.key === ' ') && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      next();
    }
  }
</script>

<svelte:window {onkeydown} />

<section class="question" aria-labelledby="q-instruction">
  <h2 id="q-instruction" class="instruction">{q.instruction}</h2>

  <div class="prompt">
    {#if q.prompt.listen}
      <SpeakerButton reading={q.prompt.audio ?? ''} size={96} label="Play the sound again" />
    {:else if q.prompt.sentence}
      <p class="sentence" lang="ja">
        {#each q.prompt.sentence.tiles as t, i}
          {#if i === q.prompt.sentence.blank}
            <span class="blank" class:filled={finished !== null}>{finished !== null ? t : '？'}</span>
          {:else}
            <span>{t}</span>
          {/if}
        {/each}
      </p>
      <p class="en">{q.prompt.en}</p>
    {:else}
      {#if q.prompt.ja}
        <p class="ja" class:long={q.prompt.ja.length > 2} lang="ja">{q.prompt.ja}</p>
      {/if}
      {#if q.prompt.romaji}<p class="romaji-help">{q.prompt.romaji}</p>{/if}
      {#if q.prompt.en}<p class="en big">{q.prompt.en}</p>{/if}
    {/if}
  </div>

  <div class="answer-area">
    {#if q.type === 'choice'}
      <ChoiceGrid options={q.options} answer={q.answer} {picked} disabled={finished !== null} onpick={pick} />
    {:else if q.type === 'type'}
      <RomajiInput
        bind:value={typed}
        disabled={finished !== null}
        status={finished === null ? 'idle' : finished ? 'right' : 'wrong'}
        onsubmit={submitTyped}
        label="Type the reading in romaji"
      />
      {#if retryMsg && finished === null}<p class="retry" role="status">Not quite — try once more</p>{/if}
    {:else}
      <TileBuilder
        tiles={q.tiles}
        spaced={q.mode === 'order-sentence'}
        disabled={finished !== null}
        status={finished === null ? 'idle' : finished ? 'right' : 'wrong'}
        onsubmit={submitTiles}
      />
    {/if}
  </div>

  {#if finished === null}
    {#if hintAllowed && hint}
      {#if showHint}
        <p class="hint" role="note"><span class="tag">Plant label</span>{hint}</p>
      {:else}
        <button
          class="hint-btn"
          onclick={() => {
            showHint = true;
            usedHint = true;
          }}>Peek at the plant label</button
        >
      {/if}
    {/if}
  {:else}
    <div class="reveal" class:right={finished} role="status" aria-live="polite">
      <p class="verdict">{finished ? (usedHint || attempts > 1 ? 'Got it!' : 'Lovely!') : 'Not this time'}</p>
      <p class="reveal-text" lang="ja">{q.revealText}</p>
      <div class="reveal-actions">
        <SpeakerButton reading={q.revealAudio} size={48} />
        <Button variant={finished ? 'leaf' : 'primary'} onclick={next}>Continue</Button>
      </div>
    </div>
  {/if}
</section>

<style>
  .question {
    display: grid;
    gap: var(--space-4);
  }
  .instruction {
    font-size: var(--text-m);
    color: var(--ink-soft);
    text-align: center;
    font-weight: 700;
  }
  .prompt {
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    min-height: 140px;
    align-content: center;
    text-align: center;
  }
  .ja {
    font-size: var(--specimen);
    line-height: 1;
    font-weight: 700;
  }
  .ja.long {
    font-size: clamp(48px, 15vw, 80px);
  }
  .romaji-help {
    color: var(--ink-soft);
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .en.big {
    font-size: var(--text-xl);
    font-weight: 800;
  }
  .sentence {
    font-size: clamp(24px, 7vw, 32px);
    font-weight: 700;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }
  .blank {
    min-width: 1.6em;
    border-bottom: 3px solid var(--tomato);
    color: var(--tomato-ink);
  }
  .blank.filled {
    border-color: var(--leaf);
    color: var(--leaf-strong);
  }
  .retry {
    text-align: center;
    color: var(--tomato-ink);
    font-weight: 700;
  }
  .hint-btn {
    justify-self: center;
    background: none;
    border: none;
    color: var(--ink-soft);
    text-decoration: underline;
    min-height: var(--tap);
    font-weight: 600;
  }
  .hint {
    background: var(--sun-soft);
    border-radius: var(--radius-s);
    padding: var(--space-3) var(--space-4);
  }
  .tag {
    display: block;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
  }
  .reveal {
    border-radius: var(--radius-m);
    padding: var(--space-4);
    background: var(--tomato-soft);
    display: grid;
    gap: var(--space-2);
    animation: rise 0.3s var(--spring);
  }
  .reveal.right {
    background: var(--leaf-soft);
  }
  .verdict {
    font-weight: 800;
    font-size: var(--text-l);
  }
  .reveal-text {
    font-size: var(--text-l);
  }
  .reveal-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: space-between;
    align-items: center;
  }
  @keyframes rise {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }
</style>
