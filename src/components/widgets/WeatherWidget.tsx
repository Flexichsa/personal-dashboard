import { useState, useEffect, useCallback } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';

interface WeatherPrefs { id: string; city: string; }

interface CurrentWeather {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  wind_dir: number;
  pressure: number;
  weather_code: number;
  city: string;
}

interface DailyForecast {
  date: string;
  weekday: string;
  weather_code: number;
  temp_max: number;
  temp_min: number;
  precip_prob: number;
  uv_index: number;
}

// ── WMO helpers ───────────────────────────────────────────────────────────────

type WxType = 'sun' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder';

function wxType(code: number): WxType {
  if (code === 0) return 'sun';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain';
  if (code <= 86) return 'snow';
  return 'thunder';
}

function wxDesc(code: number): string {
  if (code === 0) return 'Klarer Himmel';
  if (code === 1) return 'Überwiegend klar';
  if (code === 2) return 'Teilweise bewölkt';
  if (code === 3) return 'Bedeckt';
  if (code <= 48) return 'Nebelig';
  if (code <= 57) return 'Nieselregen';
  if (code <= 67) return 'Regen';
  if (code <= 77) return 'Schnee';
  if (code <= 82) return 'Regenschauer';
  if (code <= 86) return 'Schneeschauer';
  return 'Gewitter';
}

const COMPASS = ['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function windCompass(deg: number) { return COMPASS[Math.round(deg / 22.5) % 16]; }

function fmtSunTime(iso: string) { return iso ? iso.slice(11, 16) : '--:--'; }

// ── Background gradients ──────────────────────────────────────────────────────

const BG: Record<WxType, string> = {
  sun:     'linear-gradient(155deg, #0c2d50 0%, #1a4a7a 35%, #c44b0d 80%, #f97316 100%)',
  partly:  'linear-gradient(155deg, #0f3460 0%, #1a4a75 45%, #b85c38 100%)',
  cloud:   'linear-gradient(155deg, #162538 0%, #253f5a 55%, #3a5a7a 100%)',
  fog:     'linear-gradient(155deg, #252f3e 0%, #3d4f61 55%, #607080 100%)',
  drizzle: 'linear-gradient(155deg, #152030 0%, #263d55 55%, #3a5570 100%)',
  rain:    'linear-gradient(155deg, #0d1b2a 0%, #192d40 40%, #283f55 100%)',
  snow:    'linear-gradient(155deg, #1a2840 0%, #2d4055 40%, #7a90a0 100%)',
  thunder: 'linear-gradient(155deg, #0a0e18 0%, #161e2e 50%, #252e3f 100%)',
};

// ── Animated particles ────────────────────────────────────────────────────────

function Particles({ type }: { type: WxType }) {
  if (type === 'rain' || type === 'drizzle') {
    return (
      <div className="wx-particles" aria-hidden="true">
        {Array.from({ length: 22 }).map((_, i) => (
          <div
            key={i}
            className="wx-raindrop"
            style={{
              left: `${(i * 4.2 + 3) % 96}%`,
              animationDelay: `${(i * 0.11) % 1.3}s`,
              animationDuration: `${0.55 + (i * 0.06) % 0.5}s`,
              width: type === 'drizzle' ? '1px' : '1.5px',
              height: type === 'drizzle' ? '8px' : '14px',
              opacity: 0.35 + (i % 3) * 0.18,
            }}
          />
        ))}
      </div>
    );
  }
  if (type === 'snow') {
    return (
      <div className="wx-particles" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="wx-snowflake"
            style={{
              left: `${(i * 5.1 + 2) % 94}%`,
              animationDelay: `${(i * 0.35) % 3.5}s`,
              animationDuration: `${3.5 + (i % 5)}s`,
              fontSize: `${8 + (i % 4) * 3}px`,
              opacity: 0.55 + (i % 3) * 0.15,
            }}
          >
            {i % 2 === 0 ? '❄' : '❅'}
          </div>
        ))}
      </div>
    );
  }
  if (type === 'thunder') {
    return (
      <div className="wx-particles" aria-hidden="true">
        <div className="wx-lightning-flash" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="wx-raindrop wx-raindrop-heavy"
            style={{
              left: `${(i * 9.5 + 3) % 93}%`,
              animationDelay: `${(i * 0.09) % 0.7}s`,
              animationDuration: `${0.38 + (i % 3) * 0.08}s`,
              height: '18px', width: '1.5px', opacity: 0.5,
            }}
          />
        ))}
      </div>
    );
  }
  if (type === 'sun') {
    return (
      <div className="wx-particles" aria-hidden="true">
        <div className="wx-sun-glow-bg" />
      </div>
    );
  }
  if (type === 'fog') {
    return (
      <div className="wx-particles" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="wx-fog-particle"
            style={{
              top: `${6 + i * 12}%`,
              width: `${50 + (i * 19) % 38}%`,
              height: `${26 + (i % 4) * 9}px`,
              animationDelay: `${i * 1.15}s`,
              animationDuration: `${9 + i * 1.4}s`,
            }}
          />
        ))}
      </div>
    );
  }
  if (type === 'cloud' || type === 'partly') {
    return (
      <div className="wx-particles" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="wx-cloud-puff"
            style={{
              top: `${8 + i * 16}%`,
              animationDelay: `${i * 0.85}s`,
              animationDuration: `${5 + i * 0.9}s`,
            }}
          />
        ))}
      </div>
    );
  }
  return null;
}

