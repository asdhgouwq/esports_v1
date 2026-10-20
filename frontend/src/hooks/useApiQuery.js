import {useCallback,useEffect,useState} from 'react';

export function useApiQuery(key, fetcher) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) return fetcher(JSON.parse(key), controller.signal);
    }).then(data => {
      if (!controller.signal.aborted) setResult({key, revision, data, error: null});
    }).catch(error => {
      if (!controller.signal.aborted) setResult({key, revision, data: null, error: error.message});
    });
    return () => controller.abort();
  }, [key, fetcher, revision]);
  const current = result?.key === key && result.revision === revision;
  const refetch = useCallback(() => setRevision(value => value + 1), []);
  return {data: current ? result.data : null, error: current ? result.error : null, loading: key !== null && !current, refetch};
}
