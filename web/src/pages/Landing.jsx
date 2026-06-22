import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <nav className="navbar">
          <div className="logo">AgriSense</div>
          <div className="nav-links">
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/register" className="nav-link btn-primary">Sign Up</Link>
          </div>
        </nav>
      </header>

      <main className="landing-main">
        <section className="hero">
          <div className="hero-content">
            <h1>Smart Agriculture Solutions</h1>
            <p>Monitor your crops, optimize irrigation, and maximize yield with AgriSense.</p>
            <div className="hero-buttons">
              <Link to="/register" className="btn btn-primary">Get Started</Link>
              <Link to="/login" className="btn btn-secondary">Login</Link>
            </div>
          </div>
          <div className="hero-image">
            <div className="placeholder-image">
              🌾
            </div>
          </div>
        </section>

        <section className="features">
          <h2>Our Features</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <h3>Real-time Monitoring</h3>
              <p>Track soil moisture, temperature, and humidity in real-time.</p>
            </div>
            <div className="feature-card">
              <h3>Smart Irrigation</h3>
              <p>Automate watering based on crop needs and weather conditions.</p>
            </div>
            <div className="feature-card">
              <h3>Data Analytics</h3>
              <p>Get insights and recommendations to improve your yield.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>&copy; 2026 AgriSense. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default Landing;
