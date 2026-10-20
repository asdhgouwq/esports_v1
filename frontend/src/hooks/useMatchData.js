import {api} from '../lib/api';
import {useApiQuery} from './useApiQuery';
const fetchMatches = async (params, signal) => (await api.getMatches(params, signal)).data || [];
const EMPTY = [];
export function useMatchData(params = {}) {
  const {data, ...state} = useApiQuery(JSON.stringify(params), fetchMatches);
  return {...state, matches: data || EMPTY};
}
