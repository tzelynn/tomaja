import { mount } from 'svelte';
import './ui/tokens.css';
import App from './App.svelte';
import { app } from './store/progress.svelte';
import { loadVoices, setAudioEnabled, setClips } from './audio/play';
import { startSyncTriggers } from './sync/client.svelte';

mount(App, { target: document.getElementById('app')! });

void app.init().then(() => {
  if (!app.ready) return;
  setClips(app.content.index.audio);
  setAudioEnabled(app.settings.audio);
  void loadVoices();
  startSyncTriggers();
});
