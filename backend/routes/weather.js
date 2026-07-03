const express = require('express');
const router = express.Router();

// Taguig City, Metro Manila coordinates
const TAGUIG_LAT = 14.5176;
const TAGUIG_LON = 121.0509;

// Simple in-memory cache (15-minute TTL)
let weatherCache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Map WMO weather codes to human-readable descriptions and emoji icons
const WMO_CODES = {
  0: { description: 'Clear Sky', icon: '☀️' },
  1: { description: 'Mainly Clear', icon: '🌤️' },
  2: { description: 'Partly Cloudy', icon: '⛅' },
  3: { description: 'Overcast', icon: '☁️' },
  45: { description: 'Foggy', icon: '🌫️' },
  48: { description: 'Depositing Rime Fog', icon: '🌫️' },
  51: { description: 'Light Drizzle', icon: '🌦️' },
  53: { description: 'Moderate Drizzle', icon: '🌦️' },
  55: { description: 'Dense Drizzle', icon: '🌧️' },
  61: { description: 'Slight Rain', icon: '🌦️' },
  63: { description: 'Moderate Rain', icon: '🌧️' },
  65: { description: 'Heavy Rain', icon: '🌧️' },
  71: { description: 'Slight Snowfall', icon: '🌨️' },
  73: { description: 'Moderate Snowfall', icon: '🌨️' },
  75: { description: 'Heavy Snowfall', icon: '❄️' },
  80: { description: 'Slight Rain Showers', icon: '🌦️' },
  81: { description: 'Moderate Rain Showers', icon: '🌧️' },
  82: { description: 'Violent Rain Showers', icon: '⛈️' },
  95: { description: 'Thunderstorm', icon: '⛈️' },
  96: { description: 'Thunderstorm with Slight Hail', icon: '⛈️' },
  99: { description: 'Thunderstorm with Heavy Hail', icon: '⛈️' },
};

function getWeatherInfo(code) {
  return WMO_CODES[code] || { description: 'Unknown', icon: '🌡️' };
}

// GET /api/weather/forecast — Fetch current + 7-day forecast from Open-Meteo
router.get('/forecast', async (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still fresh
    if (weatherCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
      return res.json(weatherCache);
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${TAGUIG_LAT}&longitude=${TAGUIG_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=Asia%2FManila&forecast_days=7`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API returned status ${response.status}`);
    }

    const data = await response.json();

    // Transform the response into a clean format
    const current = {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      feelsLike: data.current.apparent_temperature,
      windSpeed: data.current.wind_speed_10m,
      weatherCode: data.current.weather_code,
      ...getWeatherInfo(data.current.weather_code),
    };

    // Build daily forecast array (next 7 days)
    const daily = data.daily.time.map((date, i) => ({
      date,
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      rainProbability: data.daily.precipitation_probability_max[i],
      weatherCode: data.daily.weather_code[i],
      sunrise: data.daily.sunrise[i],
      sunset: data.daily.sunset[i],
      ...getWeatherInfo(data.daily.weather_code[i]),
    }));

    // Build hourly forecast (next 24 hours only)
    const nowHour = new Date().getHours();
    const hourly = data.hourly.time.slice(0, 48).map((time, i) => ({
      time,
      temperature: data.hourly.temperature_2m[i],
      rainProbability: data.hourly.precipitation_probability[i],
      weatherCode: data.hourly.weather_code[i],
      ...getWeatherInfo(data.hourly.weather_code[i]),
    })).slice(nowHour, nowHour + 24);

    const result = {
      location: 'Taguig City, Metro Manila',
      current,
      daily,
      hourly,
      fetchedAt: new Date().toISOString(),
    };

    // Cache the result
    weatherCache = result;
    cacheTimestamp = now;

    res.json(result);
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weather data',
      error: error.message
    });
  }
});

module.exports = router;
