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
  encryptedData: string;
  saveVault: (hash: string, data: string) => void;
  loading: boolean;
} {
  const { user } = useAuth();

  const [masterHash, setMasterHashLocal] = useState(() => loadLocal().hash);
  const [encryptedData, setEncryptedDataLocal] = useState(() => loadLocal().data);
  const [loading, setLoading] = useState(true);

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
          console.error('[useSupabaseVault] Fetch error:', error.message);
          setLoading(false);
          return;
        }

        if (data && data.encrypted_data) {
          setMasterHashLocal(data.master_hash);
          setEncryptedDataLocal(data.encrypted_data);
          saveLocal(data.master_hash, data.encrypted_data);
        } else {
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
      }
      setLoading(false);
    };

    fetchVault();
  }, [user]);

  const saveVault = useCallback(
    (hash: string, data: string) => {
      setMasterHashLocal(hash);
      setEncryptedDataLocal(data);
      saveLocal(hash, data);

      if (!user) return;
      supabase
        .from('password_vaults')
        .upsert({ user_id: user.id, master_hash: hash, encrypted_data: data })
        .then(({ error }) => {
          if (error) {
            console.error('[useSupabaseVault] Upsert error:', error.message);
          }
        });
    },
    [user],
  );

  return { masterHash, encryptedData, saveVault, loading };
}
