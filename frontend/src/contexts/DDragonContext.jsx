import { createContext, useContext, useEffect, useState } from 'react';

const DDragonContext = createContext({ version: '14.24.1' });

export function DDragonProvider({ children }) {
  const [version, setVersion] = useState('14.24.1');
  const [champions, setChampions] = useState({});

  useEffect(() => {
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then((r) => r.json())
      .then((versions) => setVersion(versions[0]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/ko_KR/champion.json`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Champion catalog unavailable'); return response.json(); })
      .then((data) => { if (!controller.signal.aborted) setChampions(data.data || {}); })
      .catch(() => {});
    return () => controller.abort();
  }, [version]);

  return (
    <DDragonContext.Provider value={{ version, champions }}>
      {children}
    </DDragonContext.Provider>
  );
}

export function useDDragon() {
  return useContext(DDragonContext);
}
