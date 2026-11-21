import type { Match, Status } from './types';

export const statusLabels: Record<Status, string> = {
  scheduled: 'Programado', live: 'En juego', halftime: 'Medio tiempo',
  extra: 'Tiempo extra', penalties: 'Penales', final: 'Finalizado',
};
export const stageLabels: Record<string, string> = {
  group: 'Fase de grupos', round16: 'Octavos de final', quarter: 'Cuartos de final',
  semi: 'Semifinales', final: 'Final',
};
export function timeLabel(value: string | null) {
  if (!value) return 'Por definir';
  return new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }).format(new Date(value));
}
export function dateLabel(value: string | null) {
  if (!value) return 'Fecha por definir';
  return new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Lima' }).format(new Date(value));
}
export function score(value: number | null) { return value ?? '—'; }
export const isLive = (m: Match) => ['live', 'halftime', 'extra', 'penalties'].includes(m.status);
export function scheduledSort(a: Match, b: Match) {
  return (a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity)
    - (b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity);
}
