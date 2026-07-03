import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

function Landing() {
  return (
    <div className="landing-screen">
      <div className="landing-overlay">
        
        {/* Header */}
        <header className="landing-header">
          <div className="logo">🌾 AgriSense</div>
        </header>

        {/* Content */}
        <main className="landing-content">
          <div className="glass-card">
            <h1 className="title">Smart Agriculture<br />At Your Fingertips</h1>
            <p className="subtitle">
              Monitor your crops in real-time, optimize resource usage, and maximize yields with precision sensing technology.
            </p>
            
            <div className="button-container">
              <Link to="/register" className="btn-primary">
                Get Started
              </Link>
              <Link to="/login" className="btn-secondary">
                Sign In
              </Link>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="landing-footer">
          <p>© 2026 AgriSense. Empowering Farmers.</p>
        </footer>

      </div>
    </div>
  );
}

export default Landing;
