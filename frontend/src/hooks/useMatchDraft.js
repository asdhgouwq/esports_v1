import {api} from '../lib/api';
import {useApiQuery} from './useApiQuery';
const fetchDraft = (gameId, signal) => api.getMatchDraft(gameId, signal);
export function useMatchDraft(gameId) {
  const {data, error} = useApiQuery(gameId ? JSON.stringify(gameId) : null, fetchDraft);
  return data || {state: error ? 'unavailable' : gameId ? 'loading' : 'waiting_for_data', gameId};
}
