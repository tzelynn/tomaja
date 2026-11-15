<!-- Settings: account & sync, new seeds per day, audio, romaji help, credits, delete data (spec §7.6, §8). -->
<script lang="ts">
  import { app } from '../../store/progress.svelte';
  import { setAudioEnabled } from '../../audio/play';
  import { ApiError, createGarden, deleteGarden, openGarden, signOut, syncNow, syncState } from '../../sync/client.svelte';
  import Button from '../components/Button.svelte';

  let mode = $state<'none' | 'new' | 'open'>('none');
  let name = $state('');
  let code = $state('');
  let busy = $state(false);
  let message = $state<string | null>(null);
  let mergedNote = $state<string | null>(null);
  let confirmDelete = $state<'none' | 'garden' | 'local'>('none');

  const ERRORS: Record<string, string> = {
    wrong_code: 'That secret code isn’t right. Check it with the person who shared it.',
    name_taken: 'That garden name is taken. Try another one.',
    no_such_garden: 'There is no garden with that name. Check the spelling.',
    sync_closed: 'Syncing isn’t open on this site right now. Your garden still works on this device.',
    garden_full: 'All the plots are taken right now, so new synced gardens can’t be made. Your garden still works on this device.',
    too_many_attempts: 'Too many tries. Please wait a little and try again.',
    too_many_gardens: 'Too many gardens made from here today. Please try tomorrow.',
    bad_name: 'Garden names are 3–20 letters, numbers, - or _.',
  };

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    message = null;
    try {
      const before = app.progress.items.size;
      if (mode === 'new') await createGarden(name.trim(), code);
      else await openGarden(name.trim(), code);
      const m = syncState.lastMerge;
      mergedNote =
        mode === 'open' && m && (m.items || before)
          ? `Merged your garden: ${m.items} plant${m.items === 1 ? '' : 's'} came from your other devices.`
          : 'Your garden now syncs.';
      mode = 'none';
      code = '';
    } catch (err) {
      message = err instanceof ApiError ? (ERRORS[err.code] ?? 'Something went wrong. Please try again.') : 'You seem to be offline. Try again when you’re connected.';
    } finally {
      busy = false;
    }
  }

  const status = $derived.by(() => {
    if (!app.account) return '';
    switch (syncState.status) {
      case 'syncing':
        return 'Syncing…';
      case 'synced':
        return 'Synced just now';
      case 'offline':
        return 'Will sync when online';
      case 'error':
        return 'Couldn’t sync. Will try again soon.';
      default:
        return 'Ready to sync';
    }
  });

  function suggestName() {
    const a = ['sunny', 'plump', 'juicy', 'sleepy', 'happy', 'little', 'rosy', 'leafy'];
    const b = ['tomato', 'sprout', 'vine', 'basket', 'garden', 'seedling', 'cherry'];
    const r = crypto.getRandomValues(new Uint32Array(3));
    name = `${a[r[0] % a.length]}-${b[r[1] % b.length]}-${(r[2] % 9000) + 1000}`;
  }

  async function setAudio(on: boolean) {
    setAudioEnabled(on);
    await app.updateSettings({ audio: on });
  }
</script>

