export function calculateNps(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const promoters = scores.filter((score) => score >= 9).length;
  const detractors = scores.filter((score) => score <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}
export function average(scores: number[]): number | null {
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}
export function satisfaction(scores: number[]): number | null {
  return scores.length ? (scores.filter((score) => score >= 4).length / scores.length) * 100 : null;
}
export function shiftFor(date: Date): 'morning' | 'afternoon' | 'night' {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(date));
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 19) return 'afternoon';
  return 'night';
}
