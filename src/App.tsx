import { useState, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import type { ResponsiveLayouts, Layout } from 'react-grid-layout';
import {
  Lock, Users, FileText, Bookmark, Calendar, CheckSquare,
  Cloud, Clock, StickyNote, FolderOpen, Timer, Quote, Wallet, Cpu, ClipboardList,
  TrendingUp, BarChart2, Newspaper, Music,
  Plus, LayoutGrid, LogOut, Upload, Search, Sun, Moon, RotateCcw
} from 'lucide-react';
import 'react-grid-layout/css/styles.css';

import { useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import PasswordVault from './components/widgets/PasswordVault';
import ContactsWidget from './components/widgets/ContactsWidget';
import NotesWidget from './components/widgets/NotesWidget';
import BookmarksWidget from './components/widgets/BookmarksWidget';
import CalendarWidget from './components/widgets/CalendarWidget';
import TodoWidget from './components/widgets/TodoWidget';
import WeatherWidget from './components/widgets/WeatherWidget';
import WorldClockWidget from './components/widgets/WorldClockWidget';
import StickyNotesWidget from './components/widgets/StickyNotesWidget';
import FilesWidget from './components/widgets/FilesWidget';
import PomodoroWidget from './components/widgets/PomodoroWidget';
import QuotesWidget from './components/widgets/QuotesWidget';
import FinanceWidget from './components/widgets/FinanceWidget';
import HardwareWidget from './components/widgets/HardwareWidget';
import WorkInstructionsWidget from './components/widgets/WorkInstructionsWidget';
import CryptoWidget from './components/widgets/CryptoWidget';
import StocksWidget from './components/widgets/StocksWidget';
import NewsWidget from './components/widgets/NewsWidget';
import FocusMusicWidget from './components/widgets/FocusMusicWidget';

import { useLocalStorage } from './hooks/useLocalStorage';
import { useSyncedSettings } from './hooks/useSyncedSettings';
import { supabase } from './lib/supabase';

import './App.css';

interface WidgetDef {
  id: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  color: string;
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
}

const WIDGET_DEFS: WidgetDef[] = [
  { id: 'passwords', label: 'Passwort-Tresor', category: 'Sicherheit', icon: <Lock size={14} />, color: '#6366f1', component: <PasswordVault />, defaultW: 4, defaultH: 5, minW: 2, minH: 3 },
  { id: 'contacts', label: 'Kontakte', category: 'Organisation', icon: <Users size={14} />, color: '#8b5cf6', component: <ContactsWidget />, defaultW: 4, defaultH: 5, minW: 2, minH: 3 },
  { id: 'notes', label: 'Notizen', category: 'Produktivität', icon: <FileText size={14} />, color: '#f59e0b', component: <NotesWidget />, defaultW: 4, defaultH: 5, minW: 2, minH: 3 },
  { id: 'bookmarks', label: 'Lesezeichen', category: 'Organisation', icon: <Bookmark size={14} />, color: '#3b82f6', component: <BookmarksWidget />, defaultW: 4, defaultH: 4, minW: 2, minH: 2 },
  { id: 'calendar', label: 'Kalender', category: 'Organisation', icon: <Calendar size={14} />, color: '#ef4444', component: <CalendarWidget />, defaultW: 4, defaultH: 6, minW: 2, minH: 4 },
  { id: 'todos', label: 'Aufgaben', category: 'Produktivität', icon: <CheckSquare size={14} />, color: '#22c55e', component: <TodoWidget />, defaultW: 4, defaultH: 5, minW: 2, minH: 3 },
  { id: 'weather', label: 'Wetter', category: 'Tools', icon: <Cloud size={14} />, color: '#06b6d4', component: <WeatherWidget />, defaultW: 4, defaultH: 4, minW: 2, minH: 3 },
  { id: 'clocks', label: 'Weltuhren', category: 'Tools', icon: <Clock size={14} />, color: '#a855f7', component: <WorldClockWidget />, defaultW: 4, defaultH: 4, minW: 2, minH: 3 },
  { id: 'stickynotes', label: 'Schnellnotizen', category: 'Produktivität', icon: <StickyNote size={14} />, color: '#f97316', component: <StickyNotesWidget />, defaultW: 4, defaultH: 4, minW: 2, minH: 2 },
  { id: 'files', label: 'Dateien', category: 'Organisation', icon: <FolderOpen size={14} />, color: '#64748b', component: <FilesWidget />, defaultW: 4, defaultH: 4, minW: 2, minH: 3 },
  { id: 'pomodoro', label: 'Pomodoro', category: 'Produktivität', icon: <Timer size={14} />, color: '#ec4899', component: <PomodoroWidget />, defaultW: 4, defaultH: 5, minW: 2, minH: 3 },
  { id: 'quotes', label: 'Zitate', category: 'Tools', icon: <Quote size={14} />, color: '#14b8a6', component: <QuotesWidget />, defaultW: 4, defaultH: 3, minW: 2, minH: 2 },
  { id: 'finance', label: 'Finanzen', category: 'Tools', icon: <Wallet size={14} />, color: '#10b981', component: <FinanceWidget />, defaultW: 4, defaultH: 6, minW: 2, minH: 3 },
  { id: 'hardware', label: 'Hardware', category: 'Organisation', icon: <Cpu size={14} />, color: '#6366f1', component: <HardwareWidget />, defaultW: 4, defaultH: 6, minW: 2, minH: 3 },
  { id: 'work-instructions', label: 'Arbeitsanweisungen', category: 'Produktivität', icon: <ClipboardList size={14} />, color: '#0ea5e9', component: <WorkInstructionsWidget />, defaultW: 4, defaultH: 6, minW: 2, minH: 3 },
  { id: 'crypto', label: 'Krypto', category: 'Finanzen', icon: <TrendingUp size={14} />, color: '#f59e0b', component: <CryptoWidget />, defaultW: 3, defaultH: 5, minW: 2, minH: 3 },
  { id: 'stocks', label: 'Aktien', category: 'Finanzen', icon: <BarChart2 size={14} />, color: '#34d399', component: <StocksWidget />, defaultW: 3, defaultH: 5, minW: 2, minH: 3 },
  { id: 'news', label: 'News', category: 'Medien', icon: <Newspaper size={14} />, color: '#60a5fa', component: <NewsWidget />, defaultW: 4, defaultH: 6, minW: 2, minH: 3 },
  { id: 'music', label: 'Focus Music', category: 'Medien', icon: <Music size={14} />, color: '#ec4899', component: <FocusMusicWidget />, defaultW: 3, defaultH: 5, minW: 2, minH: 3 },
];

const CATEGORIES = ['Produktivität', 'Organisation', 'Tools', 'Sicherheit', 'Finanzen', 'Medien'];

const DEFAULT_VISIBLE = ['passwords', 'contacts', 'notes', 'calendar', 'todos', 'weather', 'quotes', 'pomodoro', 'clocks'];

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

// Returns the appropriate widget width for a given column count
function getWidgetWidth(defaultW: number, minW: number, cols: number): number {
  if (cols <= 4) {
    // Mobile: full-width for large widgets, half for small
    return Math.min(defaultW >= 3 ? cols : Math.ceil(cols / 2), cols);
  }
  if (cols <= 10) {
    // Tablet: proportional scale from 12-col baseline
    return Math.max(minW, Math.min(Math.round(defaultW * cols / 12), cols));
  }
  // Desktop: use defaultW as-is
  return Math.min(defaultW, cols);
}

function generateLayoutForCols(visibleIds: string[], cols: number): LayoutItem[] {
  const items: LayoutItem[] = [];
  let x = 0, y = 0, rowMaxH = 0;

  visibleIds.forEach(id => {
    const def = WIDGET_DEFS.find(d => d.id === id);
    if (!def) return;

    const w = getWidgetWidth(def.defaultW, def.minW, cols);
    const minW = Math.min(def.minW, cols);

    if (x + w > cols) {
      x = 0;
      y += rowMaxH;
      rowMaxH = 0;
    }

    items.push({ i: id, x, y, w, h: def.defaultH, minW, minH: def.minH });
    x += w;
    rowMaxH = Math.max(rowMaxH, def.defaultH);
  });

  return items;
}

function generateDefaultLayouts(visibleIds: string[]): ResponsiveLayouts {
  return {
    lg: generateLayoutForCols(visibleIds, GRID_COLS.lg) as Layout,
    md: generateLayoutForCols(visibleIds, GRID_COLS.md) as Layout,
    sm: generateLayoutForCols(visibleIds, GRID_COLS.sm) as Layout,
  };
}

// Enforce current WIDGET_DEFS constraints on saved layouts
function sanitizeLayouts(saved: ResponsiveLayouts): ResponsiveLayouts {
  const result: ResponsiveLayouts = {};
  for (const bp of Object.keys(saved)) {
    const cols = GRID_COLS[bp as keyof typeof GRID_COLS] || 12;
    const items = (saved[bp] || []) as LayoutItem[];
    result[bp] = items.map(item => {
      const def = WIDGET_DEFS.find(d => d.id === item.i);
      if (!def) return item;
      const minW = Math.min(def.minW, cols);
      return {
        ...item,
        minW,
        minH: def.minH,
        // Clamp width: respect user resizing but enforce minW and col limit
        w: Math.max(Math.min(item.w, cols), minW),
        h: Math.max(item.h, def.minH),
      };
    }) as Layout;
  }
  return result;
}

// localStorage keys that contain migratable data
const MIGRATE_KEYS: Record<string, string> = {
  'contacts': 'contacts',
  'notes': 'notes',
  'bookmarks': 'bookmarks',
  'calendar-events': 'calendar_events',
  'todos': 'todos',
  'sticky-notes': 'sticky_notes',
  'finance': 'finance_entries',
  'world-clocks': 'world_clocks',
};

function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function keysToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnake(key)] = value;
  }
  return result;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function formatDate(): string {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

// Grid config as stable references (prevents re-renders during drag)
const GRID_BREAKPOINTS = { lg: 1200, md: 768, sm: 0 };
// lg=Desktop (1200+): 12 cols | md=Tablet (768-1200): 10 cols | sm=Mobile (<768): 4 cols
const GRID_COLS = { lg: 12, md: 10, sm: 4 };
const GRID_MARGIN: [number, number] = [16, 16];
const GRID_MARGIN_TABLET: [number, number] = [12, 12];
const GRID_MARGIN_MOBILE: [number, number] = [8, 8];
const ROW_HEIGHT = 60;
const ROW_HEIGHT_TABLET = 55;
const ROW_HEIGHT_MOBILE = 50;
const DRAG_CONFIG = { handle: '.widget-header', cancel: 'button, a, input, textarea, select' };

// Lightweight window width subscription for responsive margin
const widthStore = {
  subscribe: (cb: () => void) => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb); },
  getSnapshot: () => window.innerWidth,
};

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { visibleWidgets, setVisibleWidgets, layouts, setLayouts, settingsLoading } = useSyncedSettings(
    DEFAULT_VISIBLE,
    generateDefaultLayouts(DEFAULT_VISIBLE)
  );
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'dark');
  const [maximizedWidget, setMaximizedWidget] = useState<string | null>(null);

  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: typeof window !== 'undefined' ? window.innerWidth - 32 : 1200 });
  const windowWidth = useSyncExternalStore(widthStore.subscribe, widthStore.getSnapshot);
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1200;
  const gridMargin = isMobile ? GRID_MARGIN_MOBILE : isTablet ? GRID_MARGIN_TABLET : GRID_MARGIN;
  const rowHeight = isMobile ? ROW_HEIGHT_MOBILE : isTablet ? ROW_HEIGHT_TABLET : ROW_HEIGHT;
  const sanitizedLayouts = useMemo(() => sanitizeLayouts(layouts), [layouts]);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keyboard shortcut: Cmd+K to open picker
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowWidgetPicker(prev => !prev);
        setPickerSearch('');
      }
      if (e.key === 'Escape') {
        if (maximizedWidget) {
          setMaximizedWidget(null);
        } else if (showWidgetPicker) {
          setShowWidgetPicker(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showWidgetPicker, maximizedWidget]);

  const handleLayoutChange = useCallback((_layout: Layout, allLayouts: ResponsiveLayouts) => {
    setLayouts(allLayouts);
  }, [setLayouts]);

  const addWidget = (id: string) => {
    if (visibleWidgets.includes(id)) return;
    const def = WIDGET_DEFS.find(d => d.id === id);
    if (!def) return;

    const newVisible = [...visibleWidgets, id];
    setVisibleWidgets(newVisible);

    setLayouts(prev => {
      const updated: ResponsiveLayouts = {};
      for (const bp of Object.keys(prev)) {
        const bpCols = GRID_COLS[bp as keyof typeof GRID_COLS] || 12;
        const w = getWidgetWidth(def.defaultW, def.minW, bpCols);
        const minW = Math.min(def.minW, bpCols);
        const newItem: LayoutItem = {
          i: id, x: 0, y: Infinity, w, h: def.defaultH, minW, minH: def.minH,
        };
        updated[bp] = [...(prev[bp] || []), newItem] as Layout;
      }
      if (Object.keys(updated).length === 0) {
        updated.lg = [{ i: id, x: 0, y: Infinity, w: def.defaultW, h: def.defaultH, minW: def.minW, minH: def.minH }] as Layout;
      }
      return updated;
    });

    setShowWidgetPicker(false);
  };

  const resetLayouts = () => {
    const newLayouts = generateDefaultLayouts(visibleWidgets);
    setLayouts(newLayouts);
  };

  const removeWidget = (id: string) => {
    setVisibleWidgets(prev => prev.filter(w => w !== id));
    setLayouts(prev => {
      const updated: ResponsiveLayouts = {};
      for (const bp of Object.keys(prev)) {
        updated[bp] = ((prev[bp] || []) as LayoutItem[]).filter(item => item.i !== id) as Layout;
      }
      return updated;
    });
  };

  // Check if there's localStorage data to migrate
  const hasLocalData = () => {
    return Object.keys(MIGRATE_KEYS).some(key => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const arr = JSON.parse(raw);
        return Array.isArray(arr) && arr.length > 0;
      } catch {
        return false;
      }
    });
  };

  const migrateLocalStorage = async () => {
    if (!user) return;
    setMigrating(true);

    for (const [localKey, tableName] of Object.entries(MIGRATE_KEYS)) {
      try {
        const raw = localStorage.getItem(localKey);
        if (!raw) continue;
        const items = JSON.parse(raw);
        if (!Array.isArray(items) || items.length === 0) continue;

        const rows = items.map((item: Record<string, unknown>) => ({
          ...keysToSnake(item),
          user_id: user.id,
        }));

        await supabase.from(tableName).upsert(rows, { onConflict: 'id' });
      } catch {
        // Skip failed tables
      }
    }

    // Migrate password vault
    try {
      const hash = localStorage.getItem('pw-master-hash');
      const encrypted = localStorage.getItem('pw-encrypted');
      if (hash && encrypted) {
        await supabase.from('password_vaults').upsert({
          user_id: user.id,
          master_hash: JSON.parse(hash),
          encrypted_data: JSON.parse(encrypted),
        });
      }
    } catch {
      // Skip
    }

    setMigrating(false);
    setMigrated(true);
  };

  const hiddenWidgets = useMemo(() => {
    const hidden = WIDGET_DEFS.filter(d => !visibleWidgets.includes(d.id));
    if (!pickerSearch.trim()) return hidden;
    const q = pickerSearch.toLowerCase();
    return hidden.filter(d => d.label.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
  }, [visibleWidgets, pickerSearch]);

  if (authLoading || (user && settingsLoading)) {
    return (
      <div className="auth-page">
        <div className="auth-form-section">
          <div className="auth-card">
            <LayoutGrid size={28} style={{ color: 'var(--accent)' }} />
            <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>Laden...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const showMigration = !migrated && hasLocalData();
  const email = user.email || '';
  const displayName = email.split('@')[0];

  return (
    <div className="dashboard" ref={containerRef}>
      <header className="dashboard-header">
        <div className="header-left">
          <div className="header-top-row">
            <LayoutGrid size={22} />
            <h1>Personal Hub</h1>
          </div>
          <span className="header-greeting">
            {getGreeting()}, {displayName}!
          </span>
        </div>
        <div className="header-right">
          <span className="header-date">{formatDate()}</span>
          {showMigration && (
            <button
              className="add-widget-btn migrate-btn"
              onClick={migrateLocalStorage}
              disabled={migrating}
            >
              <Upload size={14} />
              <span>{migrating ? 'Migriere...' : 'Importieren'}</span>
            </button>
          )}
          <button
            className="add-widget-btn"
            onClick={() => { setShowWidgetPicker(true); setPickerSearch(''); }}
          >
            <Plus size={16} />
            <span>Widget</span>
          </button>
          <button
            className="theme-toggle"
            onClick={resetLayouts}
            title="Layout zurücksetzen"
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className="add-widget-btn logout-btn" onClick={signOut} title="Abmelden">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Widget Picker — Command Palette */}
      {showWidgetPicker && (
        <div className="widget-picker-overlay" onClick={() => setShowWidgetPicker(false)}>
          <div className="widget-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="picker-search">
              <Search size={16} />
              <input
                placeholder="Widget suchen..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                autoFocus
              />
              <span className="picker-shortcut">Esc</span>
            </div>
            <div className="picker-categories">
              {hiddenWidgets.length === 0 ? (
                <p className="picker-empty">
                  {pickerSearch ? 'Keine Ergebnisse' : 'Alle Widgets sind aktiv'}
                </p>
              ) : (
                CATEGORIES.map(cat => {
                  const catWidgets = hiddenWidgets.filter(d => d.category === cat);
                  if (catWidgets.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className="picker-category-title">{cat}</div>
                      <div className="picker-grid">
                        {catWidgets.map(def => (
                          <button
                            key={def.id}
                            className="picker-widget-btn"
                            onClick={() => addWidget(def.id)}
                          >
                            <div className="picker-widget-icon" style={{ background: def.color }}>
                              {def.icon}
                            </div>
                            <span>{def.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Action Bar */}
      {isMobile && (
        <div className="mobile-bottom-bar">
          <button
            className="mobile-action-btn"
            onClick={() => { setShowWidgetPicker(true); setPickerSearch(''); }}
          >
            <Plus size={20} />
            <span>Widget</span>
          </button>
          <button
            className="mobile-action-btn"
            onClick={resetLayouts}
            title="Layout zurücksetzen"
          >
            <RotateCcw size={20} />
            <span>Reset</span>
          </button>
          <button
            className="mobile-action-btn"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            <span>Theme</span>
          </button>
          <button className="mobile-action-btn logout" onClick={signOut}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      )}

      {mounted && (
        <ResponsiveGridLayout
          width={width}
          layouts={sanitizedLayouts}
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={rowHeight}
          onLayoutChange={handleLayoutChange}
          dragConfig={DRAG_CONFIG}
          margin={gridMargin}
        >
          {visibleWidgets.map((id, index) => {
            const def = WIDGET_DEFS.find(d => d.id === id);
            if (!def) return null;
            return (
              <div
                key={id}
                className="grid-widget"
                style={{ '--widget-index': index } as React.CSSProperties}
                onDoubleClick={(e) => {
                  // Don't maximize when double-clicking inputs, buttons, etc.
                  const target = e.target as HTMLElement;
                  const interactive = target.closest('input, textarea, select, button, a, [contenteditable]');
                  if (!interactive) setMaximizedWidget(id);
                }}
              >
                <button className="widget-remove" onClick={() => removeWidget(id)} title="Entfernen">&times;</button>
                {def.component}
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}

      {/* Fullscreen Widget Overlay */}
      {maximizedWidget && (() => {
        const def = WIDGET_DEFS.find(d => d.id === maximizedWidget);
        if (!def) return null;
        return (
          <div
            className="widget-fullscreen-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMaximizedWidget(null);
            }}
          >
            <div className="widget-fullscreen-container">
              <button
                className="widget-fullscreen-close"
                onClick={() => setMaximizedWidget(null)}
                title="Schließen (Esc)"
              >
                &times;
              </button>
              {def.component}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
