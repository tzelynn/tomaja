<script lang="ts">
  import { canPlay, play } from '../../audio/play';
  import { app } from '../../store/progress.svelte';
  let { reading, size = 48, label = 'Play pronunciation' }: { reading: string; size?: number; label?: string } = $props();
  // Re-check when settings change (audio on/off).
  const available = $derived((app.version, app.settings.audio, canPlay(reading)));
  let playing = $state(false);
  async function onclick() {
    playing = true;
    await play(reading);
    setTimeout(() => (playing = false), 500);
  }
</script>

{#if available}
  <button class="speaker" class:playing style:--s="{size}px" aria-label={label} {onclick}>
    <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} aria-hidden="true">
      <path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
    </svg>
  </button>
{/if}

<style>
  .speaker {
    width: var(--s);
    height: var(--s);
    min-width: var(--tap);
    min-height: var(--tap);
    border-radius: var(--radius-full);
    border: none;
    background: var(--sun-soft);
    color: var(--ink);
    display: inline-grid;
    place-items: center;
    transition: transform 0.2s var(--spring);
  }
  .playing {
    transform: scale(1.12);
    background: var(--sun);
  }
</style>
