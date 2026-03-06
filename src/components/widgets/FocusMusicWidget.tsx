import { useState } from 'react';
import { Music, Play, Square } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useLocalStorage } from '../../hooks/useLocalStorage';

const STREAMS = [
  { id: 'lofi-girl', label: 'Lo-Fi Girl', desc: 'Chill Beats to Study / Relax', videoId: 'jfKfPfyJRdk' },
  { id: 'lofi-hip-hop', label: 'Lo-Fi Hip Hop', desc: 'Beats to Study & Relax', videoId: '5qap5aO4i9A' },
  { id: 'jazz', label: 'Café Jazz', desc: 'Entspannter Jazz fürs Arbeiten', videoId: 'VMAPTo7RVCo' },
  { id: 'deep-focus', label: 'Deep Focus', desc: 'Instrumentale Fokus-Musik', videoId: 'b1gYFtXIAr4' },
  { id: 'piano', label: 'Piano Study', desc: 'Ruhige Klaviermusik', videoId: '4oStw0r33so' },
  { id: 'nature', label: 'Natur & Regen', desc: 'Regen- und Naturgeräusche', videoId: 'q76bMs-NwRk' },
];

export default function FocusMusicWidget() {
  const [activeId, setActiveId] = useLocalStorage<string>('focus-music-stream', 'lofi-girl');
  const [playing, setPlaying] = useState(false);

  const stream = STREAMS.find(s => s.id === activeId) ?? STREAMS[0];

  const selectStream = (id: string) => {
    setActiveId(id);
    setPlaying(false);
  };

  return (
    <WidgetWrapper widgetId="music" title="Focus Music" icon={<Music size={16} />}>
      <div className="music-widget">
        {playing ? (
          <div className="music-player-active">
            <iframe
              className="music-iframe"
              src={`https://www.youtube.com/embed/${stream.videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={stream.label}
            />
            <div className="music-now-playing">
              <div className="music-wave">
                <span /><span /><span /><span /><span />
              </div>
              <div className="music-track-info">
                <span className="music-track-name">{stream.label}</span>
                <span className="music-track-desc">{stream.desc}</span>
              </div>
            </div>
            <button className="btn-secondary music-stop-btn" onClick={() => setPlaying(false)}>
              <Square size={13} />
              <span>Stop</span>
            </button>
          </div>
        ) : (
          <div className="music-idle">
            <div className="music-cover-icon">
              <Music size={32} />
            </div>
            <div className="music-track-info">
              <span className="music-track-name">{stream.label}</span>
              <span className="music-track-desc">{stream.desc}</span>
            </div>
            <button className="btn-primary music-play-btn" onClick={() => setPlaying(true)}>
              <Play size={15} />
              <span>Abspielen</span>
            </button>
          </div>
        )}

        <div className="music-streams">
          {STREAMS.map(s => (
            <button
              key={s.id}
              className={`music-stream-btn ${s.id === activeId ? 'active' : ''}`}
              onClick={() => selectStream(s.id)}
              title={s.desc}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </WidgetWrapper>
  );
}
