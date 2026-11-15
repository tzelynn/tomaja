<script lang="ts">
  import { go, router, type Route } from '../router.svelte';
  const tabs: { route: Route; label: string; icon: string }[] = [
    { route: 'garden', label: 'Garden', icon: 'M12 21v-7m0 0c-4 0-6-3-6-6 3 0 6 2 6 6zm0 0c0-4 3-6 6-6 0 3-2 6-6 6z' },
    { route: 'catalogue', label: 'Catalogue', icon: 'M5 4h10l4 4v12H5zM9 9h6M9 13h6M9 17h4' },
    { route: 'basket', label: 'Basket', icon: 'M4 10h16l-2 9H6zM8 10l4-6 4 6' },
    { route: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2' },
  ];
</script>

<nav aria-label="Main">
  {#each tabs as t}
    <a
      href={t.route === 'garden' ? '#/' : `#/${t.route}`}
      aria-current={router.route === t.route ? 'page' : undefined}
      onclick={(e) => {
        e.preventDefault();
        go(t.route);
      }}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d={t.icon} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span>{t.label}</span>
    </a>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    inset: auto 0 0 0;
    height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    display: flex;
    background: var(--white);
    border-top: 2px solid var(--cream-deep);
    z-index: 10;
  }
  a {
    flex: 1;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 2px;
    color: var(--ink-soft);
    text-decoration: none;
    font-size: 0.75rem;
    font-weight: 700;
    min-height: var(--tap);
  }
  a[aria-current='page'] {
    color: var(--tomato-ink);
  }
  a[aria-current='page'] svg {
    transform: translateY(-2px) scale(1.1);
  }
  svg {
    transition: transform 0.2s var(--spring);
  }
  @media (min-width: 720px) {
    nav {
      inset: 0 auto 0 0;
      width: 96px;
      height: auto;
      flex-direction: column;
      justify-content: center;
      gap: var(--space-4);
      border-top: none;
      border-right: 2px solid var(--cream-deep);
      padding-bottom: 0;
    }
    a {
      flex: 0 0 72px;
    }
  }
</style>
