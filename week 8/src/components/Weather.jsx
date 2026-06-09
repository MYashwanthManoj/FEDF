import React, { useState, useEffect, useCallback, useRef } from "react";
import "./Weather.css";

/* ─────────────────────────────────────────────
   WMO Weather-Code mapping
──────────────────────────────────────────────── */
const WMO_CODES = {
  0:  { label: "Clear Sky",            icon: "☀️",  bg: "sunny"  },
  1:  { label: "Mainly Clear",         icon: "🌤️",  bg: "sunny"  },
  2:  { label: "Partly Cloudy",        icon: "⛅",  bg: "cloudy" },
  3:  { label: "Overcast",             icon: "☁️",  bg: "cloudy" },
  45: { label: "Foggy",                icon: "🌫️",  bg: "fog"    },
  48: { label: "Depositing Rime Fog",  icon: "🌫️",  bg: "fog"    },
  51: { label: "Light Drizzle",        icon: "🌦️",  bg: "rain"   },
  53: { label: "Moderate Drizzle",     icon: "🌦️",  bg: "rain"   },
  55: { label: "Dense Drizzle",        icon: "🌧️",  bg: "rain"   },
  61: { label: "Slight Rain",          icon: "🌧️",  bg: "rain"   },
  63: { label: "Moderate Rain",        icon: "🌧️",  bg: "rain"   },
  65: { label: "Heavy Rain",           icon: "🌧️",  bg: "rain"   },
  71: { label: "Slight Snowfall",      icon: "🌨️",  bg: "snow"   },
  73: { label: "Moderate Snowfall",    icon: "❄️",  bg: "snow"   },
  75: { label: "Heavy Snowfall",       icon: "❄️",  bg: "snow"   },
  77: { label: "Snow Grains",          icon: "🌨️",  bg: "snow"   },
  80: { label: "Slight Showers",       icon: "🌦️",  bg: "rain"   },
  81: { label: "Moderate Showers",     icon: "🌦️",  bg: "rain"   },
  82: { label: "Violent Showers",      icon: "⛈️",  bg: "storm"  },
  85: { label: "Slight Snow Showers",  icon: "🌨️",  bg: "snow"   },
  86: { label: "Heavy Snow Showers",   icon: "❄️",  bg: "snow"   },
  95: { label: "Thunderstorm",         icon: "⛈️",  bg: "storm"  },
  96: { label: "Thunderstorm w/ Hail", icon: "⛈️",  bg: "storm"  },
  99: { label: "Heavy Thunderstorm",   icon: "⛈️",  bg: "storm"  },
};

/* ─────────────────────────────────────────────
   API helpers
──────────────────────────────────────────────── */
const WEATHER_URL = (lat, lon) =>
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${lat}&longitude=${lon}` +
  `&timezone=auto` +
  `&current=temperature_2m,relative_humidity_2m,apparent_temperature,` +
  `is_day,precipitation,rain,weather_code,cloud_cover,` +
  `pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,` +
  `wind_gusts_10m,uv_index`;

const GEO_URL = (query) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;

function getWindDir(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}
function uvLabel(uv) {
  if (uv == null) return { text: "—",        color: "#aaa" };
  if (uv <= 2)   return { text: "Low",       color: "#4cc9f0" };
  if (uv <= 5)   return { text: "Moderate",  color: "#ffd60a" };
  if (uv <= 7)   return { text: "High",      color: "#ff8c42" };
  if (uv <= 10)  return { text: "Very High", color: "#e63946" };
  return               { text: "Extreme",   color: "#9b2226" };
}
function pressureLabel(hPa) {
  if (hPa > 1022) return "High";
  if (hPa < 1009) return "Low";
  return "Normal";
}
function formatTime(date) {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/* ─────────────────────────────────────────────
   Sub-components
──────────────────────────────────────────────── */
function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {Array.from({ length: 20 }).map((_, i) => (
        <span key={i} className="particle" style={{
          "--delay": `${(i * 0.4).toFixed(1)}s`,
          "--x":     `${(i * 5.2 + 3) % 100}%`,
          "--size":  `${2 + (i % 4)}px`,
          "--dur":   `${8 + (i % 6)}s`,
        }} />
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, unit, sub, accent, delay = 0 }) {
  return (
    <div className="stat-card" style={{ "--accent": accent, "--delay": `${delay}s` }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <span className="stat-value">
          {value}<span className="stat-unit">{unit}</span>
        </span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
      <div className="stat-glow" />
    </div>
  );
}

function TempGauge({ temp, feelsLike }) {
  const pct   = Math.min(100, Math.max(0, ((temp - 5) / 45) * 100));
  const color = temp >= 38 ? "#e63946" : temp >= 32 ? "#ff8c42" : temp >= 24 ? "#ffd60a" : "#4cc9f0";
  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 140 90" className="gauge-svg">
        <path d="M14 80 A60 60 0 0 1 126 80" fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth="11" strokeLinecap="round"/>
        <path d="M14 80 A60 60 0 0 1 126 80" fill="none"
          stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${pct * 1.89} 189`}
          style={{ filter: `drop-shadow(0 0 8px ${color})`,
                   transition: "stroke-dasharray 1.6s cubic-bezier(.34,1.56,.64,1)" }}/>
        <text x="70" y="72" textAnchor="middle" fill={color}
          fontSize="22" fontWeight="800" fontFamily="Space Grotesk, sans-serif">{temp}°</text>
        <text x="70" y="86" textAnchor="middle" fill="rgba(180,210,255,0.45)"
          fontSize="8.5" fontFamily="Inter, sans-serif">CELSIUS</text>
      </svg>
      <p className="gauge-feels">Feels like <strong>{feelsLike}°C</strong></p>
    </div>
  );
}

