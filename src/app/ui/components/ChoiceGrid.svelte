<script lang="ts">
  import type { Option } from '../../engine/exercises';
  let {
    options,
    answer,
    picked = null,
    disabled = false,
    onpick,
  }: { options: Option[]; answer: number; picked?: number | null; disabled?: boolean; onpick: (i: number) => void } = $props();

  function onkeydown(e: KeyboardEvent) {
    const n = Number(e.key);
    if (!disabled && n >= 1 && n <= options.length) {
      e.preventDefault();
      onpick(n - 1);
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="grid" class:long={options.some((o) => o.label.length > 6)} role="group" aria-label="Answers">
  {#each options as opt, i}
    <button
      class="opt"
      class:right={picked !== null && i === answer}
      class:wrong={picked === i && i !== answer}
      lang={opt.ja ? 'ja' : 'en'}
      data-correct={i === answer ? '' : undefined}
      class:ja={opt.ja}
      disabled={disabled && picked !== null && i !== answer && i !== picked}
      aria-disabled={disabled}
      onclick={() => !disabled && onpick(i)}
    >
      <span class="key" aria-hidden="true">{i + 1}</span>
      {opt.label}
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  .grid.long {
    grid-template-columns: 1fr;
  }
  .opt {
    position: relative;
    min-height: 64px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-m);
    border: 2px solid var(--cream-deep);
    background: var(--white);
    font-size: var(--text-l);
    font-weight: 700;
    box-shadow: 0 3px 0 var(--cream-deep);
    transition: transform 0.15s var(--spring), background 0.2s, border-color 0.2s;
  }
  .opt.ja {
    font-size: 1.9rem;
  }
  .opt:active {
    transform: scale(0.96);
  }
  .key {
    position: absolute;
    top: 6px;
    left: 10px;
    font-size: 0.7rem;
    color: var(--ink-soft);
    font-weight: 600;
    opacity: 0.7;
  }
  .right {
    background: var(--leaf-soft);
    border-color: var(--leaf);
    animation: pop 0.35s var(--spring);
  }
  .wrong {
    background: var(--tomato-soft);
    border-color: var(--tomato);
  }
  .opt:disabled {
    opacity: 0.45;
  }
  @keyframes pop {
    50% {
      transform: scale(1.06);
    }
  }
  @media (hover: none) {
    .key {
      display: none;
    }
  }
</style>
