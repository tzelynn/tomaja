<script lang="ts">
  import type { Snippet } from 'svelte';
  let { open = $bindable(false), title, children }: { open?: boolean; title: string; children: Snippet } = $props();
  let dialog: HTMLDialogElement;
  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} onclick={(e) => e.target === dialog && (open = false)} aria-label={title}>
  <div class="inner">
    <div class="handle" aria-hidden="true"></div>
    <button class="close" aria-label="Close" onclick={() => (open = false)}>×</button>
    {#if open}{@render children()}{/if}
  </div>
</dialog>

<style>
  dialog {
    border: none;
    padding: 0;
    margin: auto auto 0;
    width: min(100%, var(--column));
    max-height: 88dvh;
    border-radius: var(--radius-m) var(--radius-m) 0 0;
    background: var(--white);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  dialog[open] {
    animation: up 0.3s var(--spring);
  }
  dialog::backdrop {
    background: rgba(59, 47, 47, 0.35);
  }
  .inner {
    padding: var(--space-4) var(--space-4) calc(var(--space-6) + env(safe-area-inset-bottom));
    position: relative;
  }
  .handle {
    width: 40px;
    height: 5px;
    border-radius: 3px;
    background: var(--cream-deep);
    margin: 0 auto var(--space-3);
  }
  .close {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    width: var(--tap);
    height: var(--tap);
    border: none;
    background: none;
    font-size: 28px;
    color: var(--ink-soft);
  }
  @keyframes up {
    from {
      transform: translateY(40%);
      opacity: 0;
    }
  }
</style>
