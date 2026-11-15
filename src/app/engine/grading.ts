import type { Vocab } from '../../shared/content-types';
import type { Rating } from '../../shared/sync-types';
import type { Question } from './exercises';

export function normaliseRomaji(input: string): string {
  return input.trim().toLowerCase().replace(/[\s'’-]/g, '');
}

/** Typed romaji against an accept list (shi/si, tsu/tu, n/nn …). */
export function matchRomaji(input: string, accept: string[]): boolean {
  const v = normaliseRomaji(input);
  return v.length > 0 && accept.some((a) => normaliseRomaji(a) === v);
}

function stripArticles(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.!?]/g, '')
    .replace(/^(to|a|an|the)\s+/, '')
    .replace(/\s+/g, ' ');
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Typed meanings: case-insensitive, ignores "to/a/the", allows one typo on longer words. */
export function matchMeaning(input: string, item: Pick<Vocab, 'meaning' | 'altMeanings'>): boolean {
  const v = stripArticles(input);
  if (!v) return false;
  return [item.meaning, ...item.altMeanings].some((m) => {
    const t = stripArticles(m);
    return t === v || (t.length > 4 && editDistance(t, v) <= 1);
  });
}

export function checkAnswer(q: Question, answer: number | string | string[]): boolean {
  switch (q.type) {
    case 'choice':
      return answer === q.answer;
    case 'type':
      return typeof answer === 'string' && matchRomaji(answer, q.accept);
    case 'tiles':
      return Array.isArray(answer) && answer.join('') === q.answer.join('');
  }
}

export interface AnswerResult {
  correct: boolean;
  usedHint: boolean;
  attempts: number;
}

/** Spec §4.2: wrong → again; right with the hint or on a second try → hard; right → good. */
export function rate(r: AnswerResult): Rating {
  if (!r.correct) return 'again';
  if (r.usedHint || r.attempts > 1) return 'hard';
  return 'good';
}
