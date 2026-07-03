import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, API_URL } from '../context/AuthContext';
import './Admin.css';

// Mock sensor device node monitoring data
const DEFAULT_DEVICES = [
  { id: 'dev-1', name: 'Node Gateway TUP-P1', status: 'Online', signal: 92, battery: 98, lastSeen: 'Just now' },
  { id: 'dev-2', name: 'Node Gateway BIC-T1', status: 'Online', signal: 85, battery: 92, lastSeen: '2m ago' },
  { id: 'dev-3', name: 'Node Gateway OKR-N1', status: 'Offline', signal: 0, battery: 0, lastSeen: '3h ago' },
];

const DEFAULT_USERS = [
  { id: 'u-1', name: 'Mark Girone C. Acosta', email: 'mark@example.com', role: 'Farmer' },
  { id: 'u-2', name: 'Kate Diane Ross L. Buensuceso', email: 'kate@example.com', role: 'Extension Worker' },
  { id: 'u-3', name: 'Raeden Jan F. Duque', email: 'raeden@example.com', role: 'Admin' },
  { id: 'u-4', name: 'Jay R. Tabigue', email: 'jay@example.com', role: 'Farmer' },
];

function Spinner() {
  return <div className="web-spinner"></div>;
}

function Admin() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();

  // Layout state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');

  // Dynamic alert thresholds state
  const [moistureMin, setMoistureMin] = useState(50);
  const [tempMax, setTempMax] = useState(32);
  const [reservoirMin, setReservoirMin] = useState(2.0);

  // Admin lists
  const [devices, setDevices] = useState(DEFAULT_DEVICES);
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [logs, setLogs] = useState([]);

  // Modals state
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [profilePictureUrl, setProfilePictureUrl] = useState(user?.profilePicture || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchThresholds = async () => {
    try {
      const response = await fetch(`${API_URL}/sensors/thresholds`);
      if (response.ok) {
        const data = await response.json();
        setMoistureMin(data.moistureMin);
        setTempMax(data.tempMax);
        setReservoirMin(data.reservoirMin);
        localStorage.setItem('threshold_moisture', data.moistureMin.toString());
        localStorage.setItem('threshold_temp', data.tempMax.toString());
        localStorage.setItem('threshold_reservoir', data.reservoirMin.toString());
      }
    } catch (error) {
      console.error('Error fetching thresholds from API, using localStorage fallback:', error);
      const storedMoisture = localStorage.getItem('threshold_moisture');
      const storedTemp = localStorage.getItem('threshold_temp');
      const storedReservoir = localStorage.getItem('threshold_reservoir');

      if (storedMoisture) setMoistureMin(parseInt(storedMoisture));
      if (storedTemp) setTempMax(parseInt(storedTemp));
      if (storedReservoir) setReservoirMin(parseFloat(storedReservoir));
    }
  };

  const location = useLocation();

  // Load threshold parameters and users directory on mount
  useEffect(() => {
    fetchThresholds();
    fetchUsers();
    if (location.state && location.state.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location]);

  // Dynamically map active crop fields to connected IoT devices and active alert logs
  useEffect(() => {
    const storedFields = localStorage.getItem('fields');
    if (storedFields) {
      const parsedFields = JSON.parse(storedFields);
      
      // Map fields to connected device nodes
      const mappedDevices = parsedFields.map((field, idx) => ({
        id: `dev-${field.id}`,
        name: `Node Gateway ${field.name}`,
        status: 'Online',
        signal: Math.max(70, 95 - (idx * 6)),
        battery: Math.max(65, 98 - (idx * 4)),
        lastSeen: 'Just now'
      }));
      setDevices(mappedDevices);

      // Generate dynamic logs based on current admin thresholds
      const dynamicLogs = [];
      parsedFields.forEach((field) => {
        if (field.soilMoisture < moistureMin) {
          dynamicLogs.push({
            id: `l-${field.id}-moist`,
            time: 'Just now',
            node: field.name,
            alert: `Soil moisture critical (${field.soilMoisture}%) - 5V Pump turned ON`
          });
        }
        if (field.waterLevel < reservoirMin) {
          dynamicLogs.push({
            id: `l-${field.id}-water`,
            time: 'Just now',
            node: field.name,
            alert: `Reservoir tank level low (${field.waterLevel} cm) - Refill warning`
          });
        }
        if (field.temperature > tempMax) {
          dynamicLogs.push({
            id: `l-${field.id}-temp`,
            time: 'Just now',
            node: field.name,
            alert: `Crop temperature stress detected (${field.temperature}°C)`
          });
        }
      });

      if (dynamicLogs.length > 0) {
        setLogs(dynamicLogs);
      } else {
        setLogs([
          { id: 'ok-1', time: '10:14 AM', node: 'System Audit', alert: 'All sensor nodes are currently operating within nominal parameters.' }
        ]);
      }
    }
  }, [moistureMin, tempMax, reservoirMin]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await fetch(`${API_URL}/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (response.ok) {
        setUsers(prev => prev.map(u => (u._id === userId || u.id === userId) ? { ...u, role: newRole } : u));
        alert('User role updated successfully!');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to update user role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Error updating user role');
    }
  };

  const handleSaveThresholds = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/sensors/thresholds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moistureMin,
          tempMax,
          reservoirMin
        })
      });
      
      if (response.ok) {
        localStorage.setItem('threshold_moisture', moistureMin.toString());
        localStorage.setItem('threshold_temp', tempMax.toString());
        localStorage.setItem('threshold_reservoir', reservoirMin.toString());
        alert('Global alert thresholds updated and synced successfully!');
      } else {
        alert('Failed to sync thresholds to database.');
      }
    } catch (error) {
      console.error('Error saving thresholds to API, saving to localStorage only:', error);
      localStorage.setItem('threshold_moisture', moistureMin.toString());
      localStorage.setItem('threshold_temp', tempMax.toString());
      localStorage.setItem('threshold_reservoir', reservoirMin.toString());
      alert('Global alert thresholds saved locally (Offline mode).');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const openSettings = () => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
    setProfilePictureUrl(user?.profilePicture || '');
    setIsSettingsModalVisible(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const signResponse = await fetch(`${API_URL}/auth/cloudinary-sign`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
      });
      if (!signResponse.ok) {
        throw new Error('Failed to obtain upload signature.');
      }
      const { signature, timestamp, apiKey, cloudName } = await signResponse.json();

      const data = new FormData();
      data.append('file', file);
      data.append('api_key', apiKey);
      data.append('timestamp', timestamp);
      data.append('signature', signature);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: data,
      });

      const result = await response.json();
      if (response.ok && result.secure_url) {
        setProfilePictureUrl(result.secure_url);
      } else {
        alert(result.error?.message || 'Failed to upload photo.');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('An error occurred during file upload.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim()) {
      alert('Name and Email are required.');
      return;
    }

    setIsUpdatingProfile(true);
    const result = await updateProfile(editName.trim(), editEmail.trim(), profilePictureUrl);
    setIsUpdatingProfile(false);

    if (result.success) {
      setIsSettingsModalVisible(false);
      alert('Profile updated successfully!');
    } else {
      alert(result.message || 'Failed to update profile.');
    }
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
          <button 
            className={`nav-menu-item ${activeTab === 'Overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('Overview')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9"></rect>
              <rect x="14" y="3" width="7" height="5"></rect>
              <rect x="14" y="12" width="7" height="9"></rect>
              <rect x="3" y="16" width="7" height="5"></rect>
            </svg>
            <span className="nav-label">Overview</span>
          </button>

          <button 
            className={`nav-menu-item ${activeTab === 'Gateways' ? 'active' : ''}`}
            onClick={() => setActiveTab('Gateways')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6.01" y2="6"></line>
              <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
            <span className="nav-label">Gateways</span>
          </button>

          <button 
            className={`nav-menu-item ${activeTab === 'Users' ? 'active' : ''}`}
            onClick={() => setActiveTab('Users')}
          >
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

          <button className="nav-menu-item" onClick={() => navigate('/reports')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
              <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
            </svg>
            <span className="nav-label">Crop Analytics</span>
          </button>

          <button className="nav-menu-item" onClick={openSettings}>
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
            <h2>System Administration</h2>
          </div>

          <div className="header-right">
            <div className="admin-profile-trigger" onClick={openSettings}>
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="Avatar" className="admin-avatar" />
              ) : (
                <div className="admin-avatar-fallback">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                </div>
              )}
              <div className="admin-profile-meta">
                <span className="admin-name">{user?.name || 'Administrator'}</span>
                <span className="admin-role-tag">{user?.role || 'Admin'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Admin Dashboard Content */}
        <main className="admin-content-grid">
          
          {/* Welcome Card */}
          <div className="admin-welcome-card">
            <h1>Welcome to the Administrative Center, {user?.name ? user.name.split(' ')[0] : 'Admin'}! ⚙️</h1>
            <p>Monitor connected IoT farm gateways, configure dynamic alert parameters, and audit user permissions.</p>
          </div>

          {/* Core Controls Section */}
          {activeTab === 'Overview' && (
            <div className="admin-main-columns">
              {/* Left Column: Security Logs */}
              <div className="admin-col-left">
                <div className="admin-section-card">
                  <h3>System Security & Diagnostic Logs</h3>
                  <p className="card-subtitle">Live events feed from connected Taguig farm gateways</p>
                  <div className="logs-timeline">
                    {logs.map(log => (
                      <div key={log.id} className="log-item">
                        <div className="log-time-badge">{log.time}</div>
                        <div className="log-body">
                          <span className="log-node">[{log.node}]</span>
                          <span className="log-text">{log.alert}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Threshold Config */}
              <div className="admin-col-right">
                <div className="admin-section-card">
                  <h3>Threshold Alarm Configuration</h3>
                  <p className="card-subtitle">Dynamically customize parameters that trigger automated system alerts</p>
                  
                  <form onSubmit={handleSaveThresholds} className="thresholds-form">
                    <div className="form-group-range">
                      <div className="range-label-row">
                        <label>Min Soil Moisture Limit</label>
                        <span className="range-value">{moistureMin}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="20" 
                        max="75" 
                        value={moistureMin} 
                        onChange={(e) => setMoistureMin(parseInt(e.target.value))}
                        className="slider-input"
                      />
                      <span className="slider-hint">Triggers automated water pump actuation when level drops below this value.</span>
                    </div>

                    <div className="form-group-range">
                      <div className="range-label-row">
                        <label>Max Air Temperature Limit</label>
                        <span className="range-value">{tempMax}°C</span>
                      </div>
                      <input 
                        type="range" 
                        min="25" 
                        max="40" 
                        value={tempMax} 
                        onChange={(e) => setTempMax(parseInt(e.target.value))}
                        className="slider-input"
                      />
                      <span className="slider-hint">Triggers heat stress warnings on agricultural extension nodes.</span>
                    </div>

                    <div className="form-group-range">
                      <div className="range-label-row">
                        <label>Min Reservoir Water Height</label>
                        <span className="range-value">{reservoirMin} cm</span>
                      </div>
                      <input 
                        type="range" 
                        min="1.0" 
                        max="3.5" 
                        step="0.1" 
                        value={reservoirMin} 
                        onChange={(e) => setReservoirMin(parseFloat(e.target.value))}
                        className="slider-input"
                      />
                      <span className="slider-hint">Warns users to replenish water supply tank before 5V pump runs dry.</span>
                    </div>

                    <button type="submit" className="btn-save-thresholds">
                      Apply Global Settings
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Gateways' && (
            <div className="admin-main-columns" style={{ gridTemplateColumns: '1fr' }}>
              <div className="admin-section-card">
                <h3>IoT Microcontroller Gateway Status</h3>
                <p className="card-subtitle">Uptime and signal connectivity metrics for remote node ESP32s</p>
                
                <div className="device-status-list">
                  {devices.map(device => (
                    <div key={device.id} className="device-item">
                      <div className="device-meta-row">
                        <div>
                          <h4>{device.name}</h4>
                          <span className="device-id-label">Device UUID: {device.id} • Seen {device.lastSeen}</span>
                        </div>
                        <span className={`device-status-tag ${device.status.toLowerCase()}`}>
                          {device.status}
                        </span>
                      </div>
                      
                      {device.status === 'Online' && (
                        <div className="device-metrics-row">
                          <div className="dev-metric">
                            <span className="dev-metric-lbl">Signal Strength</span>
                            <span className="dev-metric-val">📶 {device.signal}%</span>
                          </div>
                          <div className="dev-metric">
                            <span className="dev-metric-lbl">Battery Capacity</span>
                            <span className="dev-metric-val">🔋 {device.battery}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Users' && (
            <div className="admin-main-columns" style={{ gridTemplateColumns: '1fr' }}>
              <div className="admin-section-card">
                <h3>User Accounts Directory</h3>
                <p className="card-subtitle">Registered system users and authorization credentials</p>
                <div className="user-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Security Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u._id || u.id}>
                          <td><strong>{u.name}</strong></td>
                          <td>{u.email}</td>
                          <td>
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u._id || u.id, e.target.value)}
                              className="admin-role-selector"
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                backgroundColor: 'white',
                                color: '#334155',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="Farmer">Farmer</option>
                              <option value="Extension Worker">Extension Worker</option>
                              <option value="Admin">Administrator</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>

      </div>

      {/* --- APP & USER SETTINGS MODAL --- */}
      {isSettingsModalVisible && (
        <div className="modal-backdrop">
          <div className="modal-body settings-modal-body">
            <h2>Profile & Settings</h2>
            
            <form onSubmit={handleSaveSettings} className="modal-form">
              
              <div className="photo-uploader-container">
                <label className="photo-input-label">
                  <div className="photo-avatar-container">
                    {profilePictureUrl ? (
                      <img src={profilePictureUrl} alt="Preview" className="photo-preview-image" />
                    ) : (
                      <div className="photo-preview-fallback">
                        {editName ? editName.charAt(0).toUpperCase() : 'A'}
                      </div>
                    )}
                    {uploadingImage ? (
                      <div className="photo-loading-overlay">
                        <Spinner />
                      </div>
                    ) : (
                      <div className="photo-edit-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                          <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    disabled={uploadingImage}
                    style={{ display: 'none' }}
                  />
                </label>
                <span className="photo-upload-hint">Click on avatar to change profile photo</span>
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text"
                  placeholder="Enter your full name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="modal-control"
                  disabled={isUpdatingProfile}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email"
                  placeholder="Enter your email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="modal-control"
                  disabled={isUpdatingProfile}
                  required
                />
              </div>

              <div className="modal-actions-row">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsSettingsModalVisible(false)} disabled={isUpdatingProfile}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit" disabled={isUpdatingProfile || uploadingImage}>
                  {isUpdatingProfile ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Admin;
