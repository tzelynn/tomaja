<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    variant = 'primary',
    type = 'button',
    disabled = false,
    wide = false,
    onclick,
    children,
    ...rest
  }: {
    variant?: 'primary' | 'quiet' | 'leaf' | 'danger';
    type?: 'button' | 'submit';
    disabled?: boolean;
    wide?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
    [k: string]: unknown;
  } = $props();
</script>

<button class="btn {variant}" class:wide {type} {disabled} {onclick} {...rest}>{@render children()}</button>

<style>
  .btn {
    min-height: var(--tap);
    padding: 0 var(--space-5);
    border-radius: var(--radius-full);
    border: none;
    font-weight: 800;
    font-size: var(--text-m);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    transition: transform 0.15s var(--spring), box-shadow 0.15s;
  }
  .btn:active:not(:disabled) {
    transform: scale(0.96);
  }
  .wide {
    width: 100%;
  }
  .primary {
    background: var(--tomato-strong);
    color: var(--white);
    box-shadow: 0 4px 0 #9c2a1f;
  }
  .leaf {
    background: var(--leaf-strong);
    color: var(--white);
    box-shadow: 0 4px 0 #225a31;
  }
  .quiet {
    background: transparent;
    color: var(--tomato-ink);
    border: 2px solid var(--tomato-soft);
  }
  .danger {
    background: transparent;
    color: var(--tomato-ink);
    border: 2px solid var(--tomato-ink);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
    box-shadow: none;
  }
</style>
