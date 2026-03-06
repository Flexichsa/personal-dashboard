import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { ResponsiveLayouts } from 'react-grid-layout';

interface SyncedSettings {
  visibleWidgets: string[];
  setVisibleWidgets: (value: string[] | ((prev: string[]) => string[])) => void;
  layouts: ResponsiveLayouts;
  setLayouts: (value: ResponsiveLayouts | ((prev: ResponsiveLayouts) => ResponsiveLayouts)) => void;
  settingsLoading: boolean;
}

export function useSyncedSettings(
  defaultWidgets: string[],
  defaultLayouts: ResponsiveLayouts
): SyncedSettings {
  const { user } = useAuth();

  // Fast init from localStorage
  const [visibleWidgets, setVW] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('visible-widgets');
      if (s) return JSON.parse(s);
    } catch { /* ignore */ }
    return defaultWidgets;
  });

  const [layouts, setLO] = useState<ResponsiveLayouts>(() => {
    try {
      const s = localStorage.getItem('widget-layouts');
      if (s) return JSON.parse(s);
    } catch { /* ignore */ }
    return defaultLayouts;
  });

  const [settingsLoading, setSettingsLoading] = useState(true);
  const widgetsTimer = useRef<number>(0);
  const layoutsTimer = useRef<number>(0);

  // Sync from Supabase on login (overrides localStorage)
  useEffect(() => {
    if (!user) { setSettingsLoading(false); return; }

    supabase
      .from('user_settings')
      .select('visible_widgets, widget_layouts')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.visible_widgets) {
            setVW(data.visible_widgets as string[]);
            localStorage.setItem('visible-widgets', JSON.stringify(data.visible_widgets));
          }
          if (data.widget_layouts) {
            setLO(data.widget_layouts as ResponsiveLayouts);
            localStorage.setItem('widget-layouts', JSON.stringify(data.widget_layouts));
          }
        }
        setSettingsLoading(false);
      });
  }, [user]);

  const setVisibleWidgets = useCallback((value: string[] | ((prev: string[]) => string[])) => {
    setVW(prev => {
      const next = value instanceof Function ? value(prev) : value;
      localStorage.setItem('visible-widgets', JSON.stringify(next));

      if (user) {
        clearTimeout(widgetsTimer.current);
        widgetsTimer.current = window.setTimeout(() => {
          supabase.from('user_settings').upsert(
            { user_id: user.id, visible_widgets: next },
            { onConflict: 'user_id' }
          );
        }, 300);
      }
      return next;
    });
  }, [user]);

  const setLayouts = useCallback((value: ResponsiveLayouts | ((prev: ResponsiveLayouts) => ResponsiveLayouts)) => {
    setLO(prev => {
      const next = value instanceof Function ? value(prev) : value;
      localStorage.setItem('widget-layouts', JSON.stringify(next));

      if (user) {
        clearTimeout(layoutsTimer.current);
        layoutsTimer.current = window.setTimeout(() => {
          supabase.from('user_settings').upsert(
            { user_id: user.id, widget_layouts: next },
            { onConflict: 'user_id' }
          );
        }, 1000); // Longer debounce — layouts change frequently during drag
      }
      return next;
    });
  }, [user]);

  return { visibleWidgets, setVisibleWidgets, layouts, setLayouts, settingsLoading };
}
