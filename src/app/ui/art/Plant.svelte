<!--
  A plant at one growth stage. Self-contained SVG with a fixed viewBox (0 0 64 64):
  better artwork can replace the inside without changing any caller.
-->
<script lang="ts">
  import type { Stage } from '../../engine/stage';

  let { stage, wilting = false, size = 64, label }: { stage: Stage; wilting?: boolean; size?: number; label?: string } = $props();

  const leaf = $derived(wilting ? '#a3a85c' : '#4c9a5b');
  const leafDark = $derived(wilting ? '#868a45' : '#3a7a47');
</script>

<svg
  viewBox="0 0 64 64"
  width={size}
  height={size}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  class="plant"
  class:wilting
>
  <!-- soil -->
  <ellipse cx="32" cy="56" rx="20" ry="6" fill="#c99a6e" />
  <ellipse cx="32" cy="54.5" rx="16" ry="3.5" fill="#a47650" opacity="0.35" />

  {#if stage === 'seed'}
    <ellipse cx="32" cy="52" rx="4.5" ry="3.2" fill="#8a5a3b" transform="rotate(-20 32 52)" />
    <path d="M30 51 q2 -1.5 4 0" stroke="#b78560" stroke-width="1" fill="none" stroke-linecap="round" />
  {:else}
    <g class="body">
      {#if stage === 'sprout'}
        <path d="M32 55 V44" stroke={leafDark} stroke-width="3" stroke-linecap="round" />
        <ellipse cx="26" cy="41" rx="6.5" ry="4" fill={leaf} transform="rotate(-25 26 41)" />
        <ellipse cx="38" cy="41" rx="6.5" ry="4" fill={leaf} transform="rotate(25 38 41)" />
      {:else}
        {@const top = stage === 'seedling' ? 30 : 16}
        <path d="M32 55 V{top}" stroke={leafDark} stroke-width="3.2" stroke-linecap="round" />
        <ellipse cx="24" cy="46" rx="7" ry="4" fill={leaf} transform="rotate(-20 24 46)" />
        <ellipse cx="40" cy="44" rx="7" ry="4" fill={leaf} transform="rotate(20 40 44)" />
        <ellipse cx="25" cy={top + 6} rx="6" ry="3.6" fill={leaf} transform="rotate(-30 25 {top + 6})" />
        <ellipse cx="39" cy={top + 4} rx="6" ry="3.6" fill={leaf} transform="rotate(30 39 {top + 4})" />
        {#if stage !== 'seedling'}
          <ellipse cx="24" cy="31" rx="6" ry="3.4" fill={leaf} transform="rotate(-15 24 31)" />
          <ellipse cx="41" cy="27" rx="6" ry="3.4" fill={leaf} transform="rotate(15 41 27)" />
        {/if}
        {#if stage === 'flowering'}
          {#each [[22, 22], [42, 18], [32, 13]] as [x, y]}
            <g transform="translate({x} {y})">
              {#each [0, 72, 144, 216, 288] as r}
                <ellipse cx="0" cy="-3" rx="1.8" ry="3" fill="#ffc94d" transform="rotate({r})" />
              {/each}
              <circle r="1.6" fill="#f59a23" />
            </g>
          {/each}
        {:else if stage === 'green' || stage === 'ripe'}
          {@const fill = stage === 'ripe' ? '#e5493a' : '#9ccb5e'}
          {@const shade = stage === 'ripe' ? '#c4372a' : '#7fb047'}
          {#each [[22, 24, 7], [42, 21, 6.5], [33, 35, 5.5]] as [x, y, r]}
            <circle cx={x} cy={y} r={r} fill={fill} />
            <path d="M{x - r * 0.6} {y + r * 0.45} a{r} {r} 0 0 0 {r * 1.2} 0" fill={shade} opacity="0.5" />
            <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.22} fill="#fff" opacity="0.55" />
            <path d="M{x - 3} {y - r + 0.5} l3 1.5 l3 -1.5 l-1.5 2 h-3 z" fill="#3a7a47" />
          {/each}
        {/if}
      {/if}
    </g>
  {/if}
  {#if wilting}
    <path d="M50 18 q3 5 0 7 q-3 -2 0 -7z" fill="#7ec8e3" />
  {/if}
</svg>

<style>
  .plant {
    display: block;
    overflow: visible;
  }
  .body {
    transform-origin: 32px 55px;
    transition: transform 0.4s var(--spring);
  }
  .wilting .body {
    transform: rotate(8deg) scaleY(0.94);
  }
</style>
