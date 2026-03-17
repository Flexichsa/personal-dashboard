import { useState, useEffect } from 'react';
import { MapPin, RefreshCw, Droplets, Wind, Thermometer } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';

interface WeatherPrefs {
  id: string;
  city: string;
}

interface CurrentWeather {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
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
}

// ── WMO weather code helpers ─────────────────────────────────────────────────

function getWeatherType(code: number): 'sun' | 'cloud' | 'rain' | 'drizzle' | 'snow' | 'thunder' | 'fog' {
  if (code === 0) return 'sun';
  if (code <= 2) return 'cloud';
  if (code === 3) return 'cloud';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain';
  if (code <= 86) return 'snow';
  return 'thunder';
}

function getWeatherDescription(code: number): string {
  if (code === 0) return 'Klarer Himmel';
  if (code === 1) return 'Überwiegend klar';
  if (code === 2) return 'Teilweise bewölkt';
  if (code === 3) return 'Bedeckt';
  if (code <= 48) return 'Nebel';
  if (code <= 55) return 'Nieselregen';
  if (code <= 57) return 'Gefrierender Nieselregen';
  if (code <= 65) return 'Regen';
  if (code <= 67) return 'Gefrierender Regen';
  if (code <= 77) return 'Schnee';
  if (code <= 82) return 'Regenschauer';
  if (code <= 86) return 'Schneeschauer';
  if (code <= 99) return 'Gewitter';
  return 'Unbekannt';
}

// ── Animierte SVG-Icons ───────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="weather-animated-icon weather-icon-sun">
      {/* Glowing ring */}
      <circle cx="28" cy="28" r="24" className="sun-glow-ring" />
      {/* Rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <line
          key={i}
          x1="28" y1="4"
          x2="28" y2="10"
          stroke="#FCD34D"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ transformOrigin: '28px 28px', transform: `rotate(${angle}deg)` }}
          className="sun-ray"
        />
      ))}
      {/* Core */}
      <circle cx="28" cy="28" r="11" fill="#FBBF24" className="sun-core" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="weather-animated-icon weather-icon-cloud">
      <ellipse cx="28" cy="34" rx="18" ry="10" fill="#94A3B8" />
      <circle cx="22" cy="30" r="9" fill="#94A3B8" />
      <circle cx="33" cy="28" r="11" fill="#CBD5E1" />
      <ellipse cx="28" cy="34" rx="18" ry="10" fill="#CBD5E1" />
    </svg>
  );
}

function RainIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="weather-animated-icon weather-icon-rain">
      <ellipse cx="28" cy="22" rx="18" ry="10" fill="#64748B" />
      <circle cx="22" cy="18" r="9" fill="#64748B" />
      <circle cx="33" cy="16" r="11" fill="#94A3B8" />
      <ellipse cx="28" cy="22" rx="18" ry="10" fill="#94A3B8" />
      {/* Drops */}
      <line x1="20" y1="34" x2="18" y2="42" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" className="rain-drop rain-drop-1" />
      <line x1="28" y1="34" x2="26" y2="42" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" className="rain-drop rain-drop-2" />
      <line x1="36" y1="34" x2="34" y2="42" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" className="rain-drop rain-drop-3" />
      <line x1="16" y1="38" x2="14" y2="46" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" className="rain-drop rain-drop-4" />
      <line x1="32" y1="38" x2="30" y2="46" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" className="rain-drop rain-drop-5" />
    </svg>
  );
}

function DrizzleIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="weather-animated-icon weather-icon-rain">
      <ellipse cx="28" cy="22" rx="18" ry="10" fill="#64748B" />
      <circle cx="22" cy="18" r="9" fill="#64748B" />
      <circle cx="33" cy="16" r="11" fill="#94A3B8" />
      <ellipse cx="28" cy="22" rx="18" ry="10" fill="#94A3B8" />
      <line x1="22" y1="33" x2="21" y2="39" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" className="rain-drop rain-drop-1" />
      <line x1="30" y1="35" x2="29" y2="41" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" className="rain-drop rain-drop-3" />
      <line x1="26" y1="38" x2="25" y2="44" stroke="#BFDBFE" strokeWidth="1.5" strokeLinecap="round" className="rain-drop rain-drop-2" />
    </svg>
  );
}

function SnowIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="weather-animated-icon weather-icon-snow">
      <ellipse cx="28" cy="22" rx="18" ry="10" fill="#94A3B8" />
      <circle cx="22" cy="18" r="9" fill="#94A3B8" />
      <circle cx="33" cy="16" r="11" fill="#CBD5E1" />
      <ellipse cx="28" cy="22" rx="18" ry="10" fill="#CBD5E1" />
      {/* Snowflakes */}
      <text x="18" y="42" fontSize="10" fill="#BAE6FD" className="snow-flake snow-flake-1">❄</text>
      <text x="26" y="44" fontSize="8" fill="#E0F2FE" className="snow-flake snow-flake-2">❅</text>
      <text x="34" y="41" fontSize="9" fill="#BAE6FD" className="snow-flake snow-flake-3">❄</text>
    </svg>
  );
}

function ThunderIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="weather-animated-icon weather-icon-thunder">
      <ellipse cx="28" cy="20" rx="20" ry="11" fill="#475569" />
      <circle cx="21" cy="16" r="10" fill="#475569" />
      <circle cx="34" cy="14" r="12" fill="#64748B" />
      <ellipse cx="28" cy="20" rx="20" ry="11" fill="#64748B" />
      {/* Lightning bolt */}
      <polygon
        points="30,28 24,38 29,38 26,48 34,34 28,34"
        fill="#FDE047"
        className="lightning-bolt"
      />
    </svg>
  );
}

function FogIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="weather-animated-icon weather-icon-cloud">
      <rect x="8" y="24" width="40" height="3" rx="1.5" fill="#94A3B8" opacity="0.7" />
      <rect x="12" y="30" width="32" height="3" rx="1.5" fill="#94A3B8" opacity="0.5" />
      <rect x="6" y="18" width="44" height="3" rx="1.5" fill="#CBD5E1" opacity="0.6" />
      <rect x="10" y="36" width="36" height="3" rx="1.5" fill="#94A3B8" opacity="0.4" />
    </svg>
  );
}

function WeatherIcon({ type }: { type: ReturnType<typeof getWeatherType> }) {
  switch (type) {
    case 'sun':     return <SunIcon />;
    case 'rain':    return <RainIcon />;
    case 'drizzle': return <DrizzleIcon />;
    case 'snow':    return <SnowIcon />;
    case 'thunder': return <ThunderIcon />;
    case 'fog':     return <FogIcon />;
    default:        return <CloudIcon />;
  }
}

