<script lang="ts">
  let {
    tiles,
    disabled = false,
    status = 'idle',
    spaced = false,
    onsubmit,
  }: {
    tiles: string[];
    disabled?: boolean;
    status?: 'idle' | 'right' | 'wrong';
    spaced?: boolean;
    onsubmit: (answer: string[]) => void;
  } = $props();

  // Indices into `tiles` in the order the learner tapped them.
  let chosen = $state<number[]>([]);
  $effect(() => {
    tiles;
    chosen = [];
  });
  const add = (i: number) => !disabled && !chosen.includes(i) && (chosen = [...chosen, i]);
  const remove = (pos: number) => !disabled && (chosen = chosen.filter((_, p) => p !== pos));
</script>

<div class="builder">
  <div class="answer {status}" aria-live="polite" aria-label="Your answer">
    {#each chosen as i, pos (i)}
      <button class="tile placed" lang="ja" onclick={() => remove(pos)} aria-label="Remove {tiles[i]}">{tiles[i]}</button>
    {:else}
      <span class="hint muted">Tap tiles below</span>
    {/each}
  </div>
  <div class="pool" class:spaced role="group" aria-label="Tiles">
    {#each tiles as t, i}
      <button class="tile" lang="ja" disabled={chosen.includes(i) || disabled} onclick={() => add(i)}>{t}</button>
    {/each}
  </div>
  <button class="check" disabled={disabled || !chosen.length} onclick={() => onsubmit(chosen.map((i) => tiles[i]))}>Check</button>
</div>

<style>
  .builder {
    display: grid;
    gap: var(--space-4);
  }
  .answer {
    min-height: 72px;
    border-radius: var(--radius-m);
    border: 2px dashed var(--soil);
    padding: var(--space-2);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    justify-content: center;
    background: var(--white);
  }
  .answer.right {
    border-style: solid;
    border-color: var(--leaf);
    background: var(--leaf-soft);
  }
  .answer.wrong {
    border-style: solid;
    border-color: var(--tomato);
    background: var(--tomato-soft);
  }
  .hint {
    font-size: var(--text-s);
  }
  .pool {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: center;
  }
  .tile {
    min-width: var(--tap);
    min-height: 52px;
    padding: 0 var(--space-3);
    border-radius: var(--radius-s);
    border: 2px solid var(--cream-deep);
    background: var(--white);
    font-size: 1.6rem;
    font-weight: 700;
    box-shadow: 0 3px 0 var(--cream-deep);
    transition: transform 0.15s var(--spring);
  }
  .tile.placed {
    animation: pop 0.25s var(--spring);
    border-color: var(--sun);
  }
  .tile:disabled {
    opacity: 0.25;
    box-shadow: none;
  }
  .check {
    min-height: var(--tap);
    border-radius: var(--radius-full);
    border: none;
    background: var(--leaf-strong);
    color: var(--white);
    font-weight: 800;
  }
  .check:disabled {
    opacity: 0.4;
  }
  @keyframes pop {
    from {
      transform: scale(0.7);
    }
  }
</style>
