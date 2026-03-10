import { useState, useEffect, useCallback } from 'react';
import { Monitor, Cpu, MemoryStick, Thermometer, Wifi, Container, RefreshCw, AlertCircle, Zap } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';

const API = 'http://localhost:7777/api/dashboard';
const REFRESH_MS = 4000;

interface MacStats {
  cpu: number;
  ramPct: number;
  ramUsedGB: number;
  ramTotalGB: number;
  gpu: number | null;
  socHotspot: number | null;
  socAvg: number | null;
  fan: number | null;
  powerSystem: number | null;
  netDown: number;
  netUp: number;
  sessionRxGB: number;
  sessionTxGB: number;
  dockerRunning: number;
  dockerTotal: number;
}

function fmt(bytes_per_sec: number): string {
  if (bytes_per_sec >= 1024 * 1024) return (bytes_per_sec / 1024 / 1024).toFixed(1) + ' MB/s';
  if (bytes_per_sec >= 1024) return (bytes_per_sec / 1024).toFixed(0) + ' KB/s';
  return bytes_per_sec.toFixed(0) + ' B/s';
}

function fmtGB(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(1);
}

function tempColor(t: number | null): string {
  if (t === null) return 'var(--text-muted)';
  if (t >= 80) return 'var(--danger)';
  if (t >= 65) return 'var(--warning)';
  return 'var(--success)';
}

function Ring({ pct, color, size = 56, stroke = 5 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  );
}

