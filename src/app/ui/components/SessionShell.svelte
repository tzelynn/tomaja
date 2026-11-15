<!-- Full-screen frame for Planting and Watering: close button, progress bar, Toma. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Toma, { type Mood } from '../art/Toma.svelte';
  import ProgressBar from './ProgressBar.svelte';
  import { go } from '../router.svelte';

  let { progress, mood = 'idle', label, children }: { progress: number; mood?: Mood; label: string; children: Snippet } = $props();
</script>

<div class="shell">
  <header>
    <button class="close" aria-label="Leave and go back to the garden" onclick={() => go('garden')}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>
    </button>
    <ProgressBar value={progress} {label} />
    <div class="toma"><Toma {mood} size={44} /></div>
  </header>
  <main>{@render children()}</main>
</div>

<style>
  .shell {
    max-width: var(--column);
    margin: 0 auto;
    padding: calc(var(--space-2) + env(safe-area-inset-top)) var(--space-4) calc(var(--space-6) + env(safe-area-inset-bottom));
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .close {
    width: var(--tap);
    height: var(--tap);
    border: none;
    background: none;
    color: var(--ink-soft);
    display: grid;
    place-items: center;
    flex: none;
  }
  .toma {
    flex: none;
  }
  main {
    flex: 1;
  }
</style>
