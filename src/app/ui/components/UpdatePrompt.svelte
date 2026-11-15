<!-- "Update available" prompt from the service worker (vite-plugin-pwa). -->
<script lang="ts">
  let needRefresh = $state(false);
  let update: ((reload?: boolean) => Promise<void>) | null = null;
  $effect(() => {
    if (import.meta.env.DEV) return;
    import('virtual:pwa-register').then(({ registerSW }) => {
      update = registerSW({
        onNeedRefresh() {
          needRefresh = true;
        },
      });
    });
  });
</script>

{#if needRefresh}
  <div class="toast" role="status">
    <span>A fresh version of tomaja is ready.</span>
    <button onclick={() => update?.(true)}>Refresh</button>
    <button class="later" aria-label="Later" onclick={() => (needRefresh = false)}>×</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--tabbar-h) + var(--space-4) + env(safe-area-inset-bottom));
    background: var(--ink);
    color: var(--white);
    border-radius: var(--radius-full);
    padding: var(--space-1) var(--space-1) var(--space-1) var(--space-4);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    z-index: 20;
    width: max-content;
    max-width: calc(100% - 32px);
    font-size: var(--text-s);
  }
  button {
    min-height: var(--tap);
    border: none;
    border-radius: var(--radius-full);
    background: var(--sun);
    color: var(--ink);
    font-weight: 800;
    padding: 0 var(--space-4);
  }
  .later {
    background: none;
    color: var(--white);
    padding: 0 var(--space-3);
    font-size: 1.3rem;
  }
</style>
