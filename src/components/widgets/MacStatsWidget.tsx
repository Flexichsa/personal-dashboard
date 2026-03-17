import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Monitor, Cpu, MemoryStick, Thermometer, Wifi, Container,
  RefreshCw, AlertCircle, Zap, HardDrive, Battery, BatteryCharging,
  Activity, Server, ChevronRight,
} from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';

const API_DASHBOARD = 'http://localhost:7777/api/dashboard';
const API_SYSTEM    = 'http://localhost:7777/api/system';
const REFRESH_MS    = 4000;

// ─── Typen ───────────────────────────────────────────────────────────────────

interface TopProc {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  memRss?: number;
}

interface MacStats {
  // Ringe
  cpu: number;
  cpuFreq: number;
  ramPct: number;
  ramUsedGB: number;
  ramTotalGB: number;
  diskPct: number;
  diskUsedGB: number;
  diskTotalGB: number;
  // Temps
  cpuTemp: number | null;
  gpu: number | null;
  socHotspot: number | null;
  socAvg: number | null;
  fan: number | null;
  powerSystem: number | null;
  powerCpu: number | null;
  // Netzwerk
  netDown: number;
  netUp: number;
  sessionRxGB: number;
  sessionTxGB: number;
  lifetimeRxGB: number;
  lifetimeTxGB: number;
  // Docker
  dockerRunning: number;
  dockerTotal: number;
  // Prozesse
  procAll: number;
  procRunning: number;
  procBlocked: number;
  procSleeping: number;
  topCpu: TopProc[];
  // Batterie
  hasBattery: boolean;
  batteryPct: number;
  batteryCharging: boolean;
  batteryTime: number | null;   // Minuten
  // System
  cpuBrand: string;
  uptimeSec: number;
  cores: number;
  physicalCores: number;
  // Disk IO
  diskReadSec: number;
  diskWriteSec: number;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function fmt(bytes_per_sec: number): string {
  if (bytes_per_sec >= 1024 * 1024) return (bytes_per_sec / 1024 / 1024).toFixed(1) + ' MB/s';
  if (bytes_per_sec >= 1024) return (bytes_per_sec / 1024).toFixed(0) + ' KB/s';
  return bytes_per_sec.toFixed(0) + ' B/s';
}

function fmtGB(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(1);
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtBatteryTime(min: number | null): string {
  if (min === null || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function tempColor(t: number | null): string {
  if (t === null) return 'var(--text-muted)';
  if (t >= 80) return 'var(--danger)';
  if (t >= 65) return 'var(--warning)';
  return 'var(--success)';
}

function diskColor(pct: number): string {
  if (pct >= 90) return 'var(--danger)';
  if (pct >= 75) return 'var(--warning)';
  return '#f97316';
}

function batteryColor(pct: number): string {
  if (pct <= 20) return 'var(--danger)';
  if (pct <= 50) return 'var(--warning)';
  return 'var(--success)';
}

// ─── Ring-Komponente ──────────────────────────────────────────────────────────

function Ring({ pct, color, size = 50, stroke = 4.5 }: { pct: number; color: string; size?: number; stroke?: number }) {
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

// ─── Mini Progress Bar ────────────────────────────────────────────────────────

function MiniBar({ pct, color, width = 60 }: { pct: number; color: string; width?: number }) {
  return (
    <div style={{
      width, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.min(pct, 100)}%`, height: '100%',
        background: color, borderRadius: 2,
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'processes' | 'network' | 'system';

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function MacStatsWidget() {
  const [stats, setStats] = useState<MacStats | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>('overview');
  const systemCacheRef = useRef<{ brand: string; cores: number; physicalCores: number; uptimeBase: number } | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      // Dashboard-Daten immer aktuell holen
      const res = await fetch(API_DASHBOARD, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error();
      const d = await res.json();

      // System-Info: nur beim ersten Mal laden (gecacht)
      if (!systemCacheRef.current) {
        try {
          const sr = await fetch(API_SYSTEM, { signal: AbortSignal.timeout(3000) });
          if (sr.ok) {
            const sd = await sr.json();
            systemCacheRef.current = {
              brand: sd.cpu?.brand ?? '',
              cores: sd.cpu?.cores ?? 0,
              physicalCores: sd.cpu?.physicalCores ?? 0,
              uptimeBase: sd.time?.uptime ?? 0,
            };
          }
        } catch { /* ignorieren, bleibt null */ }
      }

      const sc = systemCacheRef.current;

      // RAM
      const memUsed = d.mem?.active ?? 0;
      const memTotal = d.mem?.total ?? 1;

      // Netzwerk
      const iface = d.network?.interfaces?.[0];

      // Docker
      const containers: { state: string }[] = d.docker?.containers ?? [];

      // Disk: root FS
      const rootFS = (d.disk?.fs ?? []).find((f: { mount: string }) => f.mount === '/');
      const diskTotal = rootFS?.size ?? 1;
      const diskFree = rootFS?.available ?? diskTotal;
      const diskUsedBytes = diskTotal - diskFree;
      const diskPct = Math.round((diskUsedBytes / diskTotal) * 100);

      // Prozesse
      const procs = d.processes ?? {};
      const topCpu: TopProc[] = (procs.topCpu ?? []).slice(0, 5);

      // Batterie
      const bat = d.battery ?? {};

      // Disk IO
      const io = d.disk?.io;

      setStats({
        cpu: Math.round(d.cpu?.load?.currentLoad ?? 0),
        cpuFreq: d.cpu?.speed?.avg ?? 0,
        ramPct: Math.round((memUsed / memTotal) * 100),
        ramUsedGB: memUsed,
        ramTotalGB: memTotal,
        diskPct,
        diskUsedGB: diskUsedBytes,
        diskTotalGB: diskTotal,
        cpuTemp: d.temps?.cpu ?? null,
        gpu: d.temps?.gpu ?? null,
        socHotspot: d.temps?.socHotspot ?? null,
        socAvg: d.temps?.socAvg ?? null,
        fan: d.temps?.fan?.rpm ?? null,
        powerSystem: d.temps?.power?.system ?? null,
        powerCpu: d.temps?.power?.cpu ?? null,
        netDown: iface?.rx_sec ?? 0,
        netUp: iface?.tx_sec ?? 0,
        sessionRxGB: d.network?.session?.rx ?? 0,
        sessionTxGB: d.network?.session?.tx ?? 0,
        lifetimeRxGB: d.network?.lifetime?.rx ?? 0,
        lifetimeTxGB: d.network?.lifetime?.tx ?? 0,
        dockerRunning: containers.filter(c => c.state === 'running').length,
        dockerTotal: containers.length,
        procAll: procs.all ?? 0,
        procRunning: procs.running ?? 0,
        procBlocked: procs.blocked ?? 0,
        procSleeping: procs.sleeping ?? 0,
        topCpu,
        hasBattery: bat.hasBattery ?? false,
        batteryPct: bat.percent ?? 0,
        batteryCharging: bat.isCharging ?? false,
        batteryTime: bat.timeRemaining ?? null,
        cpuBrand: sc?.brand ?? '',
        uptimeSec: sc?.uptimeBase ?? 0,
        cores: sc?.cores ?? 0,
        physicalCores: sc?.physicalCores ?? 0,
        diskReadSec: io?.rIO_sec ?? 0,
        diskWriteSec: io?.wIO_sec ?? 0,
      });
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    fetch_();
    const t = setInterval(fetch_, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetch_]);

  const cpuColor = stats ? (stats.cpu > 80 ? 'var(--danger)' : stats.cpu > 50 ? 'var(--warning)' : '#7c3aed') : '#7c3aed';
  const ramColor = stats ? (stats.ramPct > 85 ? 'var(--danger)' : stats.ramPct > 65 ? 'var(--warning)' : 'var(--accent-secondary)') : 'var(--accent-secondary)';

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'processes', label: 'Prozesse' },
    { id: 'network',   label: 'Netzwerk' },
    { id: 'system',    label: 'System' },
  ];

  return (
    <WidgetWrapper widgetId="macstats" title="Mac Stats" icon={<Monitor size={16} />}>
      <div className="macstats-widget">

        {status === 'loading' && (
          <div className="macstats-connecting">
            <RefreshCw size={18} className="spin" />
            <span>Verbinde mit localhost:7777…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="macstats-connecting macstats-error">
            <AlertCircle size={18} />
            <span>Server nicht erreichbar — <code>node projekte/mac-dashboard/src/server.js</code></span>
          </div>
        )}

        {status === 'ok' && stats && (
          <>
            {/* ── System Info Bar ── */}
            {stats.cpuBrand && (
              <div className="macstats-sysbar">
                <span className="macstats-sysbar-brand">{stats.cpuBrand}</span>
                {stats.cores > 0 && (
                  <span className="macstats-sysbar-chip">
                    {stats.physicalCores > 0 ? `${stats.physicalCores}C` : `${stats.cores}C`}
                  </span>
                )}
                {stats.uptimeSec > 0 && (
                  <span className="macstats-sysbar-uptime">
                    <Activity size={10} /> {fmtUptime(stats.uptimeSec)}
                  </span>
                )}
              </div>
            )}

            {/* ── Batterie (nur wenn vorhanden) ── */}
            {stats.hasBattery && (
              <div className="macstats-battery">
                <div className="macstats-battery-icon">
                  {stats.batteryCharging
                    ? <BatteryCharging size={16} style={{ color: 'var(--success)' }} />
                    : <Battery size={16} style={{ color: batteryColor(stats.batteryPct) }} />
                  }
                </div>
                <div className="macstats-battery-bar-wrap">
                  <div className="macstats-battery-bar-bg">
                    <div
                      className={stats.batteryCharging ? 'macstats-battery-fill charging' : 'macstats-battery-fill'}
                      style={{
                        width: `${stats.batteryPct}%`,
                        background: batteryColor(stats.batteryPct),
                      }}
                    />
                  </div>
                </div>
                <span className="macstats-battery-pct" style={{ color: batteryColor(stats.batteryPct) }}>
                  {stats.batteryPct}%
                </span>
                {fmtBatteryTime(stats.batteryTime) && (
                  <span className="macstats-battery-time">{fmtBatteryTime(stats.batteryTime)}</span>
                )}
                {stats.batteryCharging && (
                  <span className="macstats-battery-charging">Laden</span>
                )}
              </div>
            )}

            {/* ── Tabs ── */}
            <div className="macstats-tabs">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`macstats-tab${tab === t.id ? ' active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ══════════════════════ TAB: OVERVIEW ══════════════════════ */}
            {tab === 'overview' && (
              <>
                {/* CPU + RAM + Disk Rings */}
                <div className="macstats-rings">
                  <div className="macstats-ring-item">
                    <div className="macstats-ring-wrap">
                      <Ring pct={stats.cpu} color={cpuColor} />
                      <span className="macstats-ring-val" style={{ color: cpuColor }}>{stats.cpu}%</span>
                    </div>
                    <span className="macstats-ring-label"><Cpu size={11} /> CPU</span>
                    {stats.cpuFreq > 0 && <span className="macstats-ring-sub">{stats.cpuFreq.toFixed(1)} GHz</span>}
                  </div>
                  <div className="macstats-ring-item">
                    <div className="macstats-ring-wrap">
                      <Ring pct={stats.ramPct} color={ramColor} />
                      <span className="macstats-ring-val" style={{ color: ramColor }}>{stats.ramPct}%</span>
                    </div>
                    <span className="macstats-ring-label"><MemoryStick size={11} /> RAM</span>
                    <span className="macstats-ring-sub">{fmtGB(stats.ramUsedGB)}/{fmtGB(stats.ramTotalGB)} GB</span>
                  </div>
                  <div className="macstats-ring-item">
                    <div className="macstats-ring-wrap">
                      <Ring pct={stats.diskPct} color={diskColor(stats.diskPct)} />
                      <span className="macstats-ring-val" style={{ color: diskColor(stats.diskPct) }}>{stats.diskPct}%</span>
                    </div>
                    <span className="macstats-ring-label"><HardDrive size={11} /> Disk</span>
                    <span className="macstats-ring-sub">{fmtGB(stats.diskUsedGB)}/{fmtGB(stats.diskTotalGB)} GB</span>
                  </div>
                </div>

                {/* Disk IO */}
                {(stats.diskReadSec > 0 || stats.diskWriteSec > 0) && (
                  <div className="macstats-diskio">
                    <span className="macstats-diskio-item">
                      <span className="macstats-diskio-arrow">R</span>
                      <span className="macstats-diskio-val">{fmt(stats.diskReadSec)}</span>
                    </span>
                    <span className="macstats-diskio-sep" />
                    <span className="macstats-diskio-item">
                      <span className="macstats-diskio-arrow">W</span>
                      <span className="macstats-diskio-val">{fmt(stats.diskWriteSec)}</span>
                    </span>
                  </div>
                )}

                <div className="macstats-divider" />

                {/* Temps */}
                <div className="macstats-section-label"><Thermometer size={12} /> Temperaturen</div>
                <div className="macstats-temps">
                  {stats.cpuTemp !== null && (
                    <div className="macstats-temp-item">
                      <span className="macstats-temp-name">CPU</span>
                      <span className="macstats-temp-val" style={{ color: tempColor(stats.cpuTemp) }}>{stats.cpuTemp.toFixed(0)}°</span>
                    </div>
                  )}
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
                      <span className="macstats-temp-name"><Zap size={10} /> Gesamt</span>
                      <span className="macstats-temp-val" style={{ color: 'var(--warning)' }}>{stats.powerSystem.toFixed(0)} W</span>
                    </div>
                  )}
                  {stats.powerCpu !== null && (
                    <div className="macstats-temp-item">
                      <span className="macstats-temp-name"><Zap size={10} /> CPU</span>
                      <span className="macstats-temp-val" style={{ color: 'var(--warning)' }}>{stats.powerCpu.toFixed(0)} W</span>
                    </div>
                  )}
                </div>

                <div className="macstats-divider" />

                {/* Prozess-Übersicht kompakt */}
                <div className="macstats-proc-summary">
                  <Server size={11} />
                  <span>
                    {stats.procAll} Prozesse
                    {stats.procRunning > 0 && <> (<span style={{ color: 'var(--success)' }}>{stats.procRunning} aktiv</span>)</>}
                    {stats.procBlocked > 0 && <>, <span style={{ color: 'var(--danger)' }}>{stats.procBlocked} blockiert</span></>}
                  </span>
                </div>

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

            {/* ══════════════════════ TAB: PROZESSE ══════════════════════ */}
            {tab === 'processes' && (
              <div className="macstats-procs">
                <div className="macstats-proc-header">
                  <span>Prozess</span>
                  <span>CPU</span>
                  <span>MEM</span>
                </div>
                {stats.topCpu.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>
                    Daten werden geladen…
                  </div>
                )}
                {stats.topCpu.map(p => (
                  <div key={p.pid} className="macstats-proc-row">
                    <div className="macstats-proc-name">
                      <ChevronRight size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span title={p.name}>{p.name}</span>
                    </div>
                    <div className="macstats-proc-cpu">
                      <MiniBar
                        pct={p.cpu}
                        color={p.cpu > 50 ? 'var(--danger)' : p.cpu > 20 ? 'var(--warning)' : '#7c3aed'}
                      />
                      <span>{p.cpu.toFixed(1)}%</span>
                    </div>
                    <div className="macstats-proc-mem">
                      <MiniBar
                        pct={p.mem}
                        color={p.mem > 20 ? 'var(--warning)' : 'var(--accent-secondary)'}
                      />
                      <span>{p.mem.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
                <div className="macstats-proc-footer">
                  {stats.procAll} total · {stats.procRunning} aktiv · {stats.procSleeping} schlafend
                  {stats.procBlocked > 0 && ` · ${stats.procBlocked} blockiert`}
                </div>
              </div>
            )}

            {/* ══════════════════════ TAB: NETZWERK ══════════════════════ */}
            {tab === 'network' && (
              <>
                <div className="macstats-section-label"><Wifi size={12} /> Netzwerk</div>
                <div className="macstats-net">
                  <div className="macstats-net-row">
                    <span className="macstats-net-arrow down">▼</span>
                    <span className="macstats-net-speed">{fmt(stats.netDown)}</span>
                    <span className="macstats-net-session">Session {fmtGB(stats.sessionRxGB)} GB</span>
                  </div>
                  <div className="macstats-net-row">
                    <span className="macstats-net-arrow up">▲</span>
                    <span className="macstats-net-speed">{fmt(stats.netUp)}</span>
                    <span className="macstats-net-session">Session {fmtGB(stats.sessionTxGB)} GB</span>
                  </div>
                  {stats.lifetimeRxGB > 0 && (
                    <div className="macstats-net-lifetime">
                      <span>Lifetime ▼ {fmtGB(stats.lifetimeRxGB)} GB</span>
                      <span>▲ {fmtGB(stats.lifetimeTxGB)} GB</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ══════════════════════ TAB: SYSTEM ══════════════════════ */}
            {tab === 'system' && (
              <div className="macstats-system">
                <div className="macstats-sys-row">
                  <span className="macstats-sys-key">Chip</span>
                  <span className="macstats-sys-val">{stats.cpuBrand || '—'}</span>
                </div>
                <div className="macstats-sys-row">
                  <span className="macstats-sys-key">Kerne</span>
                  <span className="macstats-sys-val">
                    {stats.cores > 0 ? `${stats.cores} (${stats.physicalCores} physisch)` : '—'}
                  </span>
                </div>
                <div className="macstats-sys-row">
                  <span className="macstats-sys-key">Uptime</span>
                  <span className="macstats-sys-val">{stats.uptimeSec > 0 ? fmtUptime(stats.uptimeSec) : '—'}</span>
                </div>
                <div className="macstats-sys-row">
                  <span className="macstats-sys-key">CPU Freq</span>
                  <span className="macstats-sys-val">{stats.cpuFreq > 0 ? `${stats.cpuFreq.toFixed(2)} GHz` : '—'}</span>
                </div>
                <div className="macstats-sys-row">
                  <span className="macstats-sys-key">RAM</span>
                  <span className="macstats-sys-val">{fmtGB(stats.ramUsedGB)} / {fmtGB(stats.ramTotalGB)} GB</span>
                </div>
                <div className="macstats-sys-row">
                  <span className="macstats-sys-key">Disk R/W</span>
                  <span className="macstats-sys-val">{fmt(stats.diskReadSec)} / {fmt(stats.diskWriteSec)}</span>
                </div>
                {stats.hasBattery && (
                  <div className="macstats-sys-row">
                    <span className="macstats-sys-key">Akku</span>
                    <span className="macstats-sys-val" style={{ color: batteryColor(stats.batteryPct) }}>
                      {stats.batteryPct}%{stats.batteryCharging ? ' (Laden)' : ''}
                      {fmtBatteryTime(stats.batteryTime) ? ` · ${fmtBatteryTime(stats.batteryTime)}` : ''}
                    </span>
                  </div>
                )}
                <div className="macstats-sys-row">
                  <span className="macstats-sys-key">Prozesse</span>
                  <span className="macstats-sys-val">{stats.procAll} ({stats.procRunning} aktiv)</span>
                </div>
                <div className="macstats-sys-row">
                  <span className="macstats-sys-key">Docker</span>
                  <span className="macstats-sys-val" style={{ color: stats.dockerRunning > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    {stats.dockerRunning}/{stats.dockerTotal} running
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </WidgetWrapper>
  );
}
