import { useState, useEffect, useRef } from 'react';
import { Timer, Play, Pause, RotateCcw, Coffee, Brain } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';

type Mode = 'focus' | 'short' | 'long';

const LABELS: Record<Mode, string> = { focus: 'Fokus', short: 'Kurze Pause', long: 'Lange Pause' };

interface PomodoroState {
  id: string;
  totalSessions: number;
  todaySessions: number;
  todayDate: string;
  focusDuration: number;
  shortDuration: number;
  longDuration: number;
}

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_STATE: PomodoroState = {
  id: 'pomodoro-settings',
  totalSessions: 0,
  todaySessions: 0,
  todayDate: today(),
  focusDuration: 25,
  shortDuration: 5,
  longDuration: 15,
};

export default function PomodoroWidget() {
  const [stateArr, setStateArr] = useSupabase<PomodoroState>('pomodoro', [DEFAULT_STATE]);
  const state = stateArr[0] || DEFAULT_STATE;

  const [mode, setMode] = useState<Mode>('focus');
  const durations: Record<Mode, number> = {
    focus: (state.focusDuration || 25) * 60,
    short: (state.shortDuration || 5) * 60,
    long: (state.longDuration || 15) * 60,
  };
  const [timeLeft, setTimeLeft] = useState(durations.focus);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // Reset today counter if date changed
  const sessions = state.todayDate === today() ? state.todaySessions : 0;
  const totalSessions = state.totalSessions || 0;

  useEffect(() => {
    if (running && timeLeft > 0) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setRunning(false);
            // Play notification sound
            try {
              const audio = new AudioContext();
              const osc = audio.createOscillator();
              const gain = audio.createGain();
              osc.connect(gain);
              gain.connect(audio.destination);
              osc.frequency.value = 800;
              gain.gain.value = 0.3;
              osc.start();
              osc.stop(audio.currentTime + 0.5);
            } catch {
              // audio not supported
            }
            if (mode === 'focus') {
              // Persist session count
              const d = today();
              const todaySess = state.todayDate === d ? state.todaySessions + 1 : 1;
              setStateArr([{
                ...state,
                totalSessions: (state.totalSessions || 0) + 1,
                todaySessions: todaySess,
                todayDate: d,
              }]);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode, timeLeft]);

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setTimeLeft(durations[newMode]);
    setRunning(false);
  };

  const reset = () => {
    setTimeLeft(durations[mode]);
    setRunning(false);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = ((durations[mode] - timeLeft) / durations[mode]) * 100;

  return (
    <WidgetWrapper widgetId="pomodoro" title="Pomodoro" icon={<Timer size={16} />}>
      <div className="pomodoro-widget">
        <div className="pomodoro-modes">
          <button className={`pomodoro-mode ${mode === 'focus' ? 'active' : ''}`} onClick={() => switchMode('focus')}>
            <Brain size={13} /> Fokus
          </button>
          <button className={`pomodoro-mode ${mode === 'short' ? 'active' : ''}`} onClick={() => switchMode('short')}>
            <Coffee size={13} /> Kurz
          </button>
          <button className={`pomodoro-mode ${mode === 'long' ? 'active' : ''}`} onClick={() => switchMode('long')}>
            <Coffee size={13} /> Lang
          </button>
        </div>

        <div className="pomodoro-timer">
          <svg className="pomodoro-ring" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" className="ring-bg" />
            <circle
              cx="50" cy="50" r="45"
              className="ring-progress"
              style={{
                strokeDasharray: `${2 * Math.PI * 45}`,
                strokeDashoffset: `${2 * Math.PI * 45 * (1 - progress / 100)}`,
              }}
            />
          </svg>
          <div className="pomodoro-time">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          <div className="pomodoro-label">{LABELS[mode]}</div>
        </div>

        <div className="pomodoro-controls">
          <button className="btn-icon" onClick={reset}><RotateCcw size={18} /></button>
          <button className="btn-primary pomodoro-play" onClick={() => setRunning(!running)}>
            {running ? <Pause size={20} /> : <Play size={20} />}
          </button>
        </div>

        <div className="pomodoro-sessions">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className={`session-dot ${i < sessions % 4 ? 'completed' : ''}`} />
          ))}
          <span className="session-count">Heute: {sessions} · Gesamt: {totalSessions}</span>
        </div>
      </div>
    </WidgetWrapper>
  );
}
