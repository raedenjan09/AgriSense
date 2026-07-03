import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API_URL } from '../context/AuthContext';
import './Reports.css';
import './Admin.css';
import './Dashboard.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function Reports() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [startDate, setStartDate] = useState(24);
  const [endDate, setEndDate] = useState(30);
  const [tempStartDate, setTempStartDate] = useState(24);
  const [tempEndDate, setTempEndDate] = useState(30);
  const [selectedMonth, setSelectedMonth] = useState(5); // June
  const [selectedYear, setSelectedYear] = useState(2026);
  const [tempMonth, setTempMonth] = useState(5);
  const [tempYear, setTempYear] = useState(2026);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sensorHistory, setSensorHistory] = useState([]);
  const [selectedAnalyticsDay, setSelectedAnalyticsDay] = useState('All');
  const [thresholds, setThresholds] = useState({ moistureMin: 50, tempMax: 32, reservoirMin: 2.0 });

  const fetchSensorHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/sensors/history`);
      if (response.ok) {
        const data = await response.json();
        setSensorHistory(data);
      }
    } catch (error) {
      console.warn('Error fetching sensor history in web Reports:', error);
    }
  };

  const fetchThresholds = async () => {
    try {
      const response = await fetch(`${API_URL}/sensors/thresholds`);
      if (response.ok) {
        const data = await response.json();
        setThresholds(data);
      }
    } catch (error) {
      console.warn('Error fetching thresholds in web Reports:', error);
    }
  };

  useEffect(() => {
    fetchSensorHistory();
    fetchThresholds();
    const interval = setInterval(() => {
      fetchSensorHistory();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const waterUsageRange = [];
  const reservoirLevelsRange = [];
  const tempRange = [];
  const humidityRange = [];

  let totalWater = 0;
  let sumLevel = 0;
  let sumTemp = 0;
  let sumHumidity = 0;
  let daysWithDataCount = 0;

  for (let d = startDate; d <= endDate; d++) {
    const dayLabel = `${daysOfWeek[(d - 1) % 7]} ${d}`;
    
    // Filter readings for day d in selected month and year
    const dayReadings = sensorHistory.filter(r => {
      const date = new Date(r.timestamp);
      return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth && date.getDate() === d;
    });
    
    if (dayReadings.length > 0) {
      daysWithDataCount++;
      const avgSoilMoisture = Math.round(dayReadings.reduce((sum, r) => sum + r.soilMoisture, 0) / dayReadings.length);
      const avgWaterLevel = parseFloat((dayReadings.reduce((sum, r) => sum + r.waterLevel, 0) / dayReadings.length).toFixed(1));
      const avgTemp = parseFloat((dayReadings.reduce((sum, r) => sum + r.temperature, 0) / dayReadings.length).toFixed(1));
      const avgHumidity = Math.round(dayReadings.reduce((sum, r) => sum + r.humidity, 0) / dayReadings.length);
      
      totalWater += avgSoilMoisture;
      sumLevel += avgWaterLevel;
      sumTemp += avgTemp;
      sumHumidity += avgHumidity;
      
      waterUsageRange.push({ day: dayLabel, amount: avgSoilMoisture, label: `${avgSoilMoisture}%`, noData: false });
      reservoirLevelsRange.push({ day: dayLabel, level: avgWaterLevel, noData: false });
      tempRange.push({ day: dayLabel, temp: avgTemp, noData: false });
      humidityRange.push({ day: dayLabel, humidity: avgHumidity, noData: false });
    } else {
      waterUsageRange.push({ day: dayLabel, amount: 0, label: '0%', noData: true });
      reservoirLevelsRange.push({ day: dayLabel, level: 0, noData: true });
      tempRange.push({ day: dayLabel, temp: 0, noData: true });
      humidityRange.push({ day: dayLabel, humidity: 0, noData: true });
    }
  }

  const avgLevel = daysWithDataCount > 0 ? (sumLevel / daysWithDataCount).toFixed(1) : '0.0';
  const avgMoistureOverall = daysWithDataCount > 0 ? Math.round(totalWater / daysWithDataCount) : 0;
  const avgTempOverall = daysWithDataCount > 0 ? (sumTemp / daysWithDataCount).toFixed(1) : '0.0';
  const avgHumidityOverall = daysWithDataCount > 0 ? Math.round(sumHumidity / daysWithDataCount) : 0;

  const downloadCSVReport = () => {
    let csvContent = 'Day,Average Soil Moisture (%),Average Reservoir Level (cm),Average Temperature (°C),Average Humidity (%)\n';
    for (let i = 0; i < waterUsageRange.length; i++) {
      const w = waterUsageRange[i];
      const r = reservoirLevelsRange[i];
      const t = tempRange[i];
      const h = humidityRange[i];
      if (w.noData) {
        csvContent += `${w.day},No Data,No Data,No Data,No Data\n`;
      } else {
        csvContent += `${w.day},${w.amount}%,${r.level}cm,${t.temp}°C,${h.humidity}%\n`;
      }
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `agrisense_telemetry_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBack = () => {
    if (user && user.role !== 'Farmer') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isFarmer = user?.role === 'Farmer';

  return (
    <div className={isFarmer ? `dashboard-layout-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}` : `admin-layout-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      
      {/* Sidebar Navigation */}
      {isFarmer ? (
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
            
            <button className="nav-menu-item active">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              <span className="nav-label">Analytics Reports</span>
            </button>

            <button className="nav-menu-item" onClick={() => navigate('/weather')}>
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
      ) : (
        <aside className="admin-sidebar">
          <div className="sidebar-logo">
            <span className="logo-icon">🌾</span>
            <span className="logo-text">AgriSense</span>
          </div>
          
          <nav className="sidebar-nav-menu">
            <button className="nav-menu-item" onClick={() => navigate('/admin', { state: { activeTab: 'Overview' } })}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9"></rect>
                <rect x="14" y="3" width="7" height="5"></rect>
                <rect x="14" y="12" width="7" height="9"></rect>
                <rect x="3" y="16" width="7" height="5"></rect>
              </svg>
              <span className="nav-label">Overview</span>
            </button>

            <button className="nav-menu-item" onClick={() => navigate('/admin', { state: { activeTab: 'Gateways' } })}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
              <span className="nav-label">Gateways</span>
            </button>

            <button className="nav-menu-item" onClick={() => navigate('/admin', { state: { activeTab: 'Users' } })}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span className="nav-label">Users</span>
            </button>
            
            <button className="nav-menu-item" onClick={() => navigate('/admin-reports')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              <span className="nav-label">Admin Reports</span>
            </button>

            <button className="nav-menu-item active">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
              </svg>
              <span className="nav-label">Crop Analytics</span>
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
      )}

      {/* Primary Window */}
      <div className={isFarmer ? "dashboard-main-view" : "admin-main-view"}>
        {/* Header with Hamburger */}
        <header className={isFarmer ? "dashboard-header" : "admin-header"} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'white',
          padding: '1rem 2rem',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="hamburger-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Navigation">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h2>AgriSense Analytics</h2>
          </div>
          <div className="header-right">
            <button className="btn-export-csv" onClick={downloadCSVReport}>
              📥 Export CSV Report
            </button>
          </div>
        </header>

        <main className="reports-main" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Title Section */}
        <div className="reports-welcome">
          <h1>Crop Analytics & Insights</h1>
          <p>Historical irrigation cycles and environmental status values across Taguig City farm nodes</p>
        </div>

        {/* Date Range Picker trigger */}
        <div className="reports-datepicker-card">
          <div className="datepicker-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>Selected Analytics Range</span>
          </div>
          <button
            className="datepicker-trigger-btn"
            onClick={() => {
              setTempStartDate(startDate);
              setTempEndDate(endDate);
              setTempMonth(selectedMonth);
              setTempYear(selectedYear);
              setShowDatePicker(true);
            }}
          >
            <span>{MONTH_NAMES[selectedMonth]} {startDate}, {selectedYear} — {MONTH_NAMES[selectedMonth]} {endDate}, {selectedYear}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>

        {daysWithDataCount === 0 ? (
          <div className="reports-empty-state">
            <div className="reports-empty-icon">⚠️</div>
            <h3>No Sensor Readings Found</h3>
            <p>
              There are no sensor readings recorded in the database for {MONTH_NAMES[selectedMonth]} {startDate} to {MONTH_NAMES[selectedMonth]} {endDate}, {selectedYear}. Please verify your ESP32 connection or choose another range.
            </p>
          </div>
        ) : (
          <>
            {/* Day filter strip */}
            <div className="web-day-selector">
              <div className="datepicker-header" style={{ marginBottom: '0.5rem' }}>
                <span>Filter Telemetry by Day</span>
              </div>
              <div className="day-selector-scroll">
                <button
                  className={`day-selector-btn ${selectedAnalyticsDay === 'All' ? 'active' : ''}`}
                  onClick={() => setSelectedAnalyticsDay('All')}
                >
                  All Days
                </button>
                {waterUsageRange.map(item => {
                  const numDay = item.day.split(' ')[1];
                  return (
                    <button
                      key={item.day}
                      className={`day-selector-btn ${selectedAnalyticsDay === numDay ? 'active' : ''}`}
                      onClick={() => setSelectedAnalyticsDay(numDay)}
                    >
                      {item.day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Highlights Row */}
            <div className="reports-highlights-4col">
              <div className="highlight-card highlight-water">
                <div className="highlight-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                  </svg>
                </div>
                <div className="highlight-info">
                  <span className="highlight-value">{avgMoistureOverall}%</span>
                  <span className="highlight-label">Avg Soil Moisture</span>
                </div>
              </div>

              <div className="highlight-card highlight-reservoir">
                <div className="highlight-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
                <div className="highlight-info">
                  <span className="highlight-value">{avgLevel} cm</span>
                  <span className="highlight-label">Avg Reservoir Level</span>
                </div>
              </div>

              <div className="highlight-card highlight-yellow">
                <div className="highlight-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    <path d="M12 9v4"></path>
                    <path d="M12 17h.01"></path>
                  </svg>
                </div>
                <div className="highlight-info">
                  <span className="highlight-value">{avgTempOverall}°C</span>
                  <span className="highlight-label">Avg Temperature</span>
                </div>
              </div>

              <div className="highlight-card highlight-purple">
                <div className="highlight-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                  </svg>
                </div>
                <div className="highlight-info">
                  <span className="highlight-value">{avgHumidityOverall}%</span>
                  <span className="highlight-label">Avg Humidity</span>
                </div>
              </div>
            </div>

            {/* Chart Sections */}
            <div className="reports-grid">
              {/* Soil Moisture Bar Chart */}
              <div className="chart-card">
                <h3>Soil Moisture History</h3>
                <p className="chart-subtitle">Average soil moisture percentage measured by capacitive sensor</p>
                
                <div className="bar-chart-container">
                  <div className="chart-y-axis">
                    <span>100%</span>
                    <span>50%</span>
                    <span>0%</span>
                  </div>
                  <div className="chart-bars">
                    {waterUsageRange.map((item, index) => {
                      const numDay = item.day.split(' ')[1];
                      const barHeightPercent = item.amount;
                      const isSelected = selectedAnalyticsDay === 'All' || selectedAnalyticsDay === numDay;
                      return (
                        <div key={index} className="bar-wrapper" style={{ opacity: isSelected ? 1 : 0.25 }}>
                          <div className="bar-tooltip">{item.noData ? 'No Data' : item.label}</div>
                          <div className="bar-track" style={item.noData ? { border: '1px dashed #cbd5e1', background: 'none' } : {}}>
                            {!item.noData && <div className="bar-fill" style={{ height: `${barHeightPercent}%`, background: 'linear-gradient(to top, #10B981, #34D399)' }} />}
                          </div>
                          <span className="bar-day">{item.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Water Reservoir Level Trend */}
              <div className="chart-card">
                <h3>Water Reservoir Levels (cm)</h3>
                <p className="chart-subtitle">Daily height levels measured by ultrasonic sensor</p>
                
                <div className="reservoir-list">
                  {reservoirLevelsRange
                    .filter(item => {
                      const numDay = item.day.split(' ')[1];
                      return selectedAnalyticsDay === 'All' || selectedAnalyticsDay === numDay;
                    })
                    .map((item, index) => {
                      if (item.noData) {
                        return (
                          <div key={index} className="reservoir-row">
                            <span className="reservoir-day">{item.day}</span>
                            <span className="reservoir-value" style={{ color: '#94a3b8' }}>No Data</span>
                          </div>
                        );
                      }
                      const fillPercent = (item.level / 5.0) * 100;
                      const isLow = item.level < thresholds.reservoirMin;
                      return (
                        <div key={index} className="reservoir-row">
                          <span className="reservoir-day">{item.day}</span>
                          <div className="reservoir-track">
                            <div 
                              className={`reservoir-fill ${isLow ? 'low' : ''}`} 
                              style={{ width: `${fillPercent}%` }} 
                            />
                          </div>
                          <span className={`reservoir-value ${isLow ? 'low-text' : ''}`}>
                            {item.level.toFixed(1)} cm
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Air Temperature Trend */}
              <div className="chart-card">
                <h3>Air Temperature History (°C)</h3>
                <p className="chart-subtitle">Daily temperature status measured by DHT22 sensor</p>
                
                <div className="reservoir-list">
                  {tempRange
                    .filter(item => {
                      const numDay = item.day.split(' ')[1];
                      return selectedAnalyticsDay === 'All' || selectedAnalyticsDay === numDay;
                    })
                    .map((item, index) => {
                      if (item.noData) {
                        return (
                          <div key={index} className="reservoir-row">
                            <span className="reservoir-day">{item.day}</span>
                            <span className="reservoir-value" style={{ color: '#94a3b8' }}>No Data</span>
                          </div>
                        );
                      }
                      const fillPercent = Math.min((item.temp / 50.0) * 100, 100);
                      const isHot = item.temp > thresholds.tempMax;
                      return (
                        <div key={index} className="reservoir-row">
                          <span className="reservoir-day">{item.day}</span>
                          <div className="reservoir-track">
                            <div 
                              className="reservoir-fill" 
                              style={{ width: `${fillPercent}%`, backgroundColor: isHot ? '#EF4444' : '#F59E0B' }} 
                            />
                          </div>
                          <span className="reservoir-value" style={isHot ? { color: '#EF4444', fontWeight: 'bold' } : {}}>
                            {item.temp.toFixed(1)} °C
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Relative Humidity Trend */}
              <div className="chart-card">
                <h3>Relative Humidity History (%)</h3>
                <p className="chart-subtitle">Daily humidity levels measured by DHT22 sensor</p>
                
                <div className="reservoir-list">
                  {humidityRange
                    .filter(item => {
                      const numDay = item.day.split(' ')[1];
                      return selectedAnalyticsDay === 'All' || selectedAnalyticsDay === numDay;
                    })
                    .map((item, index) => {
                      if (item.noData) {
                        return (
                          <div key={index} className="reservoir-row">
                            <span className="reservoir-day">{item.day}</span>
                            <span className="reservoir-value" style={{ color: '#94a3b8' }}>No Data</span>
                          </div>
                        );
                      }
                      const fillPercent = item.humidity;
                      return (
                        <div key={index} className="reservoir-row">
                          <span className="reservoir-day">{item.day}</span>
                          <div className="reservoir-track">
                            <div 
                              className="reservoir-fill" 
                              style={{ width: `${fillPercent}%`, backgroundColor: '#8B5CF6' }} 
                            />
                          </div>
                          <span className="reservoir-value">
                            {item.humidity}%
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div> {/* Closes reports-grid */}
          </>
        )}
        </main>
      </div>

      {/* Date Range Selection Modal Overlay */}
      {showDatePicker && (
        <div className="reports-modal-backdrop">
          <div className="calendar-modal-card">
            <div className="calendar-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#10B981', cursor: 'pointer', outline: 'none' }}
                  onClick={() => {
                    if (tempMonth === 0) {
                      setTempMonth(11);
                      setTempYear(prev => prev - 1);
                    } else {
                      setTempMonth(prev => prev - 1);
                    }
                    setTempStartDate(1);
                    setTempEndDate(7);
                  }}
                >
                  ‹
                </button>
                <h3 style={{ margin: 0 }}>{MONTH_NAMES[tempMonth]} {tempYear}</h3>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#10B981', cursor: 'pointer', outline: 'none' }}
                  onClick={() => {
                    if (tempMonth === 11) {
                      setTempMonth(0);
                      setTempYear(prev => prev + 1);
                    } else {
                      setTempMonth(prev => prev + 1);
                    }
                    setTempStartDate(1);
                    setTempEndDate(7);
                  }}
                >
                  ›
                </button>
              </div>
              <button className="calendar-close-btn" onClick={() => setShowDatePicker(false)}>×</button>
            </div>
            <p className="calendar-modal-subtitle">Choose single day to auto-select a 7-day range</p>

            {/* Days grid row */}
            <div className="calendar-days-row">
              <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
            </div>
            <div className="calendar-grid">
              {(() => {
                const getDaysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();
                const daysInMonth = getDaysInMonth(tempMonth, tempYear);
                return Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                  const isStart = tempStartDate === d;
                  const isEnd = tempEndDate === d;
                  const inRange = tempStartDate && tempEndDate && d > tempStartDate && d < tempEndDate;
                  const isSelected = isStart || isEnd;
                  return (
                    <button
                      key={d}
                      className={`calendar-cell ${inRange ? 'in-range' : ''} ${isStart ? 'start-date' : ''} ${isEnd ? 'end-date' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        let targetEnd = d + 6;
                        if (targetEnd > daysInMonth) {
                          targetEnd = daysInMonth;
                          setTempStartDate(Math.max(1, daysInMonth - 6));
                          setTempEndDate(daysInMonth);
                        } else {
                          setTempStartDate(d);
                          setTempEndDate(targetEnd);
                        }
                      }}
                    >
                      {d}
                    </button>
                  );
                });
              })()}
            </div>

            <div className="selected-range-preview">
              Selected Range: {MONTH_NAMES[tempMonth]} {tempStartDate} — {MONTH_NAMES[tempMonth]} {tempEndDate}
            </div>

            <div className="calendar-actions">
              <button
                className="calendar-btn-cancel"
                onClick={() => {
                  setTempStartDate(startDate);
                  setTempEndDate(endDate);
                  setTempMonth(selectedMonth);
                  setTempYear(selectedYear);
                  setShowDatePicker(false);
                }}
              >
                Cancel
              </button>
              <button
                className="calendar-btn-apply"
                onClick={() => {
                  setStartDate(tempStartDate);
                  setEndDate(tempEndDate);
                  setSelectedMonth(tempMonth);
                  setSelectedYear(tempYear);
                  setShowDatePicker(false);
                }}
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