function WindCompass({ direction, speed, gusts }) {
  return (
    <div className="compass-wrap">
      <div className="compass" style={{ "--dir": `${direction}deg` }}>
        <div className="compass-ring" />
        <div className="compass-needle" />
        <div className="compass-labels">
          {["N","E","S","W"].map((d) => (
            <span key={d} className="compass-label">{d}</span>
          ))}
        </div>
        <div className="compass-center">
          <span className="compass-speed">{speed}</span>
          <span className="compass-unit">km/h</span>
        </div>
      </div>
      <p className="compass-dir-label">{getWindDir(direction)}</p>
      {gusts && <p className="compass-gusts">Gusts up to <strong>{gusts} km/h</strong></p>}
    </div>
  );
}

function MeterRow({ label, value, max, unit, color = "#00d4ff" }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="meter-row">
      <div className="meter-header">
        <span className="meter-label">{label}</span>
        <span className="meter-val">{value}{unit}</span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ "--pct": `${pct}%`, "--color": color }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   City Search Bar
──────────────────────────────────────────────── */
function CitySearch({ onSelect }) {
  const [query,       setQuery]       = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [open,        setOpen]        = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const inputRef   = useRef(null);
  const dropRef    = useRef(null);
  const debounceId = useRef(null);

  /* Close dropdown when clicking outside */
  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim() || q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    setSearching(true);
    try {
      const res  = await fetch(GEO_URL(q));
      const data = await res.json();
      const results = data.results || [];
      setSuggestions(results);
      setOpen(results.length > 0);
      setActiveIdx(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceId.current);
    debounceId.current = setTimeout(() => search(val), 320);
  }

  function handleSelect(city) {
    setQuery(`${city.name}, ${city.country}`);
    setOpen(false);
    setSuggestions([]);
    onSelect(city);
  }

  function handleKeyDown(e) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleClear() {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="search-wrap">
      <div className={`search-box ${open ? "search-box--open" : ""}`}>
        {/* Search icon */}
        <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
        </svg>

        <input
          id="city-search-input"
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search city or country…"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
          spellCheck="false"
          aria-label="Search city or country"
          aria-autocomplete="list"
          aria-expanded={open}
        />

        {/* Spinner / Clear */}
        {searching ? (
          <svg className="search-spinner" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round"/>
          </svg>
        ) : query ? (
          <button className="search-clear" onClick={handleClear} aria-label="Clear search">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <ul
          ref={dropRef}
          className="search-dropdown"
          role="listbox"
          aria-label="City suggestions"
        >
          {suggestions.map((city, idx) => (
            <li
              key={`${city.id ?? idx}`}
              role="option"
              aria-selected={idx === activeIdx}
              className={`search-result ${idx === activeIdx ? "search-result--active" : ""}`}
              onMouseDown={() => handleSelect(city)}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <div className="result-left">
                <span className="result-flag">
                  {city.country_code
                    ? String.fromCodePoint(...[...city.country_code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)))
                    : "🌍"}
                </span>
                <div className="result-info">
                  <span className="result-name">{city.name}</span>
                  <span className="result-region">
                    {[city.admin1, city.country].filter(Boolean).join(", ")}
                  </span>
                </div>
              </div>
              <div className="result-coords">
                <span>{city.latitude?.toFixed(2)}°N</span>
                <span>{city.longitude?.toFixed(2)}°E</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Weather Component
──────────────────────────────────────────────── */
const DEFAULT_CITY = {
  name: "Hyderabad", country: "India", country_code: "IN",
  latitude: 17.38, longitude: 78.48,
};

export default function Weather() {
  const [city,        setCity]        = useState(DEFAULT_CITY);
  const [wx,          setWx]          = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const fetchWeather = useCallback(async (lat, lon, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else { setLoading(true); setError(""); setWx(null); }

      const res = await fetch(WEATHER_URL(lat, lon));
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
      const data = await res.json();
      setWx(data.current);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Unable to reach weather service");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /* Fetch on city change */
  useEffect(() => {
    fetchWeather(city.latitude, city.longitude);
  }, [city, fetchWeather]);

  /* Auto-refresh every 10 min */
  useEffect(() => {
    const id = setInterval(() => fetchWeather(city.latitude, city.longitude, true), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [city, fetchWeather]);

  function handleCitySelect(selectedCity) {
    setCity(selectedCity);
  }

  const wmo  = wx ? (WMO_CODES[wx.weather_code] ?? { label: "Unknown", icon: "🌡️", bg: "default" }) : null;
  const uv   = wx ? uvLabel(wx.uv_index)          : null;
  const pLbl = wx ? pressureLabel(wx.pressure_msl) : null;

  const displayName = city.admin1
    ? `${city.name}, ${city.admin1}`
    : `${city.name}, ${city.country}`;

  const flag = city.country_code
    ? String.fromCodePoint(...[...city.country_code.toUpperCase()].map(c => 127397 + c.charCodeAt(0)))
    : "🌍";

  return (
    <div className={`skypulse-root bg-${wmo?.bg ?? "default"}`}>
      <Particles />
      <div className="blob blob-1" aria-hidden="true" />
      <div className="blob blob-2" aria-hidden="true" />
      <div className="blob blob-3" aria-hidden="true" />

      <div className="page-wrap">

        {/* ── HEADER ── */}
        <header className="header">
          <div className="header-brand">
            <div className="brand-logo">
              <svg viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="15" fill="url(#logoGrad)" />
                <path d="M8 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="16" cy="14" r="3" fill="white"/>
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32">
                    <stop stopColor="#00d4ff"/>
                    <stop offset="1" stopColor="#7c5cfc"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div>
              <h1 className="brand-name">SkyPulse</h1>
              <p className="brand-tagline">Live Weather Intelligence</p>
            </div>
          </div>

          {/* Search bar */}
          <CitySearch onSelect={handleCitySelect} />

          <div className="header-meta">
            <button id="refresh-btn"
              className={`refresh-btn ${refreshing ? "spinning" : ""}`}
              onClick={() => fetchWeather(city.latitude, city.longitude, true)}
              disabled={refreshing || loading}
              aria-label="Refresh weather data"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
              </svg>
            </button>
            {lastUpdated && (
              <div className="last-updated">Updated {formatTime(lastUpdated)}</div>
            )}
          </div>
        </header>

        {/* ── LOADING ── */}
        {loading && (
          <div className="loading-state">
            <div className="loader">
              <div className="loader-ring" />
              <div className="loader-icon">🌤️</div>
            </div>
            <p className="loading-text">Fetching weather for {city.name}…</p>
            <p className="loading-sub">{city.latitude?.toFixed(2)}°N, {city.longitude?.toFixed(2)}°E</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {error && !loading && (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <h2 className="error-title">Connection Error</h2>
            <p className="error-msg">{error}</p>
            <button id="retry-btn" className="retry-btn"
              onClick={() => fetchWeather(city.latitude, city.longitude)}>
              Try Again
            </button>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {wx && !loading && !error && (
          <main className="dashboard">

            {/* Hero */}
            <section className="hero-card glass-card" aria-label="Current temperature">
              <div className="hero-left">
                <div className="hero-location">
                  <span className="hero-flag">{flag}</span>
                  <div>
                    <p className="hero-city">{city.name}</p>
                    <p className="hero-country">{city.admin1 ? `${city.admin1}, ${city.country}` : city.country}</p>
                  </div>
                  <div className="hero-coords">
                    {city.latitude?.toFixed(2)}°N · {city.longitude?.toFixed(2)}°E
                  </div>
                </div>

                <div className="condition-badge">
                  <span className="condition-icon-large">{wmo.icon}</span>
                  <span className="condition-text">{wmo.label}</span>
                </div>

                <div className="temperature-display">
                  <span className="temp-value">{wx.temperature_2m}</span>
                  <span className="temp-unit">°C</span>
                </div>

                <div className="hero-divider" />

                <div className="hero-meta-row">
                  <div className="hero-meta-item">
                    <span className="hero-meta-label">Humidity</span>
                    <span className="hero-meta-val">💧 {wx.relative_humidity_2m}%</span>
                  </div>
                  <div className="hero-meta-sep" />
                  <div className="hero-meta-item">
                    <span className="hero-meta-label">UV Index</span>
                    <span className="hero-meta-val" style={{ color: uv.color }}>
                      ☀️ {wx.uv_index} — {uv.text}
                    </span>
                  </div>
                  <div className="hero-meta-sep" />
                  <div className="hero-meta-item">
                    <span className="hero-meta-label">Daytime</span>
                    <span className="hero-meta-val">{wx.is_day ? "☀️ Day" : "🌙 Night"}</span>
                  </div>
                </div>
              </div>

              <div className="hero-right">
                <TempGauge temp={wx.temperature_2m} feelsLike={wx.apparent_temperature} />
              </div>
            </section>

            {/* Stat grid */}
            <section className="stats-grid" aria-label="Weather statistics">
              <StatCard icon="💧" label="Humidity"      value={wx.relative_humidity_2m} unit="%" accent="#4cc9f0" delay={0.05}/>
              <StatCard icon="💨" label="Wind Speed"    value={wx.wind_speed_10m}   unit=" km/h"
                        sub={`Gusts ${wx.wind_gusts_10m} km/h`} accent="#00d4ff" delay={0.1}/>
              <StatCard icon="🌡️" label="Feels Like"    value={wx.apparent_temperature} unit="°C" accent="#ff8c42" delay={0.15}/>
              <StatCard icon="🌧️" label="Precipitation" value={wx.precipitation}    unit=" mm" accent="#7c5cfc" delay={0.2}/>
              <StatCard icon="☁️" label="Cloud Cover"   value={wx.cloud_cover}      unit="%" accent="#94a3b8" delay={0.25}/>
              <StatCard icon="🧭" label="Pressure"      value={wx.pressure_msl}     unit=" hPa" sub={pLbl} accent="#f0abfc" delay={0.3}/>
              <StatCard icon="🌬️" label="Wind Gusts"    value={wx.wind_gusts_10m}   unit=" km/h" accent="#60a5fa" delay={0.35}/>
              <StatCard icon="🧭" label="Wind Dir"      value={`${wx.wind_direction_10m}°`}
                        unit={` ${getWindDir(wx.wind_direction_10m)}`} accent="#a78bfa" delay={0.4}/>
            </section>

            {/* Bottom row */}
            <section className="bottom-row">
              <div className="compass-card glass-card">
                <h2 className="card-title"><span className="card-title-icon">🧭</span> Wind Compass</h2>
                <WindCompass direction={wx.wind_direction_10m} speed={wx.wind_speed_10m} gusts={wx.wind_gusts_10m}/>
              </div>

              <div className="detail-cards-col">
                <div className="detail-card glass-card">
                  <h2 className="card-title"><span className="card-title-icon">💨</span> Wind Details</h2>
                  <div className="meter-list">
                    <MeterRow label="Speed"     value={wx.wind_speed_10m}     max={120} unit=" km/h" color="#00d4ff"/>
                    <MeterRow label="Gusts"     value={wx.wind_gusts_10m}     max={120} unit=" km/h" color="#60a5fa"/>
                    <MeterRow label="Direction" value={wx.wind_direction_10m} max={360} unit="°"     color="#a78bfa"/>
                  </div>
                </div>

                <div className="detail-card glass-card">
                  <h2 className="card-title"><span className="card-title-icon">🌍</span> Atmosphere</h2>
                  <div className="atmosphere-grid">
                    <div className="atmo-item">
                      <span className="atmo-label">Pressure (MSL)</span>
                      <span className="atmo-val">{wx.pressure_msl} hPa</span>
                      <span className="atmo-sub">{pLbl}</span>
                    </div>
                    <div className="atmo-item">
                      <span className="atmo-label">Surface Pressure</span>
                      <span className="atmo-val">{wx.surface_pressure} hPa</span>
                    </div>
                    <div className="atmo-item">
                      <span className="atmo-label">Precipitation</span>
                      <span className="atmo-val">{wx.precipitation} mm</span>
                    </div>
                    <div className="atmo-item">
                      <span className="atmo-label">Cloud Cover</span>
                      <span className="atmo-val">{wx.cloud_cover}%</span>
                    </div>
                    <div className="atmo-item">
                      <span className="atmo-label">Humidity</span>
                      <span className="atmo-val">{wx.relative_humidity_2m}%</span>
                    </div>
                    <div className="atmo-item">
                      <span className="atmo-label">UV Index</span>
                      <span className="atmo-val" style={{ color: uv.color }}>
                        {wx.uv_index} — {uv.text}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </main>
        )}

        {/* FOOTER */}
        <footer className="footer">
          <p className="footer-text">
            Data from <span className="footer-accent">Open-Meteo</span> (WMO models) ·
            Geocoding by <span className="footer-accent">Open-Meteo Geocoding API</span> ·
            Auto-updates every 10 min
          </p>
        </footer>
      </div>
    </div>
  );
}