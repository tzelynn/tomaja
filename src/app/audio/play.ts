// Pronunciation (spec §4.3): a checked clip served by tomaja first; browser speech only as the
// fallback, always given the kana reading. If neither exists the speaker button is hidden.
import { toHiragana } from '../../shared/content-types';

let clips: Record<string, string> = {};
let audioEl: HTMLAudioElement | null = null;
let jaVoice: SpeechSynthesisVoice | null = null;
let voicesTried = false;
let enabled = true;

export function setClips(map: Record<string, string>): void {
  clips = map;
}

export function setAudioEnabled(on: boolean): void {
  enabled = on;
}

function clipFor(reading: string): string | undefined {
  return clips[reading] ?? clips[toHiragana(reading)];
}

const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Waits for voices (they load asynchronously in some browsers), with retries. */
export function loadVoices(): Promise<SpeechSynthesisVoice | null> {
  if (!hasSpeech()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let tries = 0;
    const find = () => {
      const v = speechSynthesis.getVoices().find((x) => /^ja[-_]JP/i.test(x.lang)) ?? null;
      if (v || tries++ >= 10) {
        jaVoice = v;
        voicesTried = true;
        resolve(v);
        return;
      }
      setTimeout(find, 250);
    };
    speechSynthesis.addEventListener?.('voiceschanged', () => {
      const v = speechSynthesis.getVoices().find((x) => /^ja[-_]JP/i.test(x.lang));
      if (v) jaVoice = v;
    });
    find();
  });
}

export function canPlay(reading: string): boolean {
  if (!enabled || !reading) return false;
  return !!clipFor(reading) || !!jaVoice;
}

export function speak(text: string): boolean {
  if (!hasSpeech() || !jaVoice) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = jaVoice;
  u.lang = 'ja-JP';
  u.rate = 0.9;
  speechSynthesis.speak(u);
  return true;
}

/** Plays a reading. Call from a tap handler; automatic playback may be blocked and is then skipped. */
export async function play(reading: string): Promise<void> {
  if (!enabled || !reading) return;
  const url = clipFor(reading);
  if (url) {
    try {
      audioEl ??= new Audio();
      audioEl.src = url;
      await audioEl.play();
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') return; // autoplay blocked: skip silently
    }
  }
  if (!voicesTried) await loadVoices();
  speak(reading);
}

/** Fetches clips ahead so audio in a lesson is instant (the service worker then keeps them). */
export function prefetch(readings: string[]): void {
  for (const r of readings) {
    const url = clipFor(r);
    if (url) fetch(url).catch(() => {});
  }
}
