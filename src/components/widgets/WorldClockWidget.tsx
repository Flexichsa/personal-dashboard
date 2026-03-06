import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { Clock, Plus, Trash2 } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';
import type { WorldClock } from '../../types';

const DEFAULT_CLOCKS: WorldClock[] = [
  { id: '1', label: 'Berlin', timezone: 'Europe/Berlin' },
  { id: '2', label: 'New York', timezone: 'America/New_York' },
  { id: '3', label: 'Tokyo', timezone: 'Asia/Tokyo' },
];

const POPULAR_TIMEZONES = [
  { label: 'Berlin', tz: 'Europe/Berlin' },
  { label: 'London', tz: 'Europe/London' },
  { label: 'New York', tz: 'America/New_York' },
  { label: 'Los Angeles', tz: 'America/Los_Angeles' },
  { label: 'Tokyo', tz: 'Asia/Tokyo' },
  { label: 'Sydney', tz: 'Australia/Sydney' },
  { label: 'Dubai', tz: 'Asia/Dubai' },
  { label: 'Shanghai', tz: 'Asia/Shanghai' },
  { label: 'Mumbai', tz: 'Asia/Kolkata' },
  { label: 'São Paulo', tz: 'America/Sao_Paulo' },
  { label: 'Moskau', tz: 'Europe/Moscow' },
  { label: 'Singapur', tz: 'Asia/Singapore' },
];

export default function WorldClockWidget() {
  const [clocks, setClocks] = useSupabase<WorldClock>('world-clocks', DEFAULT_CLOCKS);
  const [now, setNow] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const addClock = (label: string, timezone: string) => {
    setClocks(prev => [...prev, { id: uuid(), label, timezone }]);
    setShowAdd(false);
  };

  const removeClock = (id: string) => {
    setClocks(prev => prev.filter(c => c.id !== id));
  };

  const getTime = (tz: string) => {
    return now.toLocaleTimeString('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getDate = (tz: string) => {
    return now.toLocaleDateString('de-DE', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getOffset = (tz: string) => {
    const formatter = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' });
    const parts = formatter.formatToParts(now);
    return parts.find(p => p.type === 'timeZoneName')?.value || '';
  };

  return (
    <WidgetWrapper widgetId="clocks" title="Weltuhren" icon={<Clock size={16} />}>
      <div className="clock-list">
        {clocks.map(clock => (
          <div key={clock.id} className="clock-card">
            <div className="clock-info">
              <span className="clock-label">{clock.label}</span>
              <span className="clock-offset">{getOffset(clock.timezone)}</span>
            </div>
            <div className="clock-time">{getTime(clock.timezone)}</div>
            <div className="clock-date">{getDate(clock.timezone)}</div>
            <button className="btn-icon-sm delete-btn clock-delete" onClick={() => removeClock(clock.id)}><Trash2 size={11} /></button>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="clock-add-list">
          {POPULAR_TIMEZONES.filter(tz => !clocks.some(c => c.timezone === tz.tz)).map(tz => (
            <button key={tz.tz} className="clock-add-btn" onClick={() => addClock(tz.label, tz.tz)}>
              + {tz.label}
            </button>
          ))}
          <button className="btn-secondary" onClick={() => setShowAdd(false)} style={{ marginTop: 4 }}>Schließen</button>
        </div>
      ) : (
        <button className="btn-icon add-clock-btn" onClick={() => setShowAdd(true)}><Plus size={16} /></button>
      )}
    </WidgetWrapper>
  );
}
