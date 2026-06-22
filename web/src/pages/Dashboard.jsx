import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
          <p>Monitor and manage your agricultural operations</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🌱</div>
            <div className="stat-content">
              <h3>Active Fields</h3>
              <p className="stat-value">5</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💧</div>
            <div className="stat-content">
              <h3>Soil Moisture</h3>
              <p className="stat-value">65%</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🌡️</div>
            <div className="stat-content">
              <h3>Temperature</h3>
              <p className="stat-value">24°C</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">☁️</div>
            <div className="stat-content">
              <h3>Humidity</h3>
              <p className="stat-value">72%</p>
            </div>
          </div>
        </div>

        <div className="dashboard-sections">
          <section className="section">
            <h2>Recent Activity</h2>
            <div className="activity-list">
              <div className="activity-item">
                <span className="activity-time">Today</span>
                <span className="activity-text">Irrigation system activated</span>
              </div>
              <div className="activity-item">
                <span className="activity-time">Yesterday</span>
                <span className="activity-text">Soil sensor calibrated</span>
              </div>
              <div className="activity-item">
                <span className="activity-time">2 days ago</span>
                <span className="activity-text">New field added</span>
              </div>
            </div>
          </section>

          <section className="section">
            <h2>Quick Actions</h2>
            <div className="action-buttons">
              <button className="btn btn-primary">Add Field</button>
              <button className="btn btn-secondary">View Reports</button>
              <button className="btn btn-secondary">Settings</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
