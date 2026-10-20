export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error || 'Request failed');
    error.state = err.state;
    error.code = err.code;
    throw error;
  }
  return res.json();
}

export const api = {
  getWorlds: (signal) => apiFetch('/api/worlds', { signal }),
  syncWorlds: () => apiFetch('/api/worlds/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
  leaguepediaStatus: () => apiFetch('/api/leaguepedia/status'),
  leaguepediaConnect: (credentials) => apiFetch('/api/leaguepedia/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) }),
  leaguepediaImport: (tournament) => apiFetch('/api/leaguepedia/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournament }) }),
  chatGptStatus: () => apiFetch('/api/chatgpt/status'),
  chatGptModels: () => apiFetch('/api/chatgpt/models'),
  chatGptSignIn: (options) => apiFetch('/api/chatgpt/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) }),
  chatGptSelectAccount: (id) => apiFetch('/api/chatgpt/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }),
  chatGptAcknowledge: () => apiFetch('/api/chatgpt/welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
  chatGptDisconnect: () => apiFetch('/api/chatgpt/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
  getMatches: (params = {}, signal) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/matches${query ? `?${query}` : ''}`, { signal });
  },
  getMatchStats: (gameId, signal) => apiFetch(`/api/matches/${encodeURIComponent(gameId)}/stats`, { signal }),
  getPlayerLoadouts: (gameId, signal) => apiFetch(`/api/matches/${encodeURIComponent(gameId)}/loadouts`, { signal }),
  getMatchTimeline: (gameId, signal) => apiFetch(`/api/matches/${encodeURIComponent(gameId)}/timeline`, { signal }),
  getMatchDraft: (gameId, signal) => apiFetch(`/api/matches/${encodeURIComponent(gameId)}/draft`, { signal }),
  getAiSummary: (gameId, scope, signal) => apiFetch(`/api/matches/${encodeURIComponent(gameId)}/ai-summary?scope=${scope}`, { signal }),
  generateAiSummary: (gameId, scope, signal) => apiFetch(`/api/matches/${encodeURIComponent(gameId)}/ai-summary?scope=${scope}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal }),
  getStandings: (tournament) => apiFetch(`/api/standings?tournament=${encodeURIComponent(tournament)}`),
  syncMatches: (tournament, limit) =>
    apiFetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournament, limit }),
    }),
  health: () => apiFetch('/api/health'),
};
