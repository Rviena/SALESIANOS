export type Stage = 'group' | 'round16' | 'quarter' | 'semi' | 'final';
export type Status = 'scheduled' | 'live' | 'halftime' | 'extra' | 'penalties' | 'final';

export interface Team { id: string; name: string; group_id: string }
export interface Standing {
  id: string; name: string; pj: number; g: number; e: number; p: number;
  gf: number; gc: number; dg: number; pts: number;
}
export interface Match {
  id: string; group_id: string | null; stage: Stage; position: number;
  home_id: string | null; away_id: string | null;
  home_name: string; away_name: string;
  scheduled_at: string | null; court: string | null; duration_minutes: number;
  status: Status; home_score: number | null; away_score: number | null;
  home_penalties: number | null; away_penalties: number | null;
  winner_id: string | null; decision: string | null;
  elapsed_seconds: number; running: boolean; segment: string;
  live_points: { home: number; away: number };
}
export interface Group { id: string; revision: number; teams: Team[]; table: Standing[]; matches: Match[] }
export interface Snapshot {
  ready: boolean; tournament?: string; discipline?: string; category?: string;
  server_time: string; groups: Group[]; knockout: Match[]; teams?: Team[];
}
export interface MatchDraft {
  id: string; home_id: string | null; away_id: string | null;
  home_score: number | null; away_score: number | null;
  scheduled_at: string | null; court: string | null; duration_minutes: number;
  home_penalties?: number | null; away_penalties?: number | null;
}

export const makeDraft = (match: Match): MatchDraft => ({
  id: match.id, home_id: match.home_id, away_id: match.away_id,
  home_score: match.home_score, away_score: match.away_score,
  scheduled_at: match.scheduled_at, court: match.court, duration_minutes: match.duration_minutes,
  home_penalties: match.home_penalties, away_penalties: match.away_penalties,
});
