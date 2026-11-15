<!-- Planting (a lesson): introduce → quick check → mixed quiz → summary (spec §7.2, plan §6.4). -->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { ItemId } from '../../../shared/content-types';
  import { readingOf } from '../../../shared/content-types';
  import type { ItemState } from '../../../shared/sync-types';
  import { prefetch, canPlay } from '../../audio/play';
  import { makeQuestion, type Question } from '../../engine/exercises';
  import type { AnswerResult } from '../../engine/grading';
  import { Lesson } from '../../engine/queue';
  import { applyAnswer, totalTomatoes, varieties } from '../../engine/rewards';
  import { newlyUnlocked, nextPacket } from '../../engine/unlocks';
  import { nextAction } from '../../engine/queue';
  import type { Progress } from '../../engine/progress';
  import { app } from '../../store/progress.svelte';
  import type { Mood } from '../art/Toma.svelte';
  import Plant from '../art/Plant.svelte';
  import Toma from '../art/Toma.svelte';
  import VarietyArt from '../art/VarietyArt.svelte';
  import Button from '../components/Button.svelte';
  import IntroCard from '../components/IntroCard.svelte';
  import QuestionView from '../components/QuestionView.svelte';
  import SessionShell from '../components/SessionShell.svelte';
  import { go } from '../router.svelte';

  let lesson = $state.raw<Lesson | null>(null);
  let tick = $state(0); // bump to re-render after mutating the lesson
  let question = $state.raw<Question | null>(null);
  let mood = $state<Mood>('idle');
  let summary = $state.raw<null | { planted: ItemId[]; tomatoes: number; unlocked: ItemId[]; newVarieties: string[] }>(null);
  let nothing = $state(false);
  const rng = Math.random;

  async function start() {
    await app.loadAllUnits();
    const packet = nextPacket(app.content, app.progress);
    if (!packet) {
      nothing = true;
      return;
    }
    prefetch(packet.items.map((id) => app.item(id)).filter((i) => !!i).map((i) => readingOf(i!)));
    lesson = new Lesson(packet.items, rng);
    summary = null;
    mood = 'idle';
    makeCurrent();
  }

  function makeCurrent() {
    const step = lesson?.current;
    question =
      step?.type === 'question'
        ? makeQuestion(app.content, app.progress, step.id, { rng, canListen: canPlay, easy: true })
        : null;
    tick++;
  }

  function nextIntro() {
    lesson!.next();
    mood = 'idle';
    advance();
  }

  function onanswer(correct: boolean) {
    mood = correct ? 'happy' : 'oops';
  }

  function oncontinue(r: AnswerResult) {
    lesson!.answer(r.correct);
    mood = 'idle';
    advance();
  }

  function advance() {
    if (lesson!.done) void finish();
    else makeCurrent();
  }

  /** Plants every item: one scheduler review each (good, or hard if it needed a second look). */
  async function finish() {
    const l = lesson!;
    const now = new Date();
    const before: Progress = { ...app.progress, items: new Map(app.progress.items) };
    const varietiesBefore = new Set(varieties(app.content, app.progress).map((v) => v.id));
    const tomatoesBefore = totalTomatoes(app.progress);
    const states: ItemState[] = l.items.map(
      (id) => applyAnswer(app.sched, app.progress.items.get(id), id, (l.mistakes.get(id) ?? 0) > 0 ? 'hard' : 'good', now).state,
    );
    await app.commit(states, now);
    summary = {
      planted: l.items,
      tomatoes: totalTomatoes(app.progress) - tomatoesBefore,
      unlocked: newlyUnlocked(app.content, before, app.progress),
      newVarieties: varieties(app.content, app.progress)
        .filter((v) => !varietiesBefore.has(v.id))
        .map((v) => v.id),
    };
    mood = 'happy';
    tick++;
  }

  $effect(() => {
    untrack(() => void start());
  });

  const lessonProgress = $derived.by(() => {
    tick;
    return lesson?.progress ?? 0;
  });
  const canPlantMore = $derived((app.version, summary && nextAction(app.content, app.progress, app.sched, new Date()).kind === 'plant'));
  const label = (id: ItemId) => {
    const it = app.item(id);
    if (!it) return id;
    return it.kind === 'kana' || it.kind === 'rule' ? it.char : it.kind === 'vocab' ? it.jp : it.title;
  };
