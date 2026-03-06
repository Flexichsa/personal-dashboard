import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { ResponsiveLayouts } from 'react-grid-layout';

export interface DashboardPage {
  id: string;
  name: string;
  visibleWidgets: string[];
  layouts: ResponsiveLayouts;
}

type PageUpdate = Partial<DashboardPage> | ((page: DashboardPage) => Partial<DashboardPage>);

const LS_PAGES = 'dashboard-pages';
const LS_ACTIVE = 'dashboard-active-page';

export function usePages(defaultPages: DashboardPage[]) {
  const { user } = useAuth();

  const [pages, setPages] = useState<DashboardPage[]>(() => {
    try {
      const raw = localStorage.getItem(LS_PAGES);
      if (raw) return JSON.parse(raw) as DashboardPage[];
    } catch { /* ignore */ }
    return defaultPages;
  });

  const [activeId, setActiveId] = useState<string>(() => {
    return localStorage.getItem(LS_ACTIVE) ?? defaultPages[0].id;
  });

  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<number>(0);

  // Load from Supabase on login
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    supabase
      .from('user_settings')
      .select('pages_data, visible_widgets, widget_layouts')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.pages_data) {
          // New multi-page format
          const loaded = data.pages_data as DashboardPage[];
          setPages(loaded);
          localStorage.setItem(LS_PAGES, JSON.stringify(loaded));
        } else if (data?.visible_widgets || data?.widget_layouts) {
          // Migrate old single-page format into page 0 (Übersicht)
          setPages(prev => {
            const next = prev.map((p, i) =>
              i === 0
                ? {
                    ...p,
                    visibleWidgets: (data.visible_widgets as string[]) ?? p.visibleWidgets,
                    layouts: (data.widget_layouts as ResponsiveLayouts) ?? p.layouts,
                  }
                : p
            );
            localStorage.setItem(LS_PAGES, JSON.stringify(next));
            return next;
          });
        }
        setLoading(false);
      });
  }, [user]);

  const persist = useCallback((next: DashboardPage[]) => {
    localStorage.setItem(LS_PAGES, JSON.stringify(next));
    if (user) {
      clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        supabase
          .from('user_settings')
          .upsert({ user_id: user.id, pages_data: next }, { onConflict: 'user_id' })
          .then(({ error }) => {
            if (error) console.warn('[usePages] Supabase sync:', error.message);
          });
      }, 800);
    }
  }, [user]);

  const updatePage = useCallback((id: string, update: PageUpdate) => {
    setPages(prev => {
      const next = prev.map(p =>
        p.id === id
          ? { ...p, ...(update instanceof Function ? update(p) : update) }
          : p
      );
      persist(next);
      return next;
    });
  }, [persist]);

  const addPage = useCallback((name: string, initial: Pick<DashboardPage, 'visibleWidgets' | 'layouts'>) => {
    const id = `page_${Date.now()}`;
    const newPage: DashboardPage = { id, name, ...initial };
    setPages(prev => {
      const next = [...prev, newPage];
      persist(next);
      return next;
    });
    setActiveId(id);
    localStorage.setItem(LS_ACTIVE, id);
    return id;
  }, [persist]);

  const deletePage = useCallback((id: string) => {
    setPages(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(p => p.id !== id);
      if (activeId === id) {
        const newActive = next[0].id;
        setActiveId(newActive);
        localStorage.setItem(LS_ACTIVE, newActive);
      }
      persist(next);
      return next;
    });
  }, [activeId, persist]);

  const switchPage = useCallback((id: string) => {
    setActiveId(id);
    localStorage.setItem(LS_ACTIVE, id);
  }, []);

  const activePage = pages.find(p => p.id === activeId) ?? pages[0];

  return { pages, activePage, loading, switchPage, addPage, deletePage, updatePage };
}
