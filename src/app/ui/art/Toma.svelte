<!-- Toma (トマ), the round tomato mascot. Fixed viewBox 0 0 100 100; replaceable art. -->
<script lang="ts" module>
  export type Mood = 'idle' | 'happy' | 'oops' | 'sleepy';
</script>

<script lang="ts">
  let { mood = 'idle', size = 96 }: { mood?: Mood; size?: number } = $props();
</script>

<svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" class="toma {mood}">
  <g class="body">
    <ellipse cx="50" cy="94" rx="26" ry="4" fill="#3b2f2f" opacity="0.08" />
    <ellipse cx="50" cy="58" rx="38" ry="34" fill="#e5493a" />
    <path d="M18 66 q32 30 64 0 q-6 22 -32 24 q-26 -2 -32 -24z" fill="#c4372a" opacity="0.45" />
    <ellipse cx="34" cy="40" rx="8" ry="5" fill="#fff" opacity="0.4" transform="rotate(-25 34 40)" />
    <!-- calyx -->
    <path
      d="M50 28 l-14 -6 l9 9 l-15 3 l16 2 l-6 10 l10 -8 l10 8 l-6 -10 l16 -2 l-15 -3 l9 -9z"
      fill="#4c9a5b"
      stroke="#3a7a47"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
    <path d="M50 28 q1 -8 6 -11" stroke="#3a7a47" stroke-width="3" fill="none" stroke-linecap="round" />
    <!-- face -->
    {#if mood === 'happy'}
      <path d="M33 58 q4 -6 8 0" stroke="#3b2f2f" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M59 58 q4 -6 8 0" stroke="#3b2f2f" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M42 66 q8 10 16 0z" fill="#3b2f2f" />
      <path d="M46 69 q4 3 8 0" fill="#f28b82" />
    {:else if mood === 'oops'}
      <circle cx="37" cy="58" r="3.4" fill="#3b2f2f" />
      <circle cx="63" cy="58" r="3.4" fill="#3b2f2f" />
      <ellipse cx="50" cy="69" rx="3.5" ry="4" fill="#3b2f2f" />
      <path d="M76 40 q4 6 0 8 q-4 -2 0 -8z" fill="#7ec8e3" />
    {:else if mood === 'sleepy'}
      <path d="M33 59 q4 3 8 0" stroke="#3b2f2f" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M59 59 q4 3 8 0" stroke="#3b2f2f" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M46 68 q4 3 8 0" stroke="#3b2f2f" stroke-width="2.5" fill="none" stroke-linecap="round" />
    {:else}
      <circle cx="37" cy="58" r="3.6" fill="#3b2f2f" />
      <circle cx="63" cy="58" r="3.6" fill="#3b2f2f" />
      <circle cx="38.2" cy="56.8" r="1.1" fill="#fff" />
      <circle cx="64.2" cy="56.8" r="1.1" fill="#fff" />
      <path d="M44 66 q6 6 12 0" stroke="#3b2f2f" stroke-width="3" fill="none" stroke-linecap="round" />
    {/if}
    <ellipse cx="28" cy="66" rx="5" ry="3" fill="#f28b82" opacity="0.8" />
    <ellipse cx="72" cy="66" rx="5" ry="3" fill="#f28b82" opacity="0.8" />
  </g>
</svg>

<style>
  .toma {
    display: block;
    overflow: visible;
  }
  .body {
    transform-origin: 50px 92px;
  }
  .idle .body {
    animation: breathe 3.2s ease-in-out infinite;
  }
  .happy .body {
    animation: bounce 0.6s var(--spring);
  }
  .oops .body {
    transform: rotate(-8deg);
    transition: transform 0.4s var(--spring);
  }
  @keyframes breathe {
    50% {
      transform: scale(1.03, 0.97);
    }
  }
  @keyframes bounce {
    30% {
      transform: translateY(-12px) scale(0.96, 1.05);
    }
    60% {
      transform: translateY(0) scale(1.06, 0.94);
    }
  }
</style>
