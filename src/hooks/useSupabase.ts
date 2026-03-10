import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// camelCase → snake_case
function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// snake_case → camelCase
function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function keysToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip undefined values — they cause issues with Supabase inserts
    if (value !== undefined) {
      result[toSnake(key)] = value;
    }
  }
  return result;
}

function keysToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toCamel(key)] = value;
  }
  return result;
}

// Map localStorage keys to Supabase table names
const TABLE_MAP: Record<string, string> = {
  'contacts': 'contacts',
  'companies': 'companies',
  'notes': 'notes',
  'bookmarks': 'bookmarks',
  'calendar-events': 'calendar_events',
  'todos': 'todos',
  'sticky-notes': 'sticky_notes',
  'finance': 'finance_entries',
  'world-clocks': 'world_clocks',
  'hardware-devices': 'hardware_devices',
  'files': 'files',
  'work-instructions': 'work_instructions',
  'pomodoro': 'pomodoro_settings',
  'weather-prefs': 'weather_prefs',
};

const LS_PREFIX = 'dashboard_';

// --- localStorage helpers ---
function loadFromLocalStorage<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw) return JSON.parse(raw) as T[];
  } catch {
    // corrupted data
  }
  return null;
}

function saveToLocalStorage<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

interface HasId {
  id: string;
}

export function useSupabase<T extends HasId>(
  localKey: string,
  defaultValue: T[],
): [T[], (value: T[] | ((prev: T[]) => T[])) => void, boolean] {
  const { user } = useAuth();
  const table = TABLE_MAP[localKey] || localKey;

  // Initialize from localStorage immediately (instant load, no flash)
  const [data, setData] = useState<T[]>(() => {
    const cached = loadFromLocalStorage<T>(localKey);
    return cached ?? defaultValue;
  });
  const [loading, setLoading] = useState(true);
  const dataRef = useRef<T[]>(data);

  // Keep ref in sync
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Fetch from Supabase on mount — merge with localStorage
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: rows, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          console.error(`[useSupabase] Fetch error for ${table}:`, error.message);
          // Keep localStorage data as fallback
          setLoading(false);
          return;
        }

        if (rows && rows.length > 0) {
          const camelRows = rows.map(row => {
            const { user_id: _, ...rest } = row;
            return keysToCamel(rest) as T;
          });
          setData(camelRows);
          dataRef.current = camelRows;
          // Update localStorage cache
          saveToLocalStorage(localKey, camelRows);
        } else {
          // Supabase is empty — check if we have local data to push up
          const localData = loadFromLocalStorage<T>(localKey);
          if (localData && localData.length > 0) {
            // Push local data to Supabase (first-time sync or recovery)
            const rows = localData.map(item =>
              ({ ...keysToSnake(item as unknown as Record<string, unknown>), user_id: user.id })
            );
            const { error: insertError } = await supabase.from(table).upsert(rows);
            if (insertError) {
              console.error(`[useSupabase] Sync-up error for ${table}:`, insertError.message);
            } else {
              console.log(`[useSupabase] Synced ${localData.length} local items to ${table}`);
            }
            setData(localData);
            dataRef.current = localData;
          }
        }
      } catch (err) {
        console.error(`[useSupabase] Unexpected error for ${table}:`, err);
      }
      setLoading(false);
    };

    fetchData();
  }, [user, table, localKey]);

  const setValue = useCallback(
    (value: T[] | ((prev: T[]) => T[])) => {
      const prev = dataRef.current;
      const next = value instanceof Function ? value(prev) : value;

      // 1. Optimistic update
      setData(next);
      dataRef.current = next;

      // 2. Always save to localStorage immediately (crash-safe)
      saveToLocalStorage(localKey, next);

      // 3. Sync to Supabase (if logged in)
      if (!user) return;

      const prevMap = new Map(prev.map(item => [item.id, item]));
      const nextMap = new Map(next.map(item => [item.id, item]));

      // Inserts
      const toInsert = next.filter(item => !prevMap.has(item.id));
      // Deletes
      const toDelete = prev.filter(item => !nextMap.has(item.id));
      // Updates
      const toUpdate = next.filter(item => {
        const old = prevMap.get(item.id);
        return old && JSON.stringify(old) !== JSON.stringify(item);
      });

      const userId = user.id;

      if (toInsert.length > 0) {
        const rows = toInsert.map(item =>
          ({ ...keysToSnake(item as unknown as Record<string, unknown>), user_id: userId })
        );
        supabase.from(table).upsert(rows).then(({ error }) => {
          if (error) {
            console.error(`[useSupabase] Insert error in ${table}:`, error.message, error.details, error.hint);
          }
        });
      }

      if (toDelete.length > 0) {
        const ids = toDelete.map(item => item.id);
        supabase.from(table).delete().in('id', ids).eq('user_id', userId).then(({ error }) => {
          if (error) {
            console.error(`[useSupabase] Delete error in ${table}:`, error.message);
          }
        });
      }

      for (const item of toUpdate) {
        const row = keysToSnake(item as unknown as Record<string, unknown>);
        delete row.user_id;
        supabase.from(table).update(row).eq('id', item.id).eq('user_id', userId).then(({ error }) => {
          if (error) {
            console.error(`[useSupabase] Update error in ${table}:`, error.message, error.details);
          }
        });
      }
    },
    [user, table, localKey],
  );

  return [data, setValue, loading];
}
