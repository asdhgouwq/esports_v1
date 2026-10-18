const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getMatches: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/matches${query ? `?${query}` : ''}`);
  },
  getMatchStats: (gameId) => apiFetch(`/api/matches/${gameId}/stats`),
  getStandings: (tournament) => apiFetch(`/api/standings?tournament=${encodeURIComponent(tournament)}`),
  syncMatches: (tournament, limit) =>
    apiFetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournament, limit }),
    }),
  health: () => apiFetch('/api/health'),
};
