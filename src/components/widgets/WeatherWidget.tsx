import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Wind, Droplets, MapPin, RefreshCw } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { useSupabase } from '../../hooks/useSupabase';

interface WeatherPrefs {
  id: string;
  city: string;
}


interface WeatherData {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  description: string;
  icon: string;
  city: string;
}

const WEATHER_ICONS: Record<string, React.ReactNode> = {
  '01': <Sun size={40} />,
  '02': <Cloud size={40} />,
  '03': <Cloud size={40} />,
  '04': <Cloud size={40} />,
  '09': <CloudDrizzle size={40} />,
  '10': <CloudRain size={40} />,
  '11': <CloudLightning size={40} />,
  '13': <CloudSnow size={40} />,
  '50': <Wind size={40} />,
};

export default function WeatherWidget() {
  const [prefsArr, setPrefsArr] = useSupabase<WeatherPrefs>('weather-prefs', [{ id: 'weather-settings', city: 'Berlin' }]);
  const prefs = prefsArr[0] || { id: 'weather-settings', city: 'Berlin' };
  const city = prefs.city;
  const setCity = (newCity: string) => setPrefsArr([{ ...prefs, city: newCity }]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editCity, setEditCity] = useState(false);
  const [cityInput, setCityInput] = useState(city);

  const fetchWeather = async (cityName: string) => {
    setLoading(true);
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=de`);
      const geoData = await geoRes.json();

      if (geoData.results?.[0]) {
        const { latitude, longitude, name } = geoData.results[0];
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`
        );
        const data = await weatherRes.json();
        const wmo = data.current.weather_code;
        const desc = getWeatherDescription(wmo);
        const iconCode = getWeatherIconCode(wmo);

        setWeather({
          temp: Math.round(data.current.temperature_2m),
          feels_like: Math.round(data.current.apparent_temperature),
          humidity: data.current.relative_humidity_2m,
          wind_speed: Math.round(data.current.wind_speed_10m),
          description: desc,
          icon: iconCode,
          city: name,
        });
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  useEffect(() => { fetchWeather(city); }, [city]);

  const getWeatherDescription = (code: number): string => {
    if (code === 0) return 'Klar';
    if (code <= 3) return 'Teilweise bewölkt';
    if (code <= 48) return 'Nebel';
    if (code <= 57) return 'Nieselregen';
    if (code <= 67) return 'Regen';
    if (code <= 77) return 'Schnee';
    if (code <= 82) return 'Regenschauer';
    if (code <= 86) return 'Schneeschauer';
    if (code <= 99) return 'Gewitter';
    return 'Unbekannt';
  };

  const getWeatherIconCode = (code: number): string => {
    if (code === 0) return '01';
    if (code <= 3) return '02';
    if (code <= 48) return '50';
    if (code <= 57) return '09';
    if (code <= 67) return '10';
    if (code <= 77) return '13';
    if (code <= 82) return '10';
    if (code <= 86) return '13';
    return '11';
  };

  const handleCitySubmit = () => {
    if (cityInput.trim()) {
      setCity(cityInput.trim());
      setEditCity(false);
    }
  };

  return (
    <WidgetWrapper widgetId="weather" title="Wetter" icon={<Cloud size={16} />}>
      <div className="weather-widget">
        {loading ? (
          <div className="weather-loading">
            <RefreshCw size={24} className="spin" />
            <span>Laden...</span>
          </div>
        ) : weather ? (
          <>
            <div className="weather-main">
              <div className="weather-icon">{WEATHER_ICONS[weather.icon] || <Cloud size={40} />}</div>
              <div className="weather-temp">{weather.temp}°C</div>
            </div>
            <div className="weather-desc">{weather.description}</div>
            <div className="weather-details">
              <span><Droplets size={13} /> {weather.humidity}%</span>
              <span><Wind size={13} /> {weather.wind_speed} km/h</span>
              <span>Gefühlt {weather.feels_like}°C</span>
            </div>
            <div className="weather-city" onClick={() => { setEditCity(true); setCityInput(city); }}>
              <MapPin size={13} /> {weather.city}
            </div>
          </>
        ) : (
          <div className="weather-error">
            <Cloud size={30} />
            <p>Wetter konnte nicht geladen werden</p>
          </div>
        )}

        {editCity && (
          <div className="weather-city-form">
            <input
              value={cityInput}
              onChange={e => setCityInput(e.target.value)}
              placeholder="Stadt eingeben"
              onKeyDown={e => e.key === 'Enter' && handleCitySubmit()}
              autoFocus
            />
            <button className="btn-primary" onClick={handleCitySubmit}>OK</button>
          </div>
        )}

        <button className="btn-icon weather-refresh" onClick={() => fetchWeather(city)} title="Aktualisieren">
          <RefreshCw size={14} />
        </button>
      </div>
    </WidgetWrapper>
  );
}
