import { useState, useCallback } from 'react';
import { loadData, saveData } from '../utils/storage';

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => loadData(key, defaultValue));

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = value instanceof Function ? value(prev) : value;
      saveData(key, next);
      return next;
    });
  }, [key]);

  return [state, setValue];
}
