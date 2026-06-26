import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, API_URL } from '../context/AuthContext';
import './Dashboard.css';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [sensorData, setSensorData] = useState({
    soilMoisture: 0,
    temperature: 0,
    humidity: 0,
    waterLevel: 0,
    pumpStatus: 'OFF'
  });

  useEffect(() => {
    const fetchLatestSensorData = async () => {
      try {
        const response = await fetch(`${API_URL}/sensors/latest`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.soilMoisture !== undefined) {
            setSensorData(prev => {
              let pump = prev.pumpStatus;
              if (data.soilMoisture < 50 && data.waterLevel > 2.0) {
                pump = 'ON';
              } else if (data.soilMoisture >= 70) {
                pump = 'OFF';
              }
              return {
                soilMoisture: data.soilMoisture,
                temperature: data.temperature,
                humidity: data.humidity,
                waterLevel: data.waterLevel,
                pumpStatus: pump
              };
            });
          }
        }
      } catch (error) {
        console.error('Error fetching latest sensor data on web:', error);
      }
    };

    fetchLatestSensorData();
    const interval = setInterval(fetchLatestSensorData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <nav className="navbar">
          <div className="logo">AgriSense</div>
          <div className="nav-links">
            <span className="user-name">Welcome, {user?.name}</span>
            <Link to="/" className="nav-link">Home</Link>
            <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
          </div>
        </nav>
      </header>

      <main className="dashboard-main">
        <div className="welcome-section">
          <h1>Welcome to Your Dashboard</h1>
          <p>Monitor and manage your agricultural operations in real-time</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🌱</div>
            <div className="stat-content">
              <h3>Active Fields</h3>
              <p className="stat-value">3</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💧</div>
            <div className="stat-content">
              <h3>Soil Moisture</h3>
              <p className="stat-value">{sensorData.soilMoisture}%</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🌡️</div>
            <div className="stat-content">
              <h3>Temperature</h3>
              <p className="stat-value">{sensorData.temperature}°C</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">☁️</div>
            <div className="stat-content">
              <h3>Humidity</h3>
              <p className="stat-value">{sensorData.humidity}%</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🪣</div>
            <div className="stat-content">
              <h3>Reservoir Level</h3>
              <p className="stat-value">{sensorData.waterLevel} cm</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔌</div>
            <div className="stat-content">
              <h3>5V Water Pump</h3>
              <p className="stat-value" style={{ color: sensorData.pumpStatus === 'ON' ? '#10B981' : '#EF4444' }}>
                {sensorData.pumpStatus}
              </p>
            </div>
          </div>
        </div>

        <div className="dashboard-sections">
          <section className="section">
            <h2>Recent Activity</h2>
            <div className="activity-list">
              <div className="activity-item">
                <span className="activity-time">Live Feed</span>
                <span className="activity-text">
                  {sensorData.soilMoisture < 50 
                    ? 'Soil moisture is low! Pump activated.' 
                    : 'System status normal.'}
                </span>
              </div>
              <div className="activity-item">
                <span className="activity-time">Reservoir</span>
                <span className="activity-text">
                  {sensorData.waterLevel < 2.0 
                    ? '⚠️ Low water level in tank!' 
                    : 'Water supply is stable.'}
                </span>
              </div>
            </div>
          </section>

          <section className="section">
            <h2>Quick Actions</h2>
            <div className="action-buttons">
              <button className="btn btn-primary" onClick={() => alert('Add Field feature available in Mobile app.')}>Add Field</button>
              <button className="btn btn-secondary" onClick={() => alert('Detailed charts and weekly reports are available in the Mobile client.')}>View Reports</button>
              <button className="btn btn-secondary" onClick={() => alert('Settings can be configured on the Mobile interface.')}>Settings</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
