<script lang="ts">
  import { localDay } from '../../engine/progress';
  let { days, now = new Date() }: { days: Set<string>; now?: Date } = $props();
  const week = $derived(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return { key: localDay(d), label: d.toLocaleDateString('en', { weekday: 'narrow' }), full: d.toLocaleDateString('en', { weekday: 'long' }), today: i === 6 };
    }),
  );
</script>

<ol class="week" aria-label="This week">
  {#each week as d}
    {@const sunny = days.has(d.key)}
    <li class:today={d.today} aria-label="{d.full}: {sunny ? 'sunny, garden tended' : 'not tended'}">
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        {#if sunny}
          <circle cx="12" cy="12" r="6" fill="#ffc94d" />
          {#each [0, 45, 90, 135, 180, 225, 270, 315] as r}
            <rect x="11" y="1.5" width="2" height="4" rx="1" fill="#ffc94d" transform="rotate({r} 12 12)" />
          {/each}
        {:else}
          <circle cx="12" cy="12" r="5" fill="none" stroke="#e7d7bf" stroke-width="2" />
        {/if}
      </svg>
      <span>{d.label}</span>
    </li>
  {/each}
</ol>

<style>
  .week {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    justify-content: space-between;
  }
  li {
    display: grid;
    justify-items: center;
    gap: 2px;
    font-size: 0.75rem;
    color: var(--ink-soft);
    font-weight: 700;
  }
  .today span {
    color: var(--ink);
    text-decoration: underline 2px var(--sun);
    text-underline-offset: 3px;
  }
</style>
