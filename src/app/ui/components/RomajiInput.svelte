<script lang="ts">
  let {
    value = $bindable(''),
    disabled = false,
    status = 'idle',
    onsubmit,
    label = 'Your answer',
  }: { value?: string; disabled?: boolean; status?: 'idle' | 'right' | 'wrong'; onsubmit: () => void; label?: string } = $props();
  let input: HTMLInputElement;
  $effect(() => {
    if (!disabled) input?.focus({ preventScroll: true });
  });
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    if (!disabled && value.trim()) onsubmit();
  }}
>
  <label class="sr-only" for="romaji">{label}</label>
  <input
    id="romaji"
    bind:this={input}
    bind:value
    class={status}
    {disabled}
    autocomplete="off"
    autocapitalize="off"
    autocorrect="off"
    spellcheck="false"
    inputmode="text"
    enterkeyhint="done"
    placeholder="type here…"
  />
  <button type="submit" class="go" disabled={disabled || !value.trim()} aria-label="Check">✓</button>
</form>

<style>
  form {
    display: flex;
    gap: var(--space-2);
  }
  input {
    flex: 1;
    min-width: 0;
    height: 56px;
    border-radius: var(--radius-m);
    border: 2px solid var(--cream-deep);
    background: var(--white);
    padding: 0 var(--space-4);
    font-size: 1.4rem;
    font-weight: 700;
    text-align: center;
    letter-spacing: 0.05em;
  }
  input:focus {
    outline: none;
    border-color: var(--sun);
  }
  input.right {
    border-color: var(--leaf);
    background: var(--leaf-soft);
  }
  input.wrong {
    border-color: var(--tomato);
    background: var(--tomato-soft);
  }
  .go {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-m);
    border: none;
    background: var(--leaf-strong);
    color: var(--white);
    font-size: 1.5rem;
    font-weight: 800;
  }
  .go:disabled {
    opacity: 0.4;
  }
</style>