<div class="settings">
  <h1>Settings</h1>

  <section aria-labelledby="sync-h">
    <h2 id="sync-h">Sync my garden</h2>
    {#if app.account}
      <p>Garden name: <strong>{app.account.name}</strong></p>
      <p class="muted" role="status">{status}</p>
      {#if mergedNote}<p class="note" role="status">{mergedNote}</p>{/if}
      <div class="row">
        <Button variant="quiet" onclick={() => syncNow(true)}>Sync now</Button>
        <Button variant="quiet" onclick={() => signOut()}>Sign out</Button>
      </div>
      {#if confirmDelete === 'garden'}
        <div class="confirm" role="alert">
          <p>Delete the synced garden and all its server data? Your progress stays on this device.</p>
          <div class="row">
            <Button
              variant="danger"
              onclick={async () => {
                try {
                  await deleteGarden();
                  confirmDelete = 'none';
                } catch {
                  message = 'Couldn’t delete right now. Are you online?';
                }
              }}>Delete garden</Button
            >
            <Button variant="quiet" onclick={() => (confirmDelete = 'none')}>Keep it</Button>
          </div>
        </div>
      {:else}
        <button class="link" onclick={() => (confirmDelete = 'garden')}>Delete synced garden…</button>
      {/if}
    {:else if mode === 'none'}
      <p class="muted">Your garden is saved on this device. With the secret code you can keep it in sync across devices.</p>
      <div class="col">
        <Button wide variant="leaf" onclick={() => ((mode = 'new'), suggestName())}>Start a new garden</Button>
        <Button wide variant="quiet" onclick={() => ((mode = 'open'), (name = ''))}>Open an existing garden</Button>
      </div>
    {:else}
      <form onsubmit={submit} class="form">
        <label>
          Garden name
          <input bind:value={name} required minlength="3" maxlength="20" pattern="[A-Za-z0-9_\-]+" autocomplete="username" autocapitalize="off" spellcheck="false" />
        </label>
        {#if mode === 'new'}
          <p class="small muted">Pick a name that is hard to guess: anyone with the secret code who knows it could open your garden. Write it down — you'll need it on your other devices.</p>
        {/if}
        <label>
          Secret code
          <input bind:value={code} required type="password" autocomplete="current-password" />
        </label>
        {#if message}<p class="error" role="alert">{message}</p>{/if}
        <div class="row">
          <Button type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'new' ? 'Create garden' : 'Open garden'}</Button>
          <Button variant="quiet" onclick={() => ((mode = 'none'), (message = null))}>Cancel</Button>
        </div>
      </form>
    {/if}
    {#if message && mode === 'none'}<p class="error" role="alert">{message}</p>{/if}
  </section>

  <section aria-labelledby="study-h">
    <h2 id="study-h">Studying</h2>
    <label class="setting">
      <span>New seeds per day</span>
      <select value={app.settings.newPerDay} onchange={(e) => app.updateSettings({ newPerDay: Number(e.currentTarget.value) })}>
        {#each [5, 10, 15, 20] as n}<option value={n}>{n}</option>{/each}
      </select>
    </label>
    <label class="setting">
      <span>Pronunciation audio</span>
      <input type="checkbox" role="switch" checked={app.settings.audio} onchange={(e) => setAudio(e.currentTarget.checked)} />
    </label>
    <label class="setting">
      <span>Romaji help under words<br /><span class="small muted">Fades once you know the characters</span></span>
      <input type="checkbox" role="switch" checked={app.settings.romajiHelp} onchange={(e) => app.updateSettings({ romajiHelp: e.currentTarget.checked })} />
    </label>
  </section>

  <section aria-labelledby="credits-h">
    <h2 id="credits-h">Credits & privacy</h2>
    <ul class="credits small">
      <li>Stroke order data from <a href="https://kanjivg.tagaini.net/" rel="noopener">KanjiVG</a> by Ulrich Apel, CC BY-SA 3.0. Derived stroke files are shared under the same licence.</li>
      <li>Font: <a href="https://fonts.google.com/specimen/M+PLUS+Rounded+1c" rel="noopener">M PLUS Rounded 1c</a>, SIL Open Font License 1.1.</li>
      <li>Scheduling: <a href="https://github.com/open-spaced-repetition/ts-fsrs" rel="noopener">ts-fsrs</a> (FSRS), MIT.</li>
      <li>Pronunciation: checked audio clips where available, otherwise your device's Japanese voice.</li>
      <li>Privacy: without a synced garden nothing leaves this device. A synced garden stores only its name and your learning progress. No email, no analytics, no third-party requests.</li>
    </ul>
  </section>

  <section aria-labelledby="danger-h">
    <h2 id="danger-h">Start over</h2>
    {#if confirmDelete === 'local'}
      <div class="confirm" role="alert">
        <p>Delete all progress on this device? {app.account ? 'This also signs this device out; the synced garden stays on the server.' : 'This can’t be undone.'}</p>
        <div class="row">
          <Button
            variant="danger"
            onclick={async () => {
              if (app.account) await signOut();
              await app.deleteLocalData();
              confirmDelete = 'none';
            }}>Delete my data</Button
          >
          <Button variant="quiet" onclick={() => (confirmDelete = 'none')}>Cancel</Button>
        </div>
      </div>
    {:else}
      <Button variant="danger" onclick={() => (confirmDelete = 'local')}>Delete data on this device…</Button>
    {/if}
  </section>
</div>

<style>
  .settings {
    display: grid;
    gap: var(--space-5);
  }
  h1 {
    font-size: var(--text-xl);
  }
  section {
    background: var(--white);
    border-radius: var(--radius-m);
    padding: var(--space-4);
    display: grid;
    gap: var(--space-3);
    box-shadow: var(--shadow);
  }
  h2 {
    font-size: var(--text-m);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .col {
    display: grid;
    gap: var(--space-2);
  }
  .form {
    display: grid;
    gap: var(--space-3);
  }
  label {
    display: grid;
    gap: var(--space-1);
    font-weight: 700;
  }
  input:not([type='checkbox']),
  select {
    min-height: var(--tap);
    border-radius: var(--radius-s);
    border: 2px solid var(--cream-deep);
    padding: 0 var(--space-3);
    background: var(--cream);
    font-weight: 600;
  }
  .setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap);
  }
  input[type='checkbox'] {
    width: 28px;
    height: 28px;
    accent-color: var(--leaf-strong);
  }
  .small {
    font-size: var(--text-s);
    font-weight: 500;
  }
  .error {
    color: var(--tomato-ink);
    font-weight: 700;
  }
  .note {
    background: var(--leaf-soft);
    border-radius: var(--radius-s);
    padding: var(--space-2) var(--space-3);
  }
  .confirm {
    background: var(--tomato-soft);
    border-radius: var(--radius-s);
    padding: var(--space-3);
    display: grid;
    gap: var(--space-2);
  }
  .link {
    justify-self: start;
    background: none;
    border: none;
    color: var(--tomato-ink);
    text-decoration: underline;
    min-height: var(--tap);
    padding: 0;
  }
  .credits {
    padding-left: var(--space-4);
    margin: 0;
    display: grid;
    gap: var(--space-2);
  }
  a {
    color: var(--tomato-ink);
  }
</style>