// ── Large animated icon ───────────────────────────────────────────────────────

function BigIcon({ type }: { type: WxType }) {
  switch (type) {
    case 'sun':
      return (
        <div className="wx-bigicon wx-bigicon-sun">
          <div className="wx-sun-core" />
          {[0,45,90,135,180,225,270,315].map((a, i) => (
            <div key={i} className="wx-sun-ray" style={{ transform: `rotate(${a}deg) translateY(-44px)` }} />
          ))}
        </div>
      );
    case 'partly':
      return (
        <div className="wx-bigicon wx-bigicon-partly">
          <div className="wx-sun-core wx-sun-sm" />
          {[0,60,120,180,240,300].map((a, i) => (
            <div key={i} className="wx-sun-ray wx-sun-ray-sm" style={{ transform: `rotate(${a}deg) translateY(-30px)` }} />
          ))}
          <div className="wx-cloud-shape wx-cloud-front" />
        </div>
      );
    case 'rain':
    case 'drizzle':
      return (
        <div className="wx-bigicon wx-bigicon-rain">
          <div className="wx-cloud-shape" />
          <div className="wx-icon-drops">
            {[0,1,2,3,4].map(i => <div key={i} className={`wx-icon-drop wx-icon-drop-${i}`} />)}
          </div>
        </div>
      );
    case 'snow':
      return (
        <div className="wx-bigicon wx-bigicon-snow">
          <div className="wx-cloud-shape" />
          <div className="wx-icon-drops">
            {[0,1,2,3,4].map(i => <div key={i} className={`wx-icon-snowdot wx-icon-snowdot-${i}`}>❄</div>)}
          </div>
        </div>
      );
    case 'thunder':
      return (
        <div className="wx-bigicon wx-bigicon-thunder">
          <div className="wx-cloud-shape wx-cloud-dark" />
          <div className="wx-bolt-icon">⚡</div>
        </div>
      );
    case 'fog':
      return (
        <div className="wx-bigicon wx-bigicon-fog">
          {[0,1,2,3].map(i => <div key={i} className={`wx-fog-bar wx-fog-bar-${i}`} />)}
        </div>
      );
    default:
      return (
        <div className="wx-bigicon wx-bigicon-cloud">
          <div className="wx-cloud-shape" />
        </div>
      );
  }
}

// ── Mini emoji icon for forecast ──────────────────────────────────────────────

function MiniIcon({ type }: { type: WxType }) {
  const icons: Record<WxType, string> = {
    sun: '☀️', partly: '⛅', cloud: '☁️',
    fog: '🌫️', drizzle: '🌦️', rain: '🌧️',
    snow: '❄️', thunder: '⛈️',
  };
  return <span className="wx-mini-icon">{icons[type]}</span>;
}

// ── Live clock hook ───────────────────────────────────────────────────────────

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const WDAYS  = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

// ── Main component ────────────────────────────────────────────────────────────

