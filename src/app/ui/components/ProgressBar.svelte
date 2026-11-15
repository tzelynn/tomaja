<script lang="ts">
  let { value, label = 'Progress' }: { value: number; label?: string } = $props();
  const pct = $derived(Math.round(Math.max(0, Math.min(1, value)) * 100));
</script>

<div class="bar" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct}>
  <div class="fill" style:width="{pct}%"></div>
</div>

<style>
  .bar {
    height: 12px;
    border-radius: var(--radius-full);
    background: var(--cream-deep);
    overflow: hidden;
    flex: 1;
  }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--leaf), #6dbb7b);
    border-radius: inherit;
    transition: width 0.4s var(--spring);
  }
</style>
