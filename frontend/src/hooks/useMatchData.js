import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function useMatchData(params = {}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await api.getMatches(params);
      setMatches(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [JSON.stringify(params)]);

  return { matches, loading, error, refetch: fetchMatches };
}