function SmallWeatherIcon({ type }: { type: ReturnType<typeof getWeatherType> }) {
  switch (type) {
    case 'sun':     return <span className="weather-mini-icon weather-mini-sun">☀</span>;
    case 'rain':    return <span className="weather-mini-icon weather-mini-rain">🌧</span>;
    case 'drizzle': return <span className="weather-mini-icon weather-mini-rain">🌦</span>;
    case 'snow':    return <span className="weather-mini-icon weather-mini-snow">🌨</span>;
    case 'thunder': return <span className="weather-mini-icon weather-mini-thunder">⛈</span>;
    case 'fog':     return <span className="weather-mini-icon">🌫</span>;
    default:        return <span className="weather-mini-icon">☁</span>;
  }
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function WeatherWidget() {
  const [prefsArr, setPrefsArr] = useSupabase<WeatherPrefs>('weather-prefs', [{ id: 'weather-settings', city: 'Berlin' }]);
  const prefs = prefsArr[0] || { id: 'weather-settings', city: 'Berlin' };
  const city = prefs.city;
  const setCity = (newCity: string) => setPrefsArr([{ ...prefs, city: newCity }]);

  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [editCity, setEditCity] = useState(false);
  const [cityInput, setCityInput] = useState(city);

  const fetchWeather = async (cityName: string) => {
    setLoading(true);
    setError(false);
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=de`,
        { signal: AbortSignal.timeout(8000) }
      );
      const geoData = await geoRes.json();

      if (!geoData.results?.[0]) {
        setError(true);
        setLoading(false);
        return;
      }

      const { latitude, longitude, name } = geoData.results[0];
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_mean` +
        `&timezone=auto&forecast_days=7`,
        { signal: AbortSignal.timeout(10000) }
      );
      const data = await weatherRes.json();

      setCurrent({
        temp: Math.round(data.current.temperature_2m),
        feels_like: Math.round(data.current.apparent_temperature),
        humidity: data.current.relative_humidity_2m,
        wind_speed: Math.round(data.current.wind_speed_10m),
        weather_code: data.current.weather_code,
        city: name,
      });

      const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
      const days: DailyForecast[] = data.daily.time.map((dateStr: string, i: number) => {
        const d = new Date(dateStr);
        return {
          date: dateStr,
          weekday: i === 0 ? 'Heute' : i === 1 ? 'Morgen' : weekdays[d.getDay()],
          weather_code: data.daily.weather_code[i],
          temp_max: Math.round(data.daily.temperature_2m_max[i]),
          temp_min: Math.round(data.daily.temperature_2m_min[i]),
          precip_prob: Math.round(data.daily.precipitation_probability_mean[i] ?? 0),
        };
      });
      setForecast(days);
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => { fetchWeather(city); }, [city]);

  const handleCitySubmit = () => {
    if (cityInput.trim()) {
      setCity(cityInput.trim());
      setEditCity(false);
    }
  };

  const weatherType = current ? getWeatherType(current.weather_code) : 'cloud';

  return (
    <WidgetWrapper widgetId="weather" title="Wetter" icon={<MapPin size={16} />}>
      <div className={`weather-widget weather-bg-${weatherType}`}>
        {/* Refresh-Button */}
        <button
          className="btn-icon weather-refresh"
          onClick={() => fetchWeather(city)}
          disabled={loading}
          title="Aktualisieren"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>

        {/* Loading */}
        {loading && !current && (
          <div className="weather-loading">
            <RefreshCw size={28} className="spin" style={{ color: 'var(--color-weather)' }} />
            <span>Wetterdaten laden…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && !current && (
          <div className="weather-error">
            <span style={{ fontSize: 28 }}>🌫</span>
            <p>Wetter konnte nicht geladen werden</p>
            <button className="btn-primary" style={{ marginTop: 4 }} onClick={() => fetchWeather(city)}>
              Erneut versuchen
            </button>
          </div>
        )}

        {/* Hauptinhalt */}
        {current && (
          <>
            {/* Oberer Bereich: Hauptwetter */}
            <div className="weather-hero">
              <div className="weather-icon-animated">
                <WeatherIcon type={weatherType} />
              </div>
              <div className="weather-hero-right">
                <div className="weather-temp">{current.temp}°C</div>
                <div className="weather-desc">{getWeatherDescription(current.weather_code)}</div>
              </div>
            </div>

            {/* Details */}
            <div className="weather-details-row">
              <div className="weather-detail-item">
                <Droplets size={13} />
                <span>{current.humidity}%</span>
              </div>
              <div className="weather-detail-item">
                <Wind size={13} />
                <span>{current.wind_speed} km/h</span>
              </div>
              <div className="weather-detail-item">
                <Thermometer size={13} />
                <span>Gefühlt {current.feels_like}°C</span>
              </div>
            </div>

            {/* 7-Tage Forecast */}
            {forecast.length > 0 && (
              <div className="weather-forecast-scroll">
                {forecast.map((day) => (
                  <div key={day.date} className="weather-forecast-card">
                    <span className="weather-forecast-day">{day.weekday}</span>
                    <SmallWeatherIcon type={getWeatherType(day.weather_code)} />
                    <div className="weather-forecast-temps">
                      <span className="weather-forecast-max">{day.temp_max}°</span>
                      <span className="weather-forecast-min">{day.temp_min}°</span>
                    </div>
                    {day.precip_prob > 0 && (
                      <span className="weather-forecast-precip">
                        💧 {day.precip_prob}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Stadt-Zeile */}
            <div
              className="weather-city"
              onClick={() => { setEditCity(true); setCityInput(city); }}
              title="Stadt ändern"
            >
              <MapPin size={12} />
              <span>{current.city}</span>
            </div>
          </>
        )}

        {/* Stadt-Eingabe */}
        {editCity && (
          <div className="weather-city-form">
            <input
              value={cityInput}
              onChange={e => setCityInput(e.target.value)}
              placeholder="Stadt eingeben"
              onKeyDown={e => {
                if (e.key === 'Enter') handleCitySubmit();
                if (e.key === 'Escape') setEditCity(false);
              }}
              autoFocus
            />
            <button className="btn-primary" onClick={handleCitySubmit}>OK</button>
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}