export default function MacStatsWidget() {
  const [stats, setStats] = useState<MacStats | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(API, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error();
      const d = await res.json();

      const memUsed = d.mem?.active ?? 0;
      const memTotal = d.mem?.total ?? 1;
      const iface = d.network?.interfaces?.[0];
      const containers: { state: string }[] = d.docker?.containers ?? [];

      setStats({
        cpu: Math.round(d.cpu?.load?.currentLoad ?? 0),
        ramPct: Math.round((memUsed / memTotal) * 100),
        ramUsedGB: memUsed,
        ramTotalGB: memTotal,
        gpu: d.temps?.gpu ?? null,
        socHotspot: d.temps?.socHotspot ?? null,
        socAvg: d.temps?.socAvg ?? null,
        fan: d.temps?.fan?.rpm ?? null,
        powerSystem: d.temps?.power?.system ?? null,
        netDown: iface?.rx_sec ?? 0,
        netUp: iface?.tx_sec ?? 0,
        sessionRxGB: d.network?.session?.rx ?? 0,
        sessionTxGB: d.network?.session?.tx ?? 0,
        dockerRunning: containers.filter(c => c.state === 'running').length,
        dockerTotal: containers.length,
      });
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, []);

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  useEffect(() => {
    if (!isLocal) return;
    fetch_();
    const t = setInterval(fetch_, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetch_, isLocal]);

  const cpuColor = stats ? (stats.cpu > 80 ? 'var(--danger)' : stats.cpu > 50 ? 'var(--warning)' : '#7c3aed') : '#7c3aed';
  const ramColor = stats ? (stats.ramPct > 85 ? 'var(--danger)' : stats.ramPct > 65 ? 'var(--warning)' : 'var(--accent-secondary)') : 'var(--accent-secondary)';

  return (
    <WidgetWrapper widgetId="macstats" title="Mac Stats" icon={<Monitor size={16} />}>
      <div className="macstats-widget">

        {!isLocal && (
          <div className="macstats-connecting">
            <Monitor size={18} style={{ opacity: 0.4 }} />
            <span>Mac Stats ist nur lokal verfügbar.<br />Öffne <strong>localhost:5173</strong> auf deinem Mac.</span>
          </div>
        )}

        {isLocal && status === 'loading' && (
          <div className="macstats-connecting">
            <RefreshCw size={18} className="spin" />
            <span>Verbinde mit localhost:7777…</span>
          </div>
        )}

        {isLocal && status === 'error' && (
          <div className="macstats-connecting macstats-error">
            <AlertCircle size={18} />
            <span>Server nicht erreichbar — <code>node projekte/mac-dashboard/src/server.js</code></span>
          </div>
        )}

        {isLocal && status === 'ok' && stats && (
          <>
            {/* CPU + RAM Rings */}
            <div className="macstats-rings">
              <div className="macstats-ring-item">
                <div className="macstats-ring-wrap">
                  <Ring pct={stats.cpu} color={cpuColor} />
                  <span className="macstats-ring-val" style={{ color: cpuColor }}>{stats.cpu}%</span>
                </div>
                <span className="macstats-ring-label"><Cpu size={11} /> CPU</span>
              </div>
              <div className="macstats-ring-item">
                <div className="macstats-ring-wrap">
                  <Ring pct={stats.ramPct} color={ramColor} />
                  <span className="macstats-ring-val" style={{ color: ramColor }}>{stats.ramPct}%</span>
                </div>
                <span className="macstats-ring-label"><MemoryStick size={11} /> RAM {fmtGB(stats.ramUsedGB)}/{fmtGB(stats.ramTotalGB)} GB</span>
              </div>
            </div>

            <div className="macstats-divider" />

            {/* Temps */}
            <div className="macstats-section-label"><Thermometer size={12} /> Temperaturen</div>
            <div className="macstats-temps">
              {stats.gpu !== null && (
                <div className="macstats-temp-item">
                  <span className="macstats-temp-name">GPU</span>
                  <span className="macstats-temp-val" style={{ color: tempColor(stats.gpu) }}>{stats.gpu.toFixed(0)}°</span>
                </div>
              )}
              {stats.socHotspot !== null && (
                <div className="macstats-temp-item">
                  <span className="macstats-temp-name">SOC Peak</span>
                  <span className="macstats-temp-val" style={{ color: tempColor(stats.socHotspot) }}>{stats.socHotspot.toFixed(0)}°</span>
                </div>
              )}
              {stats.socAvg !== null && (
                <div className="macstats-temp-item">
                  <span className="macstats-temp-name">SOC Avg</span>
                  <span className="macstats-temp-val" style={{ color: tempColor(stats.socAvg) }}>{stats.socAvg.toFixed(0)}°</span>
                </div>
              )}
              {stats.fan !== null && (
                <div className="macstats-temp-item">
                  <span className="macstats-temp-name">Fan</span>
                  <span className="macstats-temp-val" style={{ color: 'var(--text-secondary)' }}>{stats.fan} RPM</span>
                </div>
              )}
              {stats.powerSystem !== null && (
                <div className="macstats-temp-item">
                  <span className="macstats-temp-name"><Zap size={10} /> Leistung</span>
                  <span className="macstats-temp-val" style={{ color: 'var(--warning)' }}>{stats.powerSystem.toFixed(0)} W</span>
                </div>
              )}
            </div>

            <div className="macstats-divider" />

            {/* Network */}
            <div className="macstats-section-label"><Wifi size={12} /> Netzwerk</div>
            <div className="macstats-net">
              <div className="macstats-net-row">
                <span className="macstats-net-arrow down">▼</span>
                <span className="macstats-net-speed">{fmt(stats.netDown)}</span>
                <span className="macstats-net-session">Session: {fmtGB(stats.sessionRxGB)} GB</span>
              </div>
              <div className="macstats-net-row">
                <span className="macstats-net-arrow up">▲</span>
                <span className="macstats-net-speed">{fmt(stats.netUp)}</span>
                <span className="macstats-net-session">Session: {fmtGB(stats.sessionTxGB)} GB</span>
              </div>
            </div>

            <div className="macstats-divider" />

            {/* Docker */}
            <div className="macstats-docker">
              <Container size={12} />
              <span className="macstats-docker-label">Docker</span>
              <span className="macstats-docker-count" style={{ color: stats.dockerRunning > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                {stats.dockerRunning}/{stats.dockerTotal} running
              </span>
            </div>
          </>
        )}
      </div>
    </WidgetWrapper>
  );
}
