import {createContext,useContext} from 'react';
export const DDragonContext = createContext({version: null, champions: {}, equipment: {runes: [], spells: {}, items: {}}});
export const ChatGptContext = createContext(null);
export function useDDragon() { return useContext(DDragonContext); }
export function useChatGpt() {
  const value = useContext(ChatGptContext);
  if (!value) throw new Error('ChatGptProvider is required');
  return value;
}