</script>

<SessionShell progress={summary ? 1 : lessonProgress} {mood} label="Lesson progress">
  {#if nothing}
    <div class="center">
      <Toma mood="sleepy" size={120} />
      <p>Every seed is planted. Your garden is full!</p>
      <Button onclick={() => go('garden')}>Back to the garden</Button>
    </div>
  {:else if summary}
    <div class="summary">
      <h1>Seeds planted!</h1>
      <ul class="planted" aria-label="Planted">
        {#each summary.planted as id, i}
          <li style:animation-delay="{i * 0.08}s"><Plant stage="sprout" size={48} /><span lang="ja">{label(id)}</span></li>
        {/each}
      </ul>
      <p class="tomatoes"><span class="num">+{summary.tomatoes}</span> tomatoes</p>
      {#if summary.newVarieties.length}
        <div class="variety">
          {#each summary.newVarieties as v}
            {@const variety = app.content.index.varieties.find((x) => x.id === v)!}
            <VarietyArt id={v} colour={variety.colour} size={56} />
            <p>A new variety for your basket: <strong>{variety.name}</strong></p>
          {/each}
        </div>
      {/if}
      {#if summary.unlocked.length}
        <div class="unlocked">
          <h2>New seeds you can plant now</h2>
          <ul>
            {#each summary.unlocked.slice(0, 12) as id}
              {@const it = app.item(id)}
              <li>
                <span lang="ja" class="jp">{label(id)}</span>
                {#if it?.kind === 'vocab'}<span class="muted">{it.meaning}</span>{/if}
              </li>
            {/each}
          </ul>
          {#if summary.unlocked.length > 12}<p class="muted">and {summary.unlocked.length - 12} more</p>{/if}
        </div>
      {/if}
      <div class="actions">
        {#if canPlantMore}
          <Button wide onclick={() => start()}>Plant another packet</Button>
          <Button wide variant="quiet" onclick={() => go('garden')}>Back to the garden</Button>
        {:else}
          <Button wide onclick={() => go('garden')}>Back to the garden</Button>
        {/if}
      </div>
    </div>
  {:else if lesson?.current}
    {#key tick}
      {#if lesson.current.type === 'intro'}
        {@const item = app.item(lesson.current.id)}
        {#if item}<IntroCard {item} again={lesson.current.again} onnext={nextIntro} />{/if}
      {:else if question}
        <QuestionView {question} {onanswer} {oncontinue} />
      {/if}
    {/key}
  {:else}
    <p class="center muted">Opening the seed packet…</p>
  {/if}
</SessionShell>

<style>
  .center {
    display: grid;
    gap: var(--space-4);
    justify-items: center;
    text-align: center;
    padding-top: var(--space-7);
  }
  .summary {
    display: grid;
    gap: var(--space-4);
    text-align: center;
  }
  h1 {
    font-size: var(--text-xl);
  }
  h2 {
    font-size: var(--text-m);
    margin-bottom: var(--space-2);
  }
  .planted {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-3);
  }
  .planted li {
    display: grid;
    justify-items: center;
    font-weight: 700;
    font-size: var(--text-l);
    animation: pop 0.45s var(--spring) both;
  }
  .tomatoes {
    font-weight: 800;
    font-size: var(--text-l);
  }
  .num {
    color: var(--tomato-ink);
    font-size: var(--text-xl);
  }
  .variety {
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    background: var(--sun-soft);
    padding: var(--space-4);
    border-radius: var(--radius-m);
  }
  .unlocked {
    background: var(--white);
    border-radius: var(--radius-m);
    padding: var(--space-4);
    text-align: left;
  }
  .unlocked ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-1);
  }
  .unlocked li {
    display: flex;
    gap: var(--space-3);
    align-items: baseline;
  }
  .jp {
    font-weight: 700;
    font-size: var(--text-l);
  }
  .actions {
    display: grid;
    gap: var(--space-3);
  }
  @keyframes pop {
    from {
      transform: scale(0.3) translateY(20px);
      opacity: 0;
    }
  }
</style>
