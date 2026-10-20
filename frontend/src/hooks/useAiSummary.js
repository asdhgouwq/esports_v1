import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useChatGpt } from '../contexts/appContexts';

export function useAiSummary(gameId, scope, enabled) {
  const auth = useChatGpt();
  const identity = JSON.stringify([auth.activeId, auth.connected, auth.planEnabled, auth.account?.selectedModel, auth.revision]);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const key = enabled && gameId ? JSON.stringify([gameId, scope, identity]) : null;

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    async function load() {
      try {
        let data = await api.getAiSummary(gameId, scope, controller.signal);
        if (data.state === 'not_generated' && !controller.signal.aborted) {
          data = await api.generateAiSummary(gameId, scope, controller.signal);
        }
        if (!controller.signal.aborted) setResult({ key, revision, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, revision, data: { state: error.state || 'error', message: error.message } });
      }
    }
    load();
    return () => controller.abort();
  }, [key, gameId, scope, revision]);

  const data = result?.key === key && result?.revision === revision ? result.data : { state: key ? 'loading' : 'waiting_for_data' };
  return { ...data, retry: () => setRevision((value) => value + 1) };
}
