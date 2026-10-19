import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useMatchDraft(gameId) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!gameId) return;
    const controller = new AbortController();
    api.getMatchDraft(gameId, controller.signal)
      .then((draft) => { if (!controller.signal.aborted) setResult({ gameId, draft }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ gameId, draft: { state: 'unavailable', gameId } }); });
    return () => controller.abort();
  }, [gameId]);
  return result && result.gameId === gameId ? result.draft : { state: gameId ? 'loading' : 'waiting_for_data', gameId };
}
