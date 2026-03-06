import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Calendar, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';
import type { CalendarEvent } from '../../types';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export default function CalendarWidget() {
  const [events, setEvents] = useSupabase<CalendarEvent>('calendar-events', []);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', time: '', color: '#6366f1', description: '' });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(i);

  const formatDate = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const getEventsForDay = (day: number) => events.filter(e => e.date === formatDate(day));

  const handleAdd = () => {
    if (!form.title || !selectedDate) return;
    const event: CalendarEvent = {
      id: uuid(),
      title: form.title,
      date: selectedDate,
      time: form.time || undefined,
      color: form.color,
      description: form.description || undefined,
    };
    setEvents(prev => [...prev, event]);
    setForm({ title: '', time: '', color: '#6366f1', description: '' });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : [];

  return (
    <WidgetWrapper widgetId="calendar" title="Kalender" icon={<Calendar size={16} />}>
      <div className="calendar-nav">
        <button className="btn-icon" onClick={prevMonth}><ChevronLeft size={16} /></button>
        <span className="calendar-month">{MONTHS[month]} {year}</span>
        <button className="btn-icon" onClick={nextMonth}><ChevronRight size={16} /></button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map(d => <div key={d} className="calendar-weekday">{d}</div>)}
        {days.map((day, i) => (
          <div
            key={i}
            className={`calendar-day ${day ? 'active' : ''} ${day && formatDate(day) === todayStr ? 'today' : ''} ${day && formatDate(day) === selectedDate ? 'selected' : ''}`}
            onClick={() => day && setSelectedDate(formatDate(day))}
          >
            {day && (
              <>
                <span>{day}</span>
                {getEventsForDay(day).length > 0 && (
                  <div className="calendar-dots">
                    {getEventsForDay(day).slice(0, 3).map(e => (
                      <span key={e.id} className="calendar-dot" style={{ background: e.color }} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {selectedDate && (
        <div className="calendar-events">
          <div className="calendar-events-header">
            <span>{new Date(selectedDate + 'T00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <button className="btn-icon" onClick={() => setShowForm(!showForm)}><Plus size={14} /></button>
          </div>

          {showForm && (
            <div className="vault-form compact">
              <input placeholder="Event *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="color-input" />
              <div className="form-actions">
                <button className="btn-primary" onClick={handleAdd}>Hinzufügen</button>
              </div>
            </div>
          )}

          {selectedEvents.map(e => (
            <div key={e.id} className="calendar-event" style={{ borderLeftColor: e.color }}>
              <div>
                <strong>{e.title}</strong>
                {e.time && <span className="event-time">{e.time}</span>}
              </div>
              <button className="btn-icon-sm delete-btn" onClick={() => handleDelete(e.id)}><Trash2 size={12} /></button>
            </div>
          ))}
          {selectedEvents.length === 0 && !showForm && <p className="empty-text">Keine Events</p>}
        </div>
      )}
    </WidgetWrapper>
  );
}
