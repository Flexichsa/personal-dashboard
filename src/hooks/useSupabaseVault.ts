import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const LS_KEY_HASH = 'dashboard_vault_hash';
const LS_KEY_DATA = 'dashboard_vault_data';

function loadLocal(): { hash: string; data: string } {
  try {
    return {
      hash: localStorage.getItem(LS_KEY_HASH) || '',
      data: localStorage.getItem(LS_KEY_DATA) || '',
    };
  } catch {
    return { hash: '', data: '' };
  }
}

function saveLocal(hash: string, data: string): void {
  try {
    localStorage.setItem(LS_KEY_HASH, hash);
    localStorage.setItem(LS_KEY_DATA, data);
  } catch {
    // storage full
  }
}

export function useSupabaseVault(): {
  masterHash: string;
  setMasterHash: (value: string) => void;
  encryptedData: string;
  setEncryptedData: (value: string) => void;
  loading: boolean;
} {
  const { user } = useAuth();

  // Initialize from localStorage immediately (no flash, offline-safe)
  const [masterHash, setMasterHashLocal] = useState(() => loadLocal().hash);
  const [encryptedData, setEncryptedDataLocal] = useState(() => loadLocal().data);
  const [loading, setLoading] = useState(true);

  // Fetch from Supabase on mount — merge with localStorage
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchVault = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('password_vaults')
          .select('master_hash, encrypted_data')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows found (fine)
          console.error('[useSupabaseVault] Fetch error:', error.message);
          setLoading(false);
          return;
        }

        if (data && data.encrypted_data) {
          // Supabase has data — use it (source of truth for cross-device)
          setMasterHashLocal(data.master_hash);
          setEncryptedDataLocal(data.encrypted_data);
          saveLocal(data.master_hash, data.encrypted_data);
        } else {
          // Supabase empty — push local data up if exists
          const local = loadLocal();
          if (local.hash && local.data) {
            console.log('[useSupabaseVault] Syncing local vault to Supabase');
            const { error: upsertErr } = await supabase
              .from('password_vaults')
              .upsert({
                user_id: user.id,
                master_hash: local.hash,
                encrypted_data: local.data,
              });
            if (upsertErr) {
              console.error('[useSupabaseVault] Sync-up error:', upsertErr.message);
            }
          }
        }
      } catch (err) {
        console.error('[useSupabaseVault] Unexpected error:', err);
        // Keep localStorage data as fallback
      }
      setLoading(false);
    };

    fetchVault();
  }, [user]);

  const upsert = useCallback(
    (hash: string, encrypted: string) => {
      // Always save to localStorage immediately
      saveLocal(hash, encrypted);

      // Sync to Supabase if logged in
      if (!user) return;
      supabase
        .from('password_vaults')
        .upsert({ user_id: user.id, master_hash: hash, encrypted_data: encrypted })
        .then(({ error }) => {
          if (error) {
            console.error('[useSupabaseVault] Upsert error:', error.message);
          }
        });
    },
    [user],
  );

  const setMasterHash = useCallback(
    (value: string) => {
      setMasterHashLocal(value);
      upsert(value, encryptedData);
    },
    [upsert, encryptedData],
  );

  const setEncryptedData = useCallback(
    (value: string) => {
      setEncryptedDataLocal(value);
      upsert(masterHash, value);
    },
    [upsert, masterHash],
  );

  return { masterHash, setMasterHash, encryptedData, setEncryptedData, loading };
}