export default function WeatherWidget() {
  const [prefsArr, setPrefsArr] = useSupabase<WeatherPrefs>(
    'weather-prefs',
    [{ id: 'weather-settings', city: 'Zürich' }]
  );
  const prefs = prefsArr[0] || { id: 'weather-settings', city: 'Zürich' };
  const city = prefs.city;
  const setCity = (c: string) => setPrefsArr([{ ...prefs, city: c }]);

  const [current, setCurrent]   = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [sunTimes, setSunTimes] = useState<{ rise: string; set: string } | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(false);
  const [editCity, setEditCity] = useState(false);
  const [cityInput, setCityInput] = useState(city);
  const now = useClock();

  const fetchWeather = useCallback(async (cityName: string) => {
    setLoading(true);
    setError(false);
    try {
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=de`,
        { signal: AbortSignal.timeout(8000) }
      ).then(r => r.json());
      if (!geo.results?.[0]) throw new Error('City not found');

      const { latitude, longitude, name } = geo.results[0];

      const wx = await fetch(
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_mean,sunrise,sunset,uv_index_max` +
        `&timezone=auto&forecast_days=7`,
        { signal: AbortSignal.timeout(10000) }
      ).then(r => r.json());

      setCurrent({
        temp:         Math.round(wx.current.temperature_2m),
        feels_like:   Math.round(wx.current.apparent_temperature),
        humidity:     wx.current.relative_humidity_2m,
        wind_speed:   Math.round(wx.current.wind_speed_10m),
        wind_dir:     Math.round(wx.current.wind_direction_10m ?? 0),
        pressure:     Math.round(wx.current.surface_pressure ?? 1013),
        weather_code: wx.current.weather_code,
        city: name,
      });

      setSunTimes({
        rise: fmtSunTime(wx.daily.sunrise?.[0] ?? ''),
        set:  fmtSunTime(wx.daily.sunset?.[0]  ?? ''),
      });

      const days = ['So','Mo','Di','Mi','Do','Fr','Sa'];
      setForecast((wx.daily.time as string[]).map((d, i) => ({
        date:       d,
        weekday:    i === 0 ? 'Heute' : i === 1 ? 'Morgen' : days[new Date(d).getDay()],
        weather_code: wx.daily.weather_code[i],
        temp_max:   Math.round(wx.daily.temperature_2m_max[i]),
        temp_min:   Math.round(wx.daily.temperature_2m_min[i]),
        precip_prob: Math.round(wx.daily.precipitation_probability_mean?.[i] ?? 0),
        uv_index:   Math.round(wx.daily.uv_index_max?.[i] ?? 0),
      })));
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchWeather(city); }, [city, fetchWeather]);

  const type = current ? wxType(current.weather_code) : 'cloud';
  const bg   = BG[type];

  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const dateStr = `${WDAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <WidgetWrapper
      widgetId="weather"
      title="Wetter"
      icon={<MapPin size={16} />}
      style={{ '--wx-bg': bg } as React.CSSProperties}
    >
      <div className="wx-widget">

        {/* Animated background particles */}
        <Particles type={type} />

        {/* All content sits above particles */}
        <div className="wx-layer">

          {/* ── HEADER ─────────────────────────────────── */}
          <div className="wx-header">
            <div className="wx-header-left">
              <button
                className="wx-city-btn"
                onClick={() => { setEditCity(true); setCityInput(city); }}
                title="Stadt ändern"
              >
                <MapPin size={10} />
                <span>{current?.city || city}</span>
              </button>
              <div className="wx-date">{dateStr}</div>
            </div>
            <div className="wx-header-right">
              {current && (
                <div className="wx-header-stats">
                  <span>💧 {current.humidity}%</span>
                  <span>🌡 {current.pressure} hPa</span>
                </div>
              )}
              {sunTimes && (
                <div className="wx-header-stats">
                  <span>🌅 {sunTimes.rise}</span>
                  <span>🌇 {sunTimes.set}</span>
                </div>
              )}
              <button
                className="wx-refresh"
                onClick={() => fetchWeather(city)}
                disabled={loading}
                title="Aktualisieren"
              >
                <RefreshCw size={11} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {/* ── LOADING / ERROR ────────────────────────── */}
          {loading && !current && (
            <div className="wx-state">
              <RefreshCw size={30} className="spin" />
              <span>Lade Wetterdaten…</span>
            </div>
          )}
          {error && !current && (
            <div className="wx-state">
              <span style={{ fontSize: 30 }}>🌫</span>
              <p>Wetter nicht verfügbar</p>
              <button className="wx-retry" onClick={() => fetchWeather(city)}>Erneut versuchen</button>
            </div>
          )}

          {/* ── MAIN AREA ──────────────────────────────── */}
          {current && (
            <div className="wx-main">
              {/* Left: animated icon */}
              <div className="wx-left">
                <BigIcon type={type} />
              </div>

              {/* Right: time + temp + details */}
              <div className="wx-right">
                <div className="wx-clock">{timeStr}</div>
                <div className="wx-temp">
                  {current.temp}°<span className="wx-unit">C</span>
                </div>
                <div className="wx-desc-text">{wxDesc(current.weather_code)}</div>
                <div className="wx-feels">Gefühlt: {current.feels_like}°C</div>
                <div className="wx-wind-row">
                  <span>💨 {current.wind_speed} km/h {windCompass(current.wind_dir)}</span>
                  {forecast[0]?.uv_index !== undefined && (
                    <span>UV: {forecast[0].uv_index}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── FORECAST STRIP ─────────────────────────── */}
          {forecast.length > 0 && (
            <div className="wx-forecast">
              {forecast.map((day, i) => (
                <div
                  key={day.date}
                  className={`wx-fday${i === 0 ? ' wx-fday-today' : ''}`}
                >
                  <div className="wx-fday-name">{day.weekday}</div>
                  <MiniIcon type={wxType(day.weather_code)} />
                  <div className="wx-fday-temps">
                    <span className="wx-fday-hi">{day.temp_max}°</span>
                    <span className="wx-fday-lo">/{day.temp_min}°</span>
                  </div>
                  {day.precip_prob > 10 && (
                    <div className="wx-fday-rain">💧{day.precip_prob}%</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── CITY EDIT OVERLAY ─────────────────────── */}
        {editCity && (
          <div className="wx-edit-overlay">
            <div className="wx-edit-box">
              <input
                className="wx-edit-input"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                placeholder="Stadt eingeben…"
                onKeyDown={e => {
                  if (e.key === 'Enter' && cityInput.trim()) { setCity(cityInput.trim()); setEditCity(false); }
                  if (e.key === 'Escape') setEditCity(false);
                }}
                autoFocus
              />
              <button
                className="wx-edit-ok"
                onClick={() => { if (cityInput.trim()) { setCity(cityInput.trim()); setEditCity(false); } }}
              >OK</button>
              <button className="wx-edit-cancel" onClick={() => setEditCity(false)}>✕</button>
            </div>
          </div>
        )}

      </div>
    </WidgetWrapper>
  );
}
