import { createContext, useContext, useEffect, useState } from 'react';

const DDragonContext = createContext({ version: '14.24.1' });

export function DDragonProvider({ children }) {
  const [version, setVersion] = useState('14.24.1');

  useEffect(() => {
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then((r) => r.json())
      .then((versions) => setVersion(versions[0]))
      .catch(() => {});
  }, []);

  return (
    <DDragonContext.Provider value={{ version }}>
      {children}
    </DDragonContext.Provider>
  );
}

export function useDDragon() {
  return useContext(DDragonContext);
}
