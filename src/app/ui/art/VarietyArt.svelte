<!-- One collectable tomato variety. Fixed viewBox 0 0 64 64; replaceable art. -->
<script lang="ts">
  let { id, colour, size = 64, locked = false }: { id: string; colour: string; size?: number; locked?: boolean } = $props();
  const shape = $derived(
    id === 'yellow-pear' ? 'pear' : id === 'roma' || id === 'san-marzano' ? 'oblong' : id === 'beefsteak' || id === 'brandywine' ? 'flat' : id === 'cherry' ? 'cherry' : 'round',
  );
  const fill = $derived(locked ? '#e7dccb' : colour);
</script>

<svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
  {#if shape === 'cherry'}
    <path d="M24 20 q6 -10 10 -12 M40 22 q-2 -10 -6 -14" stroke="#3a7a47" stroke-width="2" fill="none" />
    <circle cx="22" cy="38" r="13" fill={fill} />
    <circle cx="43" cy="40" r="12" fill={fill} />
    {#if !locked}<circle cx="18" cy="33" r="3" fill="#fff" opacity="0.5" /><circle cx="39" cy="35" r="2.7" fill="#fff" opacity="0.5" />{/if}
  {:else if shape === 'pear'}
    <path d="M32 12 c-6 0 -8 6 -8 12 c0 6 -10 10 -10 22 c0 9 8 14 18 14 s18 -5 18 -14 c0 -12 -10 -16 -10 -22 c0 -6 -2 -12 -8 -12z" fill={fill} />
    {#if !locked}<ellipse cx="24" cy="42" rx="3" ry="5" fill="#fff" opacity="0.45" />{/if}
  {:else if shape === 'oblong'}
    <ellipse cx="32" cy="38" rx="17" ry="22" fill={fill} />
    {#if !locked}<ellipse cx="24" cy="30" rx="3" ry="6" fill="#fff" opacity="0.45" />{/if}
  {:else if shape === 'flat'}
    <path d="M8 38 q0 -18 24 -18 q24 0 24 18 q0 18 -24 18 q-24 0 -24 -18z" fill={fill} />
    <path d="M20 22 q-4 16 0 32 M44 22 q4 16 0 32 M32 20 v36" stroke="#000" opacity="0.08" stroke-width="2" fill="none" />
    {#if !locked}<ellipse cx="18" cy="32" rx="4" ry="3" fill="#fff" opacity="0.45" />{/if}
  {:else}
    <circle cx="32" cy="38" r="21" fill={fill} />
    {#if id === 'green-zebra' && !locked}
      <path d="M18 26 q8 12 2 26 M30 18 q6 16 0 40 M44 22 q-4 14 2 30" stroke="#e8e36a" stroke-width="2.5" fill="none" opacity="0.8" />
    {/if}
    {#if !locked}<ellipse cx="23" cy="30" rx="4" ry="5" fill="#fff" opacity="0.45" />{/if}
  {/if}
  {#if shape !== 'cherry'}
    <path d="M32 18 l-8 -3 l5 5 l-8 2 l9 1 l-3 5 l5 -4 l5 4 l-3 -5 l9 -1 l-8 -2 l5 -5z" fill={locked ? '#d8ccb8' : '#4c9a5b'} />
  {/if}
  {#if locked}
    <text x="32" y="44" text-anchor="middle" font-size="16" font-weight="800" fill="#a8977f">?</text>
  {/if}
</svg>
