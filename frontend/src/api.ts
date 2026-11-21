import type { Group, MatchDraft, Snapshot } from './types';

export async function request<T>(url: string, options?: RequestInit, csrf?: string): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin', cache: 'no-store',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...options?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || body.message || `Error ${response.status}`);
  return body as T;
}

export const getState = () => request<Snapshot>('/api/state');
export const getSession = () => request<{ authenticated: boolean; csrf?: string }>('/api/admin/session');
export const login = (password: string) => request<{ authenticated: boolean; csrf: string }>(
  '/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
export const logout = (csrf: string) => request('/api/admin/logout', { method: 'POST' }, csrf);
export const saveGroup = (group: Group, matches: MatchDraft[], csrf: string) => request<{ saved: boolean; revision: number }>(
  `/api/admin/groups/${group.id}`, { method: 'PUT', body: JSON.stringify({ revision: group.revision, matches }) }, csrf);
export const saveKnockout = (match: MatchDraft, csrf: string) => request(
  `/api/admin/knockout/${match.id}`, { method: 'PUT', body: JSON.stringify(match) }, csrf);
export const controlMatch = (id: string, action: string, csrf: string, winner_id?: string | null, decision?: string | null) => request(
  `/api/admin/matches/${id}/control`, { method: 'POST', body: JSON.stringify({ action, winner_id, decision }) }, csrf);
