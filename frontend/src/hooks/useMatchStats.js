import {api} from '../lib/api';
import {useApiQuery} from './useApiQuery';
const fetchStats = async (gameId, signal) => (await api.getMatchStats(gameId, signal)).data || [];
const EMPTY = [];
export function useMatchStats(gameId) {
  const {data, ...state} = useApiQuery(gameId ? JSON.stringify(gameId) : null, fetchStats);
  return {...state, stats: data || EMPTY};
}
