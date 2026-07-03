import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API_URL } from '../context/AuthContext';
import './Dashboard.css';
import './Weather.css';

function Spinner() {
  return <div className="web-spinner"></div>;
}

function Weather() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWeatherData = async () => {
    try {
      const response = await fetch(`${API_URL}/weather/forecast`);
      if (!response.ok) throw new Error('Failed to fetch weather data');
      const data = await response.json();
      setWeatherData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching weather:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSensorData = async () => {
    try {
      const response = await fetch(`${API_URL}/sensors/latest`);
      if (response.ok) {
        const data = await response.json();
        setSensorData(data);
      }
    } catch (err) {
      console.warn('Error fetching sensor data for weather advisory:', err);
    }
  };

  useEffect(() => {
    fetchWeatherData();
    fetchSensorData();
    const interval = setInterval(() => {
      fetchWeatherData();
      fetchSensorData();
    }, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Generate smart irrigation advisory based on weather + sensor data
  const getIrrigationAdvisory = () => {
    if (!weatherData) return { level: 'info', items: [] };

    const current = weatherData.current;
    const todayForecast = weatherData.daily[0];
    const rainProb = todayForecast?.rainProbability || 0;
    const soilMoisture = sensorData?.soilMoisture || 0;
    const temp = current?.temperature || 0;

    const items = [];
    let level = 'safe'; // safe, warning, danger

    // Rain-based advisory
    if (rainProb >= 70) {
      items.push({ icon: '🌧️', text: `High rain probability today (${rainProb}%) — **skip manual irrigation** to avoid overwatering.` });
      level = 'safe';
    } else if (rainProb >= 40) {
      items.push({ icon: '⛅', text: `Moderate rain chance (${rainProb}%) — **monitor conditions** before irrigating.` });
      level = 'warning';
    } else {
      items.push({ icon: '☀️', text: `Low rain probability (${rainProb}%) — **irrigation may be needed** if soil moisture is below threshold.` });
    }

    // Temperature-based advisory
    if (temp > 35) {
      items.push({ icon: '🔥', text: `Extreme heat detected (${temp}°C) — **increase irrigation frequency** and provide shade to sensitive crops.` });
      level = 'danger';
    } else if (temp > 32) {
      items.push({ icon: '🌡️', text: `High temperature (${temp}°C) — **monitor crops for wilting** and ensure adequate water supply.` });
      if (level !== 'danger') level = 'warning';
    } else if (temp >= 25 && temp <= 32) {
      items.push({ icon: '✅', text: `Temperature is within optimal range (${temp}°C) — ideal growing conditions for most vegetables.` });
    }

    // Soil moisture-based advisory
    if (sensorData && soilMoisture > 0) {
      if (soilMoisture < 40) {
        items.push({ icon: '💧', text: `Soil moisture is critically low (${soilMoisture}%) — **immediate irrigation recommended** regardless of weather.` });
        level = 'danger';
      } else if (soilMoisture < 55) {
        items.push({ icon: '🪣', text: `Soil moisture is below optimal (${soilMoisture}%) — consider irrigating if no rain is expected.` });
        if (level !== 'danger') level = 'warning';
      } else if (soilMoisture >= 55 && soilMoisture <= 80) {
        items.push({ icon: '🌱', text: `Soil moisture is healthy (${soilMoisture}%) — no immediate irrigation needed.` });
      } else if (soilMoisture > 80) {
        items.push({ icon: '⚠️', text: `Soil is oversaturated (${soilMoisture}%) — **avoid irrigation** and ensure proper drainage.` });
        if (level !== 'danger') level = 'warning';
      }
    } else {
      items.push({ icon: '📡', text: 'No sensor data available — connect your ESP32 node to receive combined weather + soil advisories.' });
    }

    // Combined advisory
    if (rainProb >= 70 && soilMoisture >= 60) {
      items.push({ icon: '🎯', text: `Rain incoming + adequate soil moisture — **zero irrigation action needed today.** Save water and energy.` });
    }

    return { level, items };
  };

  const formatHour = (timeStr) => {
    const date = new Date(timeStr);
    const hours = date.getHours();
    if (hours === 0) return '12AM';
    if (hours === 12) return '12PM';
    return hours > 12 ? `${hours - 12}PM` : `${hours}AM`;
  };

  const formatDay = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const advisory = getIrrigationAdvisory();

  return (
    <div className={`dashboard-layout-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🌾</span>
          <span className="logo-text">AgriSense</span>
        </div>
        
        <nav className="sidebar-nav-menu">
          <button className="nav-menu-item" onClick={() => navigate('/dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9"></rect>
              <rect x="14" y="3" width="7" height="5"></rect>
              <rect x="14" y="12" width="7" height="9"></rect>
              <rect x="3" y="16" width="7" height="5"></rect>
            </svg>
            <span className="nav-label">Dashboard</span>
          </button>
          
          <button className="nav-menu-item" onClick={() => navigate('/reports')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span className="nav-label">Analytics Reports</span>
          </button>

          <button className="nav-menu-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
              <circle cx="12" cy="12" r="4"></circle>
            </svg>
            <span className="nav-label">Weather</span>
          </button>

          <button className="nav-menu-item" onClick={() => navigate('/dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span className="nav-label">Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span className="nav-label">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="dashboard-main-view">
        <header className="dashboard-header">
          <div className="header-left">
            <button className="hamburger-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Navigation">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h2>Weather & Forecast</h2>
          </div>
          <div className="header-user-menu">
            <div className="profile-btn" onClick={() => navigate('/dashboard')}>
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="Avatar" className="header-avatar" />
              ) : (
                <div className="header-avatar-placeholder">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <span className="header-username">{user?.name || 'Farmer'}</span>
            </div>
          </div>
        </header>

        <main className="dashboard-content-area">
          <div className="weather-page-content">
            <h1 className="weather-page-title">☁️ Local Weather Forecast</h1>
            <p className="weather-page-subtitle">Real-time weather conditions and smart irrigation advisory for Taguig City</p>

            {loading ? (
              <div className="weather-loading">
                <Spinner />
                <span>Fetching weather data from Open-Meteo...</span>
              </div>
            ) : error ? (
              <div className="weather-error">
                <span className="weather-error-icon">⚠️</span>
                <h3>Unable to Load Weather Data</h3>
                <p>{error}</p>
                <button className="btn-retry" onClick={() => { setLoading(true); fetchWeatherData(); }}>
                  Retry
                </button>
              </div>
            ) : weatherData ? (
              <>
                {/* Current Conditions Hero */}
                <div className="weather-hero-card">
                  <div className="hero-left">
                    <span className="hero-location">📍 {weatherData.location}</span>
                    <div className="hero-temp-row">
                      <span className="hero-temp">{Math.round(weatherData.current.temperature)}</span>
                      <span className="hero-temp-unit">°C</span>
                    </div>
                    <span className="hero-condition">{weatherData.current.description}</span>
                    <span className="hero-feels-like">Feels like {Math.round(weatherData.current.feelsLike)}°C</span>
                  </div>
                  <div className="hero-right">
                    <span className="hero-weather-icon">{weatherData.current.icon}</span>
                    <div className="hero-stats-row">
                      <div className="hero-stat">
                        <span className="hero-stat-value">{weatherData.current.humidity}%</span>
                        <span className="hero-stat-label">Humidity</span>
                      </div>
                      <div className="hero-stat">
                        <span className="hero-stat-value">{weatherData.current.windSpeed} km/h</span>
                        <span className="hero-stat-label">Wind</span>
                      </div>
                      <div className="hero-stat">
                        <span className="hero-stat-value">{weatherData.daily[0]?.rainProbability || 0}%</span>
                        <span className="hero-stat-label">Rain</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Weather Details Grid */}
                <div className="weather-details-grid">
                  <div className="weather-detail-card">
                    <div className="weather-detail-icon">🌡️</div>
                    <div className="weather-detail-value">{Math.round(weatherData.current.temperature)}°C</div>
                    <div className="weather-detail-label">Temperature</div>
                  </div>
                  <div className="weather-detail-card">
                    <div className="weather-detail-icon">💧</div>
                    <div className="weather-detail-value">{weatherData.current.humidity}%</div>
                    <div className="weather-detail-label">Humidity</div>
                  </div>
                  <div className="weather-detail-card">
                    <div className="weather-detail-icon">💨</div>
                    <div className="weather-detail-value">{weatherData.current.windSpeed}</div>
                    <div className="weather-detail-label">Wind (km/h)</div>
                  </div>
                  <div className="weather-detail-card">
                    <div className="weather-detail-icon">🌧️</div>
                    <div className="weather-detail-value">{weatherData.daily[0]?.rainProbability || 0}%</div>
                    <div className="weather-detail-label">Rain Prob.</div>
                  </div>
                </div>

                {/* Smart Irrigation Advisory */}
                <div className={`advisory-card ${advisory.level === 'warning' ? 'warning' : advisory.level === 'danger' ? 'danger' : ''}`}>
                  <div className="advisory-header">
                    <span className="advisory-icon">
                      {advisory.level === 'danger' ? '🚨' : advisory.level === 'warning' ? '⚠️' : '🌱'}
                    </span>
                    <h3>
                      {advisory.level === 'danger' ? 'Urgent Irrigation Action Required' : 
                       advisory.level === 'warning' ? 'Irrigation Advisory — Monitor Conditions' : 
                       'Smart Irrigation Advisory — All Clear'}
                    </h3>
                  </div>
                  <div className="advisory-body">
                    {advisory.items.map((item, index) => (
                      <div key={index} className="advisory-item">
                        <span className="advisory-item-icon">{item.icon}</span>
                        <span dangerouslySetInnerHTML={{ __html: item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 7-Day Forecast */}
                <div className="weather-section-card">
                  <h3>📅 7-Day Forecast</h3>
                  <p className="section-subtitle">Daily temperature range and precipitation outlook</p>
                  <div className="forecast-strip">
                    {weatherData.daily.map((day, index) => (
                      <div key={index} className="forecast-day-card">
                        <div className="forecast-day-name">{index === 0 ? 'Today' : formatDay(day.date)}</div>
                        <div className="forecast-day-date">{formatDate(day.date)}</div>
                        <div className="forecast-day-icon">{day.icon}</div>
                        <div className="forecast-day-temps">
                          <span className="forecast-temp-max">{Math.round(day.tempMax)}°</span>
                          <span className="forecast-temp-min">{Math.round(day.tempMin)}°</span>
                        </div>
                        <div className={`forecast-rain-prob ${day.rainProbability >= 60 ? 'high' : ''}`}>
                          💧 {day.rainProbability}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Weather;
