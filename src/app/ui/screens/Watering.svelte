<!-- Watering (a review session): question → answer → reveal with audio → next (spec §7.3). -->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { ItemId } from '../../../shared/content-types';
  import { canPlay } from '../../audio/play';
  import { makeQuestion, type Question } from '../../engine/exercises';
  import { rate, type AnswerResult } from '../../engine/grading';
  import { Review, reviewSession } from '../../engine/queue';
  import { applyAnswer, totalTomatoes } from '../../engine/rewards';
  import { stageOf, STAGE_LABELS, type Stage } from '../../engine/stage';
  import { app } from '../../store/progress.svelte';
  import type { Mood } from '../art/Toma.svelte';
  import Plant from '../art/Plant.svelte';
  import Toma from '../art/Toma.svelte';
  import Button from '../components/Button.svelte';
  import QuestionView from '../components/QuestionView.svelte';
  import SessionShell from '../components/SessionShell.svelte';
  import { go } from '../router.svelte';

  const rng = Math.random;
  let review = $state.raw<Review | null>(null);
  let question = $state.raw<Question | null>(null);
  let tick = $state(0);
  let mood = $state<Mood>('idle');
  let earned = $state(0);
  let grew = $state<{ id: ItemId; stage: Stage }[]>([]);
  let ripened = $state(0);
  let correctCount = $state(0);
  let finished = $state(false);
  let empty = $state(false);

  async function start() {
    await app.loadAllUnits();
    const ids = reviewSession(app.content, app.progress, app.sched, new Date(), rng).filter((id) => app.item(id));
    if (!ids.length) {
      empty = true;
      return;
    }
    review = new Review(ids);
    makeCurrent();
  }

  function makeCurrent() {
    const cur = review?.current;
    question = cur ? makeQuestion(app.content, app.progress, cur.id, { rng, canListen: canPlay }) : null;
    tick++;
  }

  async function oncontinue(r: AnswerResult) {
    const cur = review!.current!;
    const scheduled = review!.answer(r.correct);
    mood = 'idle';
    if (scheduled) {
      // Each answer is saved straight away, so leaving early keeps what was answered.
      const out = applyAnswer(app.sched, app.progress.items.get(cur.id), cur.id, rate(r), new Date());
      await app.commit([out.state]);
      earned += out.tomatoesEarned;
      if (r.correct) correctCount++;
      if (out.grew) grew = [...grew, { id: cur.id, stage: stageOf(out.state) }];
      if (out.ripenedNow) ripened++;
    }
    if (review!.done) {
      finished = true;
      mood = 'happy';
    } else makeCurrent();
  }

  $effect(() => {
    untrack(() => void start());
  });

  const reviewProgress = $derived.by(() => {
    tick;
    return review?.progress ?? 0;
  });
  const label = (id: ItemId) => {
    const it = app.item(id);
    if (!it) return id;
    return it.kind === 'kana' || it.kind === 'rule' ? it.char : it.kind === 'vocab' ? it.jp : it.title;
  };
</script>

<SessionShell progress={finished ? 1 : reviewProgress} {mood} label="Watering progress">
  {#if empty}
    <div class="center">
      <Toma mood="happy" size={120} />
      <p>Everything is watered. See you tomorrow!</p>
      <Button onclick={() => go('garden')}>Back to the garden</Button>
    </div>
  {:else if finished}
    <div class="summary">
      <h1>All watered!</h1>
      <p class="muted">{correctCount} of {review?.items.length} remembered</p>
      <p class="tomatoes"><span class="num">+{earned}</span> tomatoes · {totalTomatoes(app.progress)} in total</p>
      {#if ripened}<p class="ripe">{ripened} plant{ripened > 1 ? 's' : ''} ripened! +5 each</p>{/if}
      {#if grew.length}
        <h2>Plants that grew</h2>
        <ul class="grew">
          {#each grew as g, i}
            <li style:animation-delay="{i * 0.06}s">
              <Plant stage={g.stage} size={48} label={STAGE_LABELS[g.stage]} />
              <span lang="ja">{label(g.id)}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">Roots are getting stronger. Growth shows over the next days.</p>
      {/if}
      <Button wide onclick={() => go('garden')}>Back to the garden</Button>
    </div>
  {:else if question}
    {#key tick}
      {#if review?.current?.retry}<p class="practice">One more try — just for practice</p>{/if}
      <QuestionView {question} onanswer={(c) => (mood = c ? 'happy' : 'oops')} {oncontinue} />
    {/key}
  {:else}
    <p class="center muted">Filling the watering can…</p>
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
    gap: var(--space-3);
    text-align: center;
  }
  h1 {
    font-size: var(--text-xl);
  }
  h2 {
    font-size: var(--text-m);
    margin-top: var(--space-2);
  }
  .tomatoes {
    font-weight: 800;
    font-size: var(--text-l);
  }
  .num {
    color: var(--tomato-ink);
    font-size: var(--text-xl);
  }
  .ripe {
    background: var(--sun-soft);
    border-radius: var(--radius-s);
    padding: var(--space-2);
    font-weight: 700;
  }
  .grew {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-4);
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-3);
  }
  .grew li {
    display: grid;
    justify-items: center;
    font-weight: 700;
    animation: pop 0.45s var(--spring) both;
  }
  .practice {
    text-align: center;
    font-size: var(--text-s);
    color: var(--ink-soft);
    font-weight: 700;
    margin-bottom: var(--space-2);
  }
  @keyframes pop {
    from {
      transform: scale(0.3);
      opacity: 0;
    }
  }
</style>
