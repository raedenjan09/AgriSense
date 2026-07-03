import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API_URL } from '../context/AuthContext';
import { generateCropInsights } from '../services/aiService';
import './Dashboard.css';

const DEFAULT_FIELDS = [];

const CROP_TYPES = ['Pechay', 'Tomato', 'Eggplant', 'Okra', 'Chili'];
const GROWTH_STAGES = ['Seedling', 'Vegetative', 'Flowering', 'Harvesting'];

// Mock weather forecast for Taguig City
const MOCK_WEATHER = {
  temp: 29,
  condition: 'Cloudy / Potential Rain',
  rainProb: 75,
  humidity: 78,
};

function Spinner() {
  return <div className="web-spinner"></div>;
}

function Dashboard() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();

  // Layout states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Local state variables
  const [fields, setFields] = useState([]);
  const [tempUnit, setTempUnit] = useState('C');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [selectedField, setSelectedField] = useState(null);

  // Field creation form state
  const [newFieldName, setNewFieldName] = useState('');
  const [newCropType, setNewCropType] = useState('Pechay');
  const [newFieldArea, setNewFieldArea] = useState('');

  // Observation form state
  const [recordDate, setRecordDate] = useState('');
  const [recordStage, setRecordStage] = useState('Seedling');
  const [recordObservationText, setRecordObservationText] = useState('');

  // AI loading and insights state
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);

  // User Profile Settings State
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [profilePictureUrl, setProfilePictureUrl] = useState(user?.profilePicture || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Dynamic alert thresholds state
    const [moistureMin, setMoistureMin] = useState(50);
  const [tempMax, setTempMax] = useState(32);
  const [reservoirMin, setReservoirMin] = useState(2.0);

  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const fetchWeatherData = async () => {
    try {
      const response = await fetch(`${API_URL}/weather/forecast`);
      if (response.ok) {
        const data = await response.json();
        setWeatherData(data);
      }
    } catch (error) {
      console.warn('Error fetching weather data in web dashboard:', error);
    } finally {
      setWeatherLoading(false);
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
      }
    } catch (error) {
      console.warn('Error fetching alert thresholds from API:', error);
      const storedMoisture = localStorage.getItem('threshold_moisture');
      const storedTemp = localStorage.getItem('threshold_temp');
      const storedReservoir = localStorage.getItem('threshold_reservoir');
      if (storedMoisture) setMoistureMin(parseInt(storedMoisture));
      if (storedTemp) setTempMax(parseInt(storedTemp));
      if (storedReservoir) setReservoirMin(parseFloat(storedReservoir));
    }
  };

  // Fetch latest sensor reading from backend and update all fields
  const fetchLatestSensorData = async () => {
    try {
      const response = await fetch(`${API_URL}/sensors/latest`);
      if (response.ok) {
        const sensorData = await response.json();
        if (sensorData && sensorData.soilMoisture !== undefined) {
          setFields((prevFields) => {
            const updatedFields = prevFields.map((field) => {
              return {
                ...field,
                soilMoisture: sensorData.soilMoisture,
                temperature: sensorData.temperature,
                humidity: sensorData.humidity,
                waterLevel: sensorData.waterLevel,
              };
            });
            const actuatedFields = checkPumpActuation(updatedFields);

            // Persist
            localStorage.setItem('fields', JSON.stringify(actuatedFields));

            // Update details view
            setSelectedField((prev) => {
              if (prev) {
                const updatedSelected = actuatedFields.find((f) => f.id === prev.id);
                return updatedSelected || prev;
              }
              return prev;
            });

            return actuatedFields;
          });
        }
      }
    } catch (error) {
      console.warn('Error fetching latest sensor data:', error);
    }
  };

  // Initial load
  useEffect(() => {
    loadFields();
    fetchLatestSensorData();
    fetchThresholds();
    fetchWeatherData();

    const interval = setInterval(() => {
      fetchLatestSensorData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadFields = () => {
    try {
      const storedFields = localStorage.getItem('fields');
      if (storedFields) {
        let loadedFields = JSON.parse(storedFields);
        const actuatedFields = checkPumpActuation(loadedFields);
        setFields(actuatedFields);
      } else {
        localStorage.setItem('fields', JSON.stringify(DEFAULT_FIELDS));
        setFields(DEFAULT_FIELDS);
      }
    } catch (error) {
      console.error('Error loading fields:', error);
    }
  };

  const checkPumpActuation = (fieldsList) => {
    return fieldsList.map((field) => {
      let pumpStatus = field.pumpStatus || 'OFF';
      let soilMoisture = field.soilMoisture;
      let waterLevel = field.waterLevel;

      // Simple local loop simulation (if rain is not forecast or offline)
      if (soilMoisture < 50 && waterLevel > 2.0 && pumpStatus === 'OFF') {
        pumpStatus = 'ON';
      } else if (soilMoisture >= 70 && pumpStatus === 'ON') {
        pumpStatus = 'OFF';
      }

      return { ...field, pumpStatus };
    });
  };

  const saveFields = (updatedFields) => {
    const checkedFields = checkPumpActuation(updatedFields);
    localStorage.setItem('fields', JSON.stringify(checkedFields));
    setFields(checkedFields);
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
      alert(error.message || 'An error occurred during file upload.');
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

  const formatTemp = (celsiusVal) => {
    if (tempUnit === 'F') {
      const fahrenheit = Math.round((celsiusVal * 9) / 5 + 32);
      return `${fahrenheit}°F`;
    }
    return `${celsiusVal}°C`;
  };

  const getAverageMoisture = () => {
    if (fields.length === 0) return '0%';
    const total = fields.reduce((sum, field) => sum + field.soilMoisture, 0);
    return `${Math.round(total / fields.length)}%`;
  };

  const getAverageTemp = () => {
    if (fields.length === 0) return formatTemp(0);
    const total = fields.reduce((sum, field) => sum + field.temperature, 0);
    return formatTemp(Math.round(total / fields.length));
  };

  const getAverageHumidity = () => {
    if (fields.length === 0) return '0%';
    const total = fields.reduce((sum, field) => sum + field.humidity, 0);
    return `${Math.round(total / fields.length)}%`;
  };

  const getAverageWaterLevel = () => {
    if (fields.length === 0) return '0.0 cm';
    const total = fields.reduce((sum, field) => sum + field.waterLevel, 0);
    return `${(total / fields.length).toFixed(1)} cm`;
  };

  const getActiveAlerts = () => {
    const alertsList = [];
    fields.forEach((field) => {
      if (field.soilMoisture < moistureMin) {
        alertsList.push(`Soil moisture low in **${field.name}** (${field.soilMoisture}%) - 5V Pump activated.`);
      }
      if (field.waterLevel < reservoirMin) {
        alertsList.push(`Reservoir level low in **${field.name}** (${field.waterLevel} cm) - Refill tank.`);
      }
      if (field.temperature > tempMax) {
        alertsList.push(`Heat stress danger in **${field.name}** (${field.temperature}°C).`);
      }
    });
    return alertsList;
  };

  const handleAddField = (e) => {
    e.preventDefault();
    if (!newFieldName.trim() || !newFieldArea.trim()) {
      alert('Please enter a field name and area size.');
      return;
    }

    const parsedArea = parseFloat(newFieldArea);
    if (isNaN(parsedArea) || parsedArea <= 0) {
      alert('Please enter a valid positive number for area.');
      return;
    }

    const newField = {
      id: Date.now().toString(),
      name: newFieldName.trim(),
      cropType: newCropType,
      soilMoisture: 0,
      temperature: 0,
      humidity: 0,
      waterLevel: 0,
      area: parsedArea,
      pumpStatus: 'OFF',
      cropRecords: {
        plantingDate: new Date().toISOString().split('T')[0],
        growthStage: 'Seedling',
        observations: [],
      },
    };

    const updatedFields = [...fields, newField];
    saveFields(updatedFields);

    setNewFieldName('');
    setNewCropType('Pechay');
    setNewFieldArea('');
    setIsAddModalVisible(false);
  };

  const handleDeleteField = (id) => {
    if (window.confirm('Are you sure you want to delete this field and its sensor readings?')) {
      const updatedFields = fields.filter((field) => field.id !== id);
      saveFields(updatedFields);
      setSelectedField(null);
    }
  };

  const handleSimulateIrrigation = () => {
    if (!selectedField) return;

    const newMoisture = Math.min(selectedField.soilMoisture + 15, 95);
    const updatedField = {
      ...selectedField,
      soilMoisture: newMoisture,
      pumpStatus: newMoisture >= 70 ? 'OFF' : 'ON',
    };

    const updatedFields = fields.map((field) => (field.id === selectedField.id ? updatedField : field));

    saveFields(updatedFields);
    setSelectedField(updatedField);

    if (aiInsights) {
      setAiInsights(generateCropInsights(updatedField, weatherData?.daily?.[0]?.rainProbability || 0));
    }

    alert(`Irrigation Applied! 5V pump actuated manually. Moisture level is now ${newMoisture}%. Pump is ${updatedField.pumpStatus}.`);
  };

  const handleAddCropObservation = (e) => {
    e.preventDefault();
    if (!recordObservationText.trim()) {
      alert('Please enter some observation notes.');
      return;
    }

    const dateStr = recordDate.trim() || new Date().toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' });

    const newObservation = {
      id: Date.now().toString(),
      date: dateStr,
      note: recordObservationText.trim(),
    };

    const currentRecords = selectedField.cropRecords || { plantingDate: '', growthStage: 'Seedling', observations: [] };
    const updatedRecords = {
      ...currentRecords,
      growthStage: recordStage,
      plantingDate: recordDate || currentRecords.plantingDate,
      observations: [newObservation, ...currentRecords.observations],
    };

    const updatedField = { ...selectedField, cropRecords: updatedRecords };
    const updatedFields = fields.map((field) => (field.id === selectedField.id ? updatedField : field));

    saveFields(updatedFields);
    setSelectedField(updatedField);
    setRecordObservationText('');
    alert('Crop monitoring record updated successfully.');
  };

  const handleRunAiInsights = () => {
    if (!selectedField) return;

    setIsAiLoading(true);
    setAiInsights(null);

    setTimeout(() => {
      const insightsResult = generateCropInsights(selectedField, weatherData?.daily?.[0]?.rainProbability || 0);
      setAiInsights(insightsResult);
      setIsAiLoading(false);
    }, 1200);
  };

  const openFieldDetails = (field) => {
    setSelectedField(field);
    setRecordStage(field.cropRecords?.growthStage || 'Seedling');
    setRecordDate(field.cropRecords?.plantingDate || '');
    setRecordObservationText('');
    setAiInsights(null);
  };

  const alerts = getActiveAlerts();

  return (
    <div className={`dashboard-layout-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">🌾</span>
          <span className="logo-text">AgriSense</span>
        </div>
        
        <nav className="sidebar-nav-menu">
          <button className="nav-menu-item active">
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

          <button className="nav-menu-item" onClick={() => navigate('/weather')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
              <circle cx="12" cy="12" r="4"></circle>
            </svg>
            <span className="nav-label">Weather</span>
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

      {/* Primary Window View */}
      <div className="dashboard-main-view">
        
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-left">
            <button className="hamburger-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Navigation">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h2>Farm Sensor Nodes</h2>
          </div>

          <div className="header-user-menu">
            <div className="profile-btn" onClick={openSettings}>
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

        {/* Main Dashboard Panel */}
        <main className="dashboard-content">
          
          {/* Welcome Banner Row with Weather Forecast */}
          <div className="welcome-banner-row">
            <div className="welcome-banner">
              <h1>Welcome Back, {user?.name || 'Farmer'}! 👋</h1>
              <p>Taguig City IoT Farm Node Gateway</p>
            </div>
            
            {/* Weather widget */}
            <div className="weather-widget-card" onClick={() => navigate('/weather')} style={{ cursor: 'pointer' }}>
              {weatherLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minWidth: '100px' }}>
                  <Spinner />
                </div>
              ) : weatherData ? (
                <>
                  <div className="weather-main-row">
                    <span className="weather-temp">{weatherData.current.icon} {Math.round(weatherData.current.temperature)}°C</span>
                    <span className="weather-desc">{weatherData.current.description}</span>
                  </div>
                  <div className="weather-meta-row">
                    <span>Rain Forecast: <strong>{weatherData.daily[0]?.rainProbability}%</strong></span>
                    <span>Humidity: <strong>{weatherData.current.humidity}%</strong></span>
                  </div>
                </>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '13px', padding: '6px' }}>Weather unavailable</div>
              )}
            </div>
          </div>

          {/* Alerts Banner */}
          {alerts.length > 0 && (
            <div className="alerts-notification-card">
              <div className="alert-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="alert-icon">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>Threshold Exceeded Alerts</h3>
              </div>
              <ul className="alerts-list">
                {alerts.map((alertText, idx) => {
                  const parts = alertText.split('**');
                  return (
                    <li key={idx}>
                      • {parts.map((part, partIdx) => 
                        partIdx % 2 === 1 ? <strong key={partIdx}>{part}</strong> : part
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Global Statistics Grid */}
          <div className="global-stats-grid">
            <div className="stat-card stat-fields">
              <div className="stat-card-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="9"></rect>
                  <rect x="14" y="3" width="7" height="5"></rect>
                  <rect x="14" y="12" width="7" height="9"></rect>
                  <rect x="3" y="16" width="7" height="5"></rect>
                </svg>
                <span>Active Fields</span>
              </div>
              <span className="stat-value">{fields.length}</span>
            </div>

            <div className="stat-card stat-moisture">
              <div className="stat-card-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                </svg>
                <span>Avg Moisture</span>
              </div>
              <span className="stat-value">{getAverageMoisture()}</span>
            </div>

            <div className="stat-card stat-temp">
              <div className="stat-card-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
                </svg>
                <span>Avg Temp</span>
              </div>
              <span className="stat-value">{getAverageTemp()}</span>
            </div>

            <div className="stat-card stat-reservoir">
              <div className="stat-card-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                <span>Avg Reservoir</span>
              </div>
              <span className="stat-value">{getAverageWaterLevel()}</span>
            </div>
          </div>

          {/* Main Columns: Left Crop Nodes, Right Field Detail */}
          <div className="main-columns">
            
            {/* Left Crop Node Column */}
            <div className="column-nodes">
              <div className="column-title-row">
                <h3>Crops & Sensor Nodes</h3>
                <button className="btn-add-node" onClick={() => setIsAddModalVisible(true)}>
                  + Add Field Node
                </button>
              </div>

              {fields.length === 0 ? (
                <div className="empty-nodes-view">
                  <p>No active fields. Click "Add Field Node" to begin monitoring.</p>
                </div>
              ) : (
                <div className="nodes-list">
                  {fields.map((field) => (
                    <div 
                      key={field.id} 
                      className={`node-item-card ${selectedField?.id === field.id ? 'active' : ''}`}
                      onClick={() => openFieldDetails(field)}
                    >
                      <div className="node-info">
                        <h4>{field.name}</h4>
                        <div className="node-badges">
                          <span className="node-crop-badge">{field.cropType}</span>
                          <span className="node-details-text">
                            {field.area} acres • Stage: {field.cropRecords?.growthStage || 'Seedling'}
                          </span>
                        </div>
                      </div>
                      <div className="node-metrics">
                        <span className="metric-badge moisture">
                          💧 {field.soilMoisture}%
                        </span>
                        <span className="metric-badge water">
                          🪣 {field.waterLevel}cm
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Actions Panel */}
              <div className="quick-actions-panel">
                <h3>Quick Actions</h3>
                <div className="actions-grid">
                  <button className="btn-action-primary" onClick={() => setIsAddModalVisible(true)}>
                    Add Field Node
                  </button>
                  <button className="btn-action-secondary" onClick={() => navigate('/reports')}>
                    View Crop Analytics
                  </button>
                  <button className="btn-action-secondary" onClick={openSettings}>
                    App Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Right Field Detail Column */}
            <div className="column-details">
              {selectedField ? (
                <div className="field-details-card">
                  
                  {/* Details Header */}
                  <div className="details-header-row">
                    <div className="details-title-area">
                      <h2>{selectedField.name}</h2>
                      <span className="crop-type-label">Category: {selectedField.cropType}</span>
                    </div>
                    <button className="btn-delete-node" onClick={() => handleDeleteField(selectedField.id)}>
                      Delete Field Node
                    </button>
                  </div>

                  {/* Crop Stats / Meta */}
                  <div className="details-meta-bar">
                    <span>Size Area: <strong>{selectedField.area} acres</strong></span>
                    <span>Planting Date: <strong>{selectedField.cropRecords?.plantingDate || 'N/A'}</strong></span>
                  </div>

                  {/* Telemetry Sensor Card Grid */}
                  <div className="telemetry-grid">
                    {/* Moisture */}
                    <div className="telemetry-card">
                      <div className="telemetry-header">
                        <span>Soil Moisture</span>
                        <span className="telemetry-emoji">💧</span>
                      </div>
                      <span className="telemetry-value">{selectedField.soilMoisture}%</span>
                    </div>

                    {/* Water Reservoir Level */}
                    <div className="telemetry-card">
                      <div className="telemetry-header">
                        <span>Water Reservoir</span>
                        <span className="telemetry-emoji">🪣</span>
                      </div>
                      <span className="telemetry-value">{selectedField.waterLevel} cm</span>
                      <span className="telemetry-pump-badge" style={{ backgroundColor: selectedField.pumpStatus === 'ON' ? '#ecfdf5' : '#fef2f2', color: selectedField.pumpStatus === 'ON' ? '#059669' : '#dc2626' }}>
                        Pump: {selectedField.pumpStatus}
                      </span>
                    </div>

                    {/* Temperature */}
                    <div className="telemetry-card">
                      <div className="telemetry-header">
                        <span>Air Temperature</span>
                        <span className="telemetry-emoji">🌡️</span>
                      </div>
                      <span className="telemetry-value">{formatTemp(selectedField.temperature)}</span>
                      <div className="unit-toggle-row">
                        <button className={`unit-btn ${tempUnit === 'C' ? 'active' : ''}`} onClick={() => setTempUnit('C')}>°C</button>
                        <button className={`unit-btn ${tempUnit === 'F' ? 'active' : ''}`} onClick={() => setTempUnit('F')}>°F</button>
                      </div>
                    </div>

                    {/* Humidity */}
                    <div className="telemetry-card">
                      <div className="telemetry-header">
                        <span>Air Humidity</span>
                        <span className="telemetry-emoji">☁️</span>
                      </div>
                      <span className="telemetry-value">{selectedField.humidity}%</span>
                      <span className="telemetry-subtext">DHT11 Gateway Sensor</span>
                    </div>
                  </div>

                  {/* AI Insights Diagnoser Section */}
                  <div className="ai-insights-section">
                    <div className="ai-section-header">
                      <svg className="ai-copilot-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 16v-4M12 8h.01"></path>
                      </svg>
                      <h3>AgriSense AI Copilot Diagnostic Analysis</h3>
                    </div>

                    {!aiInsights && !isAiLoading && (
                      <button className="btn-run-ai" onClick={handleRunAiInsights}>
                        ⚡ Run Real-Time AI Diagnostic Analysis
                      </button>
                    )}

                    {isAiLoading && (
                      <div className="ai-loading-state">
                        <Spinner />
                        <span>Analyzing sensor telemetry and weather forecasts...</span>
                      </div>
                    )}

                    {aiInsights && !isAiLoading && (
                      <div className={`ai-report-card urgency-${aiInsights.urgency.toLowerCase()}`}>
                        <div className="report-badge-row">
                          <span className="urgency-badge">{aiInsights.urgency} Urgency</span>
                          <span className="report-time">Generated {aiInsights.timestamp}</span>
                        </div>
                        <p className="report-summary">
                          {aiInsights.summary.replace(/\*\*/g, '')}
                        </p>
                        <ul className="insights-bullet-list">
                          {aiInsights.insights.map((insightText, index) => {
                            const cleaned = insightText.replace(/\*\*/g, '');
                            return <li key={index}>{cleaned}</li>;
                          })}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Observation Records Timeline */}
                  <div className="observations-section">
                    <h3>Observations & Crop Stages</h3>
                    
                    <form onSubmit={handleAddCropObservation} className="observation-form">
                      <div className="form-row-observation">
                        <div className="form-group-obs">
                          <label>Growth Stage</label>
                          <select 
                            className="select-stage"
                            value={recordStage}
                            onChange={(e) => setRecordStage(e.target.value)}
                          >
                            {GROWTH_STAGES.map(stage => (
                              <option key={stage} value={stage}>{stage}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group-obs">
                          <label>Planting / Log Date</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 2026-06-01"
                            value={recordDate}
                            onChange={(e) => setRecordDate(e.target.value)}
                            className="input-obs-date"
                          />
                        </div>
                      </div>

                      <div className="form-group-obs">
                        <label>Observation Notes</label>
                        <textarea
                          rows="3"
                          placeholder="Describe leaf health, pests, or flowers..."
                          value={recordObservationText}
                          onChange={(e) => setRecordObservationText(e.target.value)}
                          className="textarea-obs"
                          required
                        />
                      </div>

                      <button type="submit" className="btn-submit-observation">
                        Save Record Log
                      </button>
                    </form>

                    {/* Observations Timeline List */}
                    <div className="timeline-list">
                      {selectedField.cropRecords?.observations?.length === 0 ? (
                        <span className="empty-timeline-text">No observation records log yet. Write one above.</span>
                      ) : (
                        selectedField.cropRecords?.observations?.map((obs) => (
                          <div key={obs.id} className="timeline-item">
                            <div className="timeline-dot" />
                            <div className="timeline-content">
                              <span className="timeline-date">{obs.date}</span>
                              <p className="timeline-note">{obs.note}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="empty-details-view">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-illustration">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  <h3>Select a Sensor Node</h3>
                  <p>Click on any field node on the left to view detailed sensor telemetry, simulation settings, AI crop diagnostics, and records history.</p>
                </div>
              )}
            </div>

          </div>

        </main>

      </div>

      {/* --- ADD FIELD MODAL --- */}
      {isAddModalVisible && (
        <div className="modal-backdrop">
          <div className="modal-body">
            <h2>Add New Crop Field Node</h2>
            <form onSubmit={handleAddField} className="modal-form">
              
              <div className="form-group">
                <label>Field Identifier Name</label>
                <input 
                  type="text"
                  placeholder="e.g. TUP Chili patch"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  className="modal-control"
                  required
                />
              </div>

              <div className="form-group">
                <label>Field Area Size (Acres)</label>
                <input 
                  type="number"
                  step="0.1"
                  placeholder="e.g. 5.5"
                  value={newFieldArea}
                  onChange={(e) => setNewFieldArea(e.target.value)}
                  className="modal-control"
                  required
                />
              </div>

              <div className="form-group">
                <label>Select Crop Category (Urban Crops)</label>
                <div className="crop-selector-grid">
                  {CROP_TYPES.map((crop) => (
                    <button
                      key={crop}
                      type="button"
                      className={`crop-option-btn ${newCropType === crop ? 'active' : ''}`}
                      onClick={() => setNewCropType(crop)}
                    >
                      {crop}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-actions-row">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsAddModalVisible(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Save Node
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- USER PROFILE SETTINGS MODAL --- */}
      {isSettingsModalVisible && (
        <div className="modal-backdrop">
          <div className="modal-body settings-modal-body">
            <h2>Profile & Settings</h2>
            
            <form onSubmit={handleSaveSettings} className="modal-form">
              
              {/* Profile Photo Uploader */}
              <div className="photo-uploader-container">
                <label className="photo-input-label">
                  <div className="photo-avatar-container">
                    {profilePictureUrl ? (
                      <img src={profilePictureUrl} alt="Preview" className="photo-preview-image" />
                    ) : (
                      <div className="photo-preview-fallback">
                        {editName ? editName.charAt(0).toUpperCase() : 'U'}
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

export default Dashboard;
