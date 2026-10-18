import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function useMatchStats(gameId) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStats([]);
    setError(null);
    if (!gameId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    api.getMatchStats(gameId)
      .then((json) => { if (!cancelled) setStats(json.data || []); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gameId]);

  return { stats, loading, error };
}
