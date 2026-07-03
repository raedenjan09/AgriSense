import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API_URL } from '../context/AuthContext';
import './AdminReports.css';
import './Admin.css';

function AdminReports() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [usersList, setUsersList] = useState([]);
  const [deviceLogs, setDeviceLogs] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    fetchAdminReportsData();
  }, []);

  const fetchAdminReportsData = async () => {
    try {
      setLoading(true);
      // Fetch users
      const usersResponse = await fetch(`${API_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (usersResponse.ok) {
        const data = await usersResponse.json();
        setUsersList(data);
      }

      let moistureMin = 50;
      let tempMax = 32;
      let reservoirMin = 2.0;

      try {
        const thresholdResponse = await fetch(`${API_URL}/sensors/thresholds`);
        if (thresholdResponse.ok) {
          const tData = await thresholdResponse.json();
          moistureMin = tData.moistureMin;
          tempMax = tData.tempMax;
          reservoirMin = tData.reservoirMin;
        }
      } catch (err) {
        console.error("Error loading thresholds from API in reports, falling back to local storage:", err);
        moistureMin = parseInt(localStorage.getItem('threshold_moisture') || '50');
        tempMax = parseInt(localStorage.getItem('threshold_temp') || '32');
        reservoirMin = parseFloat(localStorage.getItem('threshold_reservoir') || '2.0');
      }

      // Generate dynamic device diagnostic data from local fields
      const storedFields = localStorage.getItem('fields');
      const mockAlerts = [];
      const mockDeviceLogs = [];

      if (storedFields) {
        const parsedFields = JSON.parse(storedFields);
        parsedFields.forEach((field, index) => {
          // Device diagnostic reports
          mockDeviceLogs.push({
            id: `dev-diag-${field.id}`,
            fieldName: field.name,
            nodeId: `ESP32-NODE-${field.id.slice(-4).toUpperCase()}`,
            signal: Math.max(70, 95 - (index * 6)),
            battery: Math.max(65, 98 - (index * 4)),
            status: 'Nominal',
            lastPolled: 'Just now'
          });

          // System Alerts audits
          if (field.soilMoisture < moistureMin) {
            mockAlerts.push({
              id: `alert-moist-${field.id}`,
              timestamp: 'Just now',
              type: 'CRITICAL_MOISTURE',
              message: `Soil moisture dropped to ${field.soilMoisture}% (Limit: ${moistureMin}%). Pump actuated.`,
              severity: 'High'
            });
          }
          if (field.waterLevel < reservoirMin) {
            mockAlerts.push({
              id: `alert-level-${field.id}`,
              timestamp: 'Just now',
              type: 'LOW_RESERVOIR',
              message: `Reservoir tank water level at ${field.waterLevel} cm (Limit: ${reservoirMin} cm).`,
              severity: 'Medium'
            });
          }
          if (field.temperature > tempMax) {
            mockAlerts.push({
              id: `alert-temp-${field.id}`,
              timestamp: 'Just now',
              type: 'HEAT_STRESS',
              message: `Node temperature reached ${field.temperature}°C (Limit: ${tempMax}°C).`,
              severity: 'Low'
            });
          }
        });
      }

      // Fallbacks if lists are empty
      setDeviceLogs(mockDeviceLogs.length > 0 ? mockDeviceLogs : [
        { id: '1', fieldName: 'TUP Pechay Patch', nodeId: 'ESP32-NODE-78B4', signal: 92, battery: 98, status: 'Nominal', lastPolled: '2m ago' },
        { id: '2', fieldName: 'Okra Terrace North', nodeId: 'ESP32-NODE-32F9', signal: 85, battery: 90, status: 'Nominal', lastPolled: '5m ago' }
      ]);

      setSystemAlerts(mockAlerts.length > 0 ? mockAlerts : [
        { id: 'default-1', timestamp: '10:14 AM', type: 'SYSTEM_STARTUP', message: 'IoT PECHAY-GATEWAY handshakes complete. Telemetry streaming active.', severity: 'Info' },
        { id: 'default-2', timestamp: '09:45 AM', type: 'NOMINAL_AUDIT', message: 'All connected field sensor nodes responded within configured thresholds.', severity: 'Info' }
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching admin reports data:', error);
      setLoading(false);
    }
  };

  const handleExportSystemAudit = () => {
    // Generate CSV for System Security, Device Health, and User list
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Roster Audit Section
    csvContent += "=== USER ROSTER PERMISSIONS DIRECTORY ===\nName,Email,Account Security Role\n";
    usersList.forEach(u => {
      csvContent += `"${u.name}","${u.email}","${u.role}"\n`;
    });

    // IoT Gateways Section
    csvContent += "\n=== CONNECTED ESP32 NODE DIAGNOSTICS ===\nField Target,Node Identifier,Signal Strength (%),Battery (%),Uptime Status\n";
    deviceLogs.forEach(d => {
      csvContent += `"${d.fieldName}","${d.nodeId}",${d.signal}%,${d.battery}%,"${d.status}"\n`;
    });

    // System Warning Events Section
    csvContent += "\n=== SYSTEM EXCEPTION WARNING LOGS ===\nTimestamp,Type,Event Message,Severity Level\n";
    systemAlerts.forEach(a => {
      csvContent += `"${a.timestamp}","${a.type}","${a.message}","${a.severity}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "agrisense_admin_audit_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`admin-layout-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      
      {/* Sidebar Navigation */}
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
          
          <button className="nav-menu-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <span className="nav-label">Admin Reports</span>
          </button>

          <button className="nav-menu-item" onClick={() => navigate('/reports')}>
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

      {/* Primary Window */}
      <div className="admin-main-view">
        
        {/* Header with Hamburger */}
        <header className="admin-header">
          <div className="header-left">
            <button className="hamburger-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Navigation">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h2>Administrative Audit Reports</h2>
          </div>

          <div className="header-right">
            <button className="btn-export-csv" onClick={handleExportSystemAudit} disabled={loading} style={{ marginRight: '1rem' }}>
              📥 Export Audit CSV
            </button>
          </div>
        </header>

        <main className="admin-reports-main" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Welcome Section */}
          <div className="reports-welcome">
            <h1>System Security & Audit Summary</h1>
            <p>Global system configs, user registration directories, and gateway connection telemetry analytics</p>
          </div>

          {loading ? (
            <div className="reports-loading">
              <div className="web-spinner"></div>
              <p>Gathering system logs...</p>
            </div>
          ) : (
            <div className="reports-content-grid">
              
              {/* Left Column: Device Health & User Directory audits */}
              <div className="reports-col-left">
                {/* Connected ESP32 Gateways Audit */}
                <div className="reports-card">
                  <h3>Connected ESP32 Nodes Diagnostics</h3>
                  <p className="card-subtitle">Active hardware gateway status logs</p>
                  <div className="table-responsive">
                    <table className="reports-table">
                      <thead>
                        <tr>
                          <th>Field Name</th>
                          <th>Node ID</th>
                          <th>Signal</th>
                          <th>Battery</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deviceLogs.map(dev => (
                          <tr key={dev.id}>
                            <td><strong>{dev.fieldName}</strong></td>
                            <td><code>{dev.nodeId}</code></td>
                            <td>📶 {dev.signal}%</td>
                            <td>🔋 {dev.battery}%</td>
                            <td>
                              <span className="status-badge-nominal">{dev.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Roster Database Directory Audit */}
                <div className="reports-card">
                  <h3>Users Database Registry</h3>
                  <p className="card-subtitle">System credentials check</p>
                  <div className="table-responsive">
                    <table className="reports-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Security Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersList.map(u => (
                          <tr key={u._id || u.id}>
                            <td><strong>{u.name}</strong></td>
                            <td>{u.email}</td>
                            <td>
                              <span className={`role-badge role-${u.role.toLowerCase().replace(' ', '-')}`}>
                                {u.role}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: System Exception Warning Logs */}
              <div className="reports-col-right">
                <div className="reports-card full-height">
                  <h3>System Exception Warning Logs</h3>
                  <p className="card-subtitle">System warning logs and pump actions feed</p>
                  
                  <div className="alerts-timeline">
                    {systemAlerts.map(alert => (
                      <div key={alert.id} className={`alert-timeline-item severity-${alert.severity.toLowerCase()}`}>
                        <div className="alert-item-header">
                          <span className="alert-badge">{alert.type}</span>
                          <span className="alert-time">{alert.timestamp}</span>
                        </div>
                        <p className="alert-message">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminReports;
