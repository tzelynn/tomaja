<!--
  Stroke order from KanjiVG paths (/strokes/<codepoint>.json, viewBox 0 0 109 109).
  Draws all strokes faintly, then animates each in order. Tracing mode lets the learner draw
  over the guide and check themselves; there is no recognition (spec L11).
-->
<script lang="ts">
  let { text, size = 160 }: { text: string; size?: number } = $props();

  const chars = $derived([...text]);
  let strokes = $state<(string[] | null)[]>([]);
  let run = $state(0);
  let tracing = $state(false);
  let failed = $state(false);
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  $effect(() => {
    const cs = chars;
    failed = false;
    Promise.all(
      cs.map((c) =>
        fetch(`/strokes/${c.codePointAt(0)!.toString(16).padStart(5, '0')}.json`)
          .then((r) => (r.ok ? (r.json() as Promise<string[]>) : null))
          .catch(() => null),
      ),
    ).then((s) => {
      strokes = s;
      failed = s.every((x) => !x);
      run++;
    });
  });

  // Tracing canvas
  let canvas = $state<HTMLCanvasElement>();
  let drawing = false;
  function pos(e: PointerEvent) {
    const r = canvas!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * canvas!.width, ((e.clientY - r.top) / r.height) * canvas!.height];
  }
  function down(e: PointerEvent) {
    drawing = true;
    canvas!.setPointerCapture(e.pointerId);
    const ctx = canvas!.getContext('2d')!;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#e5493a';
    ctx.beginPath();
    const [x, y] = pos(e);
    ctx.moveTo(x, y);
  }
  function move(e: PointerEvent) {
    if (!drawing) return;
    const ctx = canvas!.getContext('2d')!;
    const [x, y] = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function clear() {
    canvas?.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
  }
</script>

{#if !failed}
  <div class="stroke-order">
    <div class="glyphs" style:--size="{size}px">
      {#each chars as c, ci}
        {@const paths = strokes[ci]}
        <div class="glyph" class:small={/[ゃゅょャュョっッ]/.test(c) && chars.length > 1}>
          <svg viewBox="0 0 109 109" aria-label="Stroke order for {c}" role="img">
            <path d="M54.5 4v101M4 54.5h101" stroke="#f1e3cf" stroke-width="1" stroke-dasharray="4 4" />
            {#if paths}
              {#each paths as d}
                <path {d} class="ghost" />
              {/each}
              {#if !tracing}
                {#key run}
                  {#each paths as d, i}
                    <path
                      {d}
                      class="ink"
                      pathLength="1"
                      style:animation-delay="{(reduced ? 0 : (ci * paths.length + i) * 0.7) + 's'}"
                      class:static={reduced}
                    />
                  {/each}
                {/key}
              {/if}
            {/if}
          </svg>
          {#if tracing && ci === 0}
            <canvas
              bind:this={canvas}
              width="218"
              height="218"
              onpointerdown={down}
              onpointermove={move}
              onpointerup={() => (drawing = false)}
              aria-label="Trace the character with your finger"
            ></canvas>
          {/if}
        </div>
      {/each}
    </div>
    <div class="actions">
      {#if tracing}
        <button onclick={() => { tracing = false; clear(); }}>Looks right ✓</button>
        <button onclick={clear}>Show again</button>
      {:else}
        <button onclick={() => run++}>Replay</button>
        <button onclick={() => (tracing = true)}>Trace it</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .stroke-order {
    display: grid;
    gap: var(--space-2);
    justify-items: center;
  }
  .glyphs {
    display: flex;
    gap: var(--space-2);
    align-items: flex-end;
  }
  .glyph {
    position: relative;
    width: var(--size);
    height: var(--size);
    background: var(--white);
    border-radius: var(--radius-m);
    border: 2px solid var(--cream-deep);
  }
  .glyph.small {
    width: calc(var(--size) * 0.6);
    height: calc(var(--size) * 0.6);
  }
  svg,
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
  }
  .ghost {
    fill: none;
    stroke: #eadcc6;
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ink {
    fill: none;
    stroke: var(--ink);
    stroke-width: 4.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: draw 0.6s ease-in-out forwards;
  }
  .ink.static {
    stroke-dashoffset: 0;
    animation: none;
  }
  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }
  .actions {
    display: flex;
    gap: var(--space-2);
  }
  .actions button {
    min-height: var(--tap);
    min-width: var(--tap);
    padding: 0 var(--space-3);
    border-radius: var(--radius-full);
    border: 2px solid var(--cream-deep);
    background: var(--white);
    font-weight: 700;
    font-size: var(--text-s);
  }
  @media (prefers-reduced-motion: reduce) {
    .ink {
      stroke-dashoffset: 0;
    }
  }
</style>
