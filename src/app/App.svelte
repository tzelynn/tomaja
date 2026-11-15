<script lang="ts">
  import { app } from './store/progress.svelte';
  import { router } from './ui/router.svelte';
  import TabBar from './ui/components/TabBar.svelte';
  import Toma from './ui/art/Toma.svelte';
  import Garden from './ui/screens/Garden.svelte';
  import Planting from './ui/screens/Planting.svelte';
  import Watering from './ui/screens/Watering.svelte';
  import Catalogue from './ui/screens/Catalogue.svelte';
  import Basket from './ui/screens/Basket.svelte';
  import Settings from './ui/screens/Settings.svelte';
  import UpdatePrompt from './ui/components/UpdatePrompt.svelte';

  const session = $derived(router.route === 'plant' || router.route === 'water');
</script>

{#if app.loadError}
  <div class="boot">
    <Toma mood="oops" size={96} />
    <p>The garden gate is stuck: {app.loadError}</p>
    <button onclick={() => location.reload()}>Try again</button>
  </div>
{:else if !app.ready}
  <div class="boot" aria-busy="true"><Toma size={96} /><p class="sr-only">Loading your garden…</p></div>
{:else if session}
  {#if router.route === 'plant'}<Planting />{:else}<Watering />{/if}
{:else}
  <div class="page">
    {#if router.route === 'catalogue'}<Catalogue />
    {:else if router.route === 'basket'}<Basket />
    {:else if router.route === 'settings'}<Settings />
    {:else}<Garden />{/if}
  </div>
  <TabBar />
{/if}
<UpdatePrompt />

<style>
  .boot {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--space-4);
    text-align: center;
    padding: var(--space-4);
  }
  .boot button {
    min-height: var(--tap);
    padding: 0 var(--space-5);
    border-radius: var(--radius-full);
    border: none;
    background: var(--tomato-strong);
    color: var(--white);
    font-weight: 800;
  }
  .page {
    max-width: var(--column);
    margin: 0 auto;
    padding: calc(var(--space-4) + env(safe-area-inset-top)) max(var(--space-4), env(safe-area-inset-right))
      calc(var(--tabbar-h) + var(--space-6) + env(safe-area-inset-bottom)) max(var(--space-4), env(safe-area-inset-left));
  }
  @media (min-width: 720px) {
    .page {
      padding-bottom: var(--space-7);
    }
  }
</style>
