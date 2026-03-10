import { useState, useRef } from 'react';
import WidgetWrapper from '../WidgetWrapper';
import { Monitor, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';

const MAC_DASHBOARD_URL = 'http://localhost:7777';

export default function MacDashboardWidget() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const reload = () => {
    setStatus('loading');
    if (iframeRef.current) {
      iframeRef.current.src = MAC_DASHBOARD_URL;
    }
  };

  return (
    <WidgetWrapper widgetId="macdashboard" title="Mac Dashboard" icon={<Monitor size={16} />}>
      <div className="mac-dashboard-frame">

        {/* Toolbar */}
        <div className="mac-dashboard-toolbar">
          <span className="mac-dashboard-url">{MAC_DASHBOARD_URL}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="btn-icon-sm"
              onClick={reload}
              title="Neu laden"
            >
              <RefreshCw size={13} />
            </button>
            <a
              href={MAC_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-icon-sm"
              title="Im neuen Tab öffnen"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* iframe */}
        <div className="mac-dashboard-iframe-wrap">
          <iframe
            ref={iframeRef}
            src={MAC_DASHBOARD_URL}
            title="Mac Dashboard"
            className="mac-dashboard-iframe"
            onLoad={() => setStatus('ok')}
            onError={() => setStatus('error')}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />

          {/* Loading overlay */}
          {status === 'loading' && (
            <div className="mac-dashboard-overlay">
              <div className="mac-dashboard-spinner" />
              <span>Verbinde mit localhost:7777…</span>
            </div>
          )}

          {/* Error overlay */}
          {status === 'error' && (
            <div className="mac-dashboard-overlay mac-dashboard-error">
              <AlertCircle size={32} style={{ opacity: 0.5 }} />
              <strong>Server nicht erreichbar</strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Starte den Mac Dashboard Server:<br />
                <code style={{ fontSize: 11 }}>node projekte/mac-dashboard/src/server.js</code>
              </span>
              <button className="btn-secondary btn-sm" onClick={reload}>
                <RefreshCw size={12} /> Nochmal versuchen
              </button>
            </div>
          )}
        </div>
      </div>
    </WidgetWrapper>
  );
}
