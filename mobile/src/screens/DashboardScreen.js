import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  Modal, 
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth, API_URL } from '../context/AuthContext';
import { generateCropInsights } from '../services/aiService';

const DEFAULT_FIELDS = [
  { 
    id: '1', 
    name: 'TUP Pechay Patch', 
    cropType: 'Pechay', 
    soilMoisture: 68, 
    temperature: 24, 
    humidity: 72, 
    waterLevel: 4.2, 
    area: 5, 
    pumpStatus: 'OFF', 
    cropRecords: { 
      plantingDate: '2026-06-01', 
      growthStage: 'Vegetative', 
      observations: [{ id: '1a', date: '06/15/2026', note: 'First sprouts emerged.' }] 
    } 
  },
  { 
    id: '2', 
    name: 'Bicutan Tomatoes', 
    cropType: 'Tomato', 
    soilMoisture: 58, 
    temperature: 26, 
    humidity: 65, 
    waterLevel: 3.5, 
    area: 12, 
    pumpStatus: 'OFF', 
    cropRecords: { 
      plantingDate: '2026-05-20', 
      growthStage: 'Flowering', 
      observations: [{ id: '2a', date: '06/10/2026', note: 'Flower buds opening.' }] 
    } 
  },
  { 
    id: '3', 
    name: 'Okra Terrace North', 
    cropType: 'Okra', 
    soilMoisture: 42, 
    temperature: 28, 
    humidity: 55, 
    waterLevel: 1.8, 
    area: 8, 
    pumpStatus: 'ON', 
    cropRecords: { 
      plantingDate: '2026-06-10', 
      growthStage: 'Seedling', 
      observations: [{ id: '3a', date: '06/20/2026', note: 'Thinning completed.' }] 
    } 
  },
];

const CROP_TYPES = ['Pechay', 'Tomato', 'Eggplant', 'Okra', 'Chili'];
const GROWTH_STAGES = ['Seedling', 'Vegetative', 'Flowering', 'Harvesting'];

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

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

  // Crop Record Management State inside details Modal
  const [recordDate, setRecordDate] = useState('');
  const [recordStage, setRecordStage] = useState('Seedling');
  const [recordObservationText, setRecordObservationText] = useState('');

  // AI loading and insights state
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);

  // Fetch latest sensor reading from backend server and update field 1
  const fetchLatestSensorData = async () => {
    try {
      const response = await fetch(`${API_URL}/sensors/latest`);
      if (response.ok) {
        const sensorData = await response.json();
        if (sensorData && sensorData.soilMoisture !== undefined) {
          setFields(prevFields => {
            const targetFields = prevFields.length > 0 ? prevFields : DEFAULT_FIELDS;
            const updatedFields = targetFields.map(field => {
              if (field.id === '1') {
                return {
                  ...field,
                  soilMoisture: sensorData.soilMoisture,
                  temperature: sensorData.temperature,
                  humidity: sensorData.humidity,
                  waterLevel: sensorData.waterLevel
                };
              }
              return field;
            });
            const actuatedFields = checkPumpActuation(updatedFields);
            
            // Persist in background
            AsyncStorage.setItem('fields', JSON.stringify(actuatedFields)).catch(err => 
              console.error('Error persisting fields:', err)
            );
            
            // Update selected details modal if viewing field 1
            setSelectedField(prev => {
              if (prev && prev.id === '1') {
                const updatedSelected = actuatedFields.find(f => f.id === '1');
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

  // Load fields on component mount and setup 5-second polling interval
  useEffect(() => {
    const init = async () => {
      await loadFields();
      await fetchLatestSensorData();
    };
    init();

    const interval = setInterval(() => {
      fetchLatestSensorData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadFields = async () => {
    try {
      const storedFields = await AsyncStorage.getItem('fields');
      if (storedFields) {
        let loadedFields = JSON.parse(storedFields);
        const actuatedFields = checkPumpActuation(loadedFields);
        setFields(actuatedFields);
      } else {
        await AsyncStorage.setItem('fields', JSON.stringify(DEFAULT_FIELDS));
        setFields(DEFAULT_FIELDS);
      }
    } catch (error) {
      console.error('Error loading fields:', error);
      Alert.alert('Error', 'Failed to load crop fields data');
    }
  };

  const checkPumpActuation = (fieldsList) => {
    return fieldsList.map(field => {
      let pumpStatus = field.pumpStatus || 'OFF';
      let soilMoisture = field.soilMoisture;
      let waterLevel = field.waterLevel;

      if (soilMoisture < 50 && waterLevel > 2.0 && pumpStatus === 'OFF') {
        pumpStatus = 'ON';
      }
      else if (soilMoisture >= 70 && pumpStatus === 'ON') {
        pumpStatus = 'OFF';
      }
      
      return { ...field, pumpStatus };
    });
  };

  const saveFields = async (updatedFields) => {
    try {
      const checkedFields = checkPumpActuation(updatedFields);
      await AsyncStorage.setItem('fields', JSON.stringify(checkedFields));
      setFields(checkedFields);
    } catch (error) {
      console.error('Error saving fields:', error);
      Alert.alert('Error', 'Failed to save crop fields data');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace('Landing');
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
    fields.forEach(field => {
      if (field.soilMoisture < 50) {
        alertsList.push(`Soil moisture low in **${field.name}** (${field.soilMoisture}%) - 5V Pump activated.`);
      }
      if (field.waterLevel < 2.0) {
        alertsList.push(`Reservoir level low in **${field.name}** (${field.waterLevel} cm) - Refill tank.`);
      }
      if (field.temperature > 32) {
        alertsList.push(`Heat stress danger in **${field.name}** (${field.temperature}°C).`);
      }
    });
    return alertsList;
  };

  const handleAddField = () => {
    if (!newFieldName.trim() || !newFieldArea.trim()) {
      Alert.alert('Validation Error', 'Please enter a field name and area size.');
      return;
    }

    const parsedArea = parseFloat(newFieldArea);
    if (isNaN(parsedArea) || parsedArea <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid positive number for area.');
      return;
    }

    const newField = {
      id: Date.now().toString(),
      name: newFieldName.trim(),
      cropType: newCropType,
      soilMoisture: 60,
      temperature: 22,
      humidity: 70,
      waterLevel: 4.5,
      area: parsedArea,
      pumpStatus: 'OFF',
      cropRecords: {
        plantingDate: new Date().toISOString().split('T')[0],
        growthStage: 'Seedling',
        observations: []
      }
    };

    const updatedFields = [...fields, newField];
    saveFields(updatedFields);

    setNewFieldName('');
    setNewCropType('Pechay');
    setNewFieldArea('');
    setIsAddModalVisible(false);
  };

  const handleDeleteField = (id) => {
    Alert.alert(
      'Delete Field',
      'Are you sure you want to delete this field and its sensor readings?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            const updatedFields = fields.filter(field => field.id !== id);
            saveFields(updatedFields);
            setSelectedField(null);
          }
        }
      ]
    );
  };

  const handleSimulateIrrigation = () => {
    if (!selectedField) return;

    const newMoisture = Math.min(selectedField.soilMoisture + 15, 95);
    const updatedField = { 
      ...selectedField, 
      soilMoisture: newMoisture,
      pumpStatus: newMoisture >= 70 ? 'OFF' : 'ON'
    };
    
    const updatedFields = fields.map(field => 
      field.id === selectedField.id ? updatedField : field
    );

    saveFields(updatedFields);
    setSelectedField(updatedField);

    if (aiInsights) {
      setAiInsights(generateCropInsights(updatedField));
    }

    Alert.alert(
      'Irrigation Applied', 
      `5V pump actuated manually. Moisture level is now ${newMoisture}%. Pump is ${updatedField.pumpStatus}.`
    );
  };

  const handleAddCropObservation = () => {
    if (!recordObservationText.trim()) {
      Alert.alert('Validation Error', 'Please enter some observation notes.');
      return;
    }

    const dateStr = recordDate.trim() || new Date().toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' });

    const newObservation = {
      id: Date.now().toString(),
      date: dateStr,
      note: recordObservationText.trim()
    };

    const currentRecords = selectedField.cropRecords || { plantingDate: '', growthStage: 'Seedling', observations: [] };
    const updatedRecords = {
      ...currentRecords,
      growthStage: recordStage,
      plantingDate: recordDate || currentRecords.plantingDate,
      observations: [newObservation, ...currentRecords.observations]
    };

    const updatedField = { ...selectedField, cropRecords: updatedRecords };
    const updatedFields = fields.map(field => 
      field.id === selectedField.id ? updatedField : field
    );

    saveFields(updatedFields);
    setSelectedField(updatedField);
    setRecordObservationText('');
    Alert.alert('Record Saved', 'Crop monitoring record updated successfully.');
  };

  const handleRunAiInsights = () => {
    if (!selectedField) return;
    
    setIsAiLoading(true);
    setAiInsights(null);

    setTimeout(() => {
      const insightsResult = generateCropInsights(selectedField);
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
    <View style={styles.container}>
      {/* Modern Minimalist Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Ionicons name="leaf" size={22} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={styles.logo}>AgriSense</Text>
        </View>
        <TouchableOpacity style={styles.logoutButtonWrapper} onPress={handleLogout}>
          <Text style={styles.logoutButton}>Logout</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Welcome, {user?.name || 'Farmer'}!</Text>
          <Text style={styles.welcomeSubtitle}>Taguig City IoT Farm Node Gateway</Text>
        </View>

        {/* Dynamic Threshold Alarm Alert Box */}
        {alerts.length > 0 && (
          <View style={styles.alertNotificationCard}>
            <View style={styles.alertBoxHeader}>
              <Ionicons name="alert-circle" size={18} color="#991b1b" style={{ marginRight: 6 }} />
              <Text style={styles.alertBoxTitle}>Threshold Exceeded Alerts</Text>
            </View>
            {alerts.map((alertText, idx) => {
              const parts = alertText.split('**');
              return (
                <Text key={idx} style={styles.alertBoxText}>
                  • {parts.map((part, partIdx) => 
                    partIdx % 2 === 1 ? (
                      <Text key={partIdx} style={{ fontWeight: 'bold' }}>{part}</Text>
                    ) : (
                      part
                    )
                  )}
                </Text>
              );
            })}
          </View>
        )}
        
        {/* Dynamic Overview Stats with Curated Pastel Colors & Vector Icons */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Global Metrics Summary</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardFields]}>
              <Ionicons name="grid-outline" size={24} color="#047857" />
              <View style={styles.statInfo}>
                <Text style={styles.statLabel}>Active Fields</Text>
                <Text style={[styles.statValue, styles.statValueFields]}>{fields.length}</Text>
              </View>
            </View>
            <View style={[styles.statCard, styles.statCardMoisture]}>
              <Ionicons name="water-outline" size={24} color="#1d4ed8" />
              <View style={styles.statInfo}>
                <Text style={styles.statLabel}>Avg Moisture</Text>
                <Text style={[styles.statValue, styles.statValueMoisture]}>{getAverageMoisture()}</Text>
              </View>
            </View>
            <View style={[styles.statCard, styles.statCardTemp]}>
              <Ionicons name="thermometer-outline" size={24} color="#b45309" />
              <View style={styles.statInfo}>
                <Text style={styles.statLabel}>Avg Temp</Text>
                <Text style={[styles.statValue, styles.statValueTemp]}>{getAverageTemp()}</Text>
              </View>
            </View>
            <View style={[styles.statCard, styles.statCardHumidity]}>
              <Ionicons name="beaker-outline" size={24} color="#6d28d9" />
              <View style={styles.statInfo}>
                <Text style={styles.statLabel}>Avg Reservoir</Text>
                <Text style={[styles.statValue, styles.statValueHumidity]}>{getAverageWaterLevel()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Live Field Cards List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Crops & Sensor Nodes</Text>
          {fields.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No active fields. Tap "Add Field Node" below to begin monitoring.</Text>
            </View>
          ) : (
            fields.map((field) => (
              <TouchableOpacity 
                key={field.id} 
                style={styles.fieldItem}
                onPress={() => openFieldDetails(field)}
              >
                <View style={styles.fieldMain}>
                  <Text style={styles.fieldName}>{field.name}</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.cropBadge}>
                      <Text style={styles.cropBadgeText}>{field.cropType}</Text>
                    </View>
                    <Text style={styles.fieldAreaText}>{field.area} acres • Stage: {field.cropRecords?.growthStage || 'Seedling'}</Text>
                  </View>
                </View>
                <View style={styles.fieldMetrics}>
                  <View style={styles.metricBadge}>
                    <Ionicons name="water-outline" size={12} color="#1d4ed8" style={{ marginRight: 4 }} />
                    <Text style={styles.metricBadgeText}>{field.soilMoisture}%</Text>
                  </View>
                  <View style={styles.metricBadge}>
                    <Ionicons name="beaker-outline" size={12} color="#7c3aed" style={{ marginRight: 4 }} />
                    <Text style={styles.metricBadgeText}>{field.waterLevel}cm</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
        
        {/* Quick Action Navigation Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setIsAddModalVisible(true)}
            >
              <Text style={styles.actionButtonText}>Add Field Node</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => navigation.navigate('Reports')}
            >
              <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>View Crop Analytics</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => setIsSettingsModalVisible(true)}
            >
              <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>App Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modern Floating Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity 
          style={styles.tabItem} 
          disabled={true}
        >
          <Ionicons name="home" size={20} color="#10B981" />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Dashboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => navigation.navigate('Reports')}
        >
          <Ionicons name="stats-chart-outline" size={20} color="#94a3b8" />
          <Text style={styles.tabLabel}>Reports</Text>
        </TouchableOpacity>
      </View>

      {/* --- ADD FIELD MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isAddModalVisible}
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Crop Field</Text>
            
            <Text style={styles.modalLabel}>Field Identifier Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newFieldName}
              onChangeText={setNewFieldName}
              placeholder="e.g. TUP Chili patch"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.modalLabel}>Field Area Size (Acres)</Text>
            <TextInput
              style={styles.modalInput}
              value={newFieldArea}
              onChangeText={setNewFieldArea}
              placeholder="e.g. 5.5"
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.modalLabel}>Select Crop Category (Urban Crops)</Text>
            <View style={styles.cropSelector}>
              {CROP_TYPES.map((crop) => (
                <TouchableOpacity
                  key={crop}
                  style={[
                    styles.cropSelectorButton,
                    newCropType === crop && styles.cropSelectorButtonActive
                  ]}
                  onPress={() => setNewCropType(crop)}
                >
                  <Text style={[
                    styles.cropSelectorText,
                    newCropType === crop && styles.cropSelectorTextActive
                  ]}>{crop}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnCancel]} 
                onPress={() => setIsAddModalVisible(false)}
              >
                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnSubmit]}
                onPress={handleAddField}
              >
                <Text style={styles.modalBtnTextSubmit}>Save Node</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- APP SETTINGS MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isSettingsModalVisible}
        onRequestClose={() => setIsSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>AgriSense App Settings</Text>
            
            <Text style={styles.modalLabel}>Temperature Metric Units</Text>
            <View style={styles.cropSelector}>
              <TouchableOpacity
                style={[
                  styles.cropSelectorButton,
                  tempUnit === 'C' && styles.cropSelectorButtonActive
                ]}
                onPress={() => setTempUnit('C')}
              >
                <Text style={[
                  styles.cropSelectorText,
                  tempUnit === 'C' && styles.cropSelectorTextActive
                ]}>Celsius (°C)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.cropSelectorButton,
                  tempUnit === 'F' && styles.cropSelectorButtonActive
                ]}
                onPress={() => setTempUnit('F')}
              >
                <Text style={[
                  styles.cropSelectorText,
                  tempUnit === 'F' && styles.cropSelectorTextActive
                ]}>Fahrenheit (°F)</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.modalActions, { marginTop: 30 }]}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnSubmit, { width: '100%' }]} 
                onPress={() => setIsSettingsModalVisible(false)}
              >
                <Text style={styles.modalBtnTextSubmit}>Save Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- FIELD DETAILS & AI INSIGHTS MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={selectedField !== null}
        onRequestClose={() => setSelectedField(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.detailsModalContent]}>
            {selectedField && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                <View style={styles.detailsHeader}>
                  <View>
                    <Text style={styles.detailsFieldName}>{selectedField.name}</Text>
                    <Text style={styles.detailsFieldSub}>{selectedField.cropType} • {selectedField.area} Acres</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.closeButton} 
                    onPress={() => setSelectedField(null)}
                  >
                    <Ionicons name="close" size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {/* Sensor Grid: 4 Core Parameters (DHT11, Soil, Reservoir) */}
                <Text style={styles.modalLabel}>Live Sensor Node Feeds</Text>
                <View style={styles.detailSensorsGrid}>
                  <View style={styles.detailSensorCard}>
                    <Ionicons name="water-outline" size={24} color="#10B981" style={{ marginBottom: 4 }} />
                    <Text style={styles.detailSensorLabel}>Soil Moisture</Text>
                    <Text style={styles.detailSensorVal}>{selectedField.soilMoisture}%</Text>
                  </View>
                  <View style={styles.detailSensorCard}>
                    <Ionicons name="thermometer-outline" size={24} color="#10B981" style={{ marginBottom: 4 }} />
                    <Text style={styles.detailSensorLabel}>Temp (DHT11)</Text>
                    <Text style={styles.detailSensorVal}>{formatTemp(selectedField.temperature)}</Text>
                  </View>
                  <View style={styles.detailSensorCard}>
                    <Ionicons name="rainy-outline" size={24} color="#10B981" style={{ marginBottom: 4 }} />
                    <Text style={styles.detailSensorLabel}>Air Humidity</Text>
                    <Text style={styles.detailSensorVal}>{selectedField.humidity}%</Text>
                  </View>
                  <View style={styles.detailSensorCard}>
                    <Ionicons name="beaker-outline" size={24} color="#10B981" style={{ marginBottom: 4 }} />
                    <Text style={styles.detailSensorLabel}>Water Level</Text>
                    <Text style={styles.detailSensorVal}>{selectedField.waterLevel} cm</Text>
                  </View>
                </View>

                {/* 5V Pump Actuator Actuation Status Card */}
                <View style={[
                  styles.pumpStatusContainer,
                  selectedField.pumpStatus === 'ON' ? styles.pumpOnBg : styles.pumpOffBg
                ]}>
                  <Text style={styles.pumpStatusLabel}>5V Water Pump Output:</Text>
                  <View style={[
                    styles.pumpBadge,
                    selectedField.pumpStatus === 'ON' ? styles.pumpBadgeOn : styles.pumpBadgeOff
                  ]}>
                    <Text style={styles.pumpBadgeText}>{selectedField.pumpStatus === 'ON' ? '🟢 RUNNING' : '🔴 SHUT DOWN'}</Text>
                  </View>
                </View>

                {/* Interactive Action Options */}
                <View style={styles.detailActionsRow}>
                  <TouchableOpacity 
                    style={[styles.detailActionBtn, styles.irrigationBtn]}
                    onPress={handleSimulateIrrigation}
                  >
                    <View style={styles.btnRow}>
                      <Ionicons name="water-outline" size={16} color="#1d4ed8" style={{ marginRight: 6 }} />
                      <Text style={[styles.detailActionBtnText, { color: '#1d4ed8' }]}>Actuate Pump</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.detailActionBtn, styles.aiBtn]}
                    onPress={handleRunAiInsights}
                  >
                    <View style={styles.btnRow}>
                      <Ionicons name="analytics-outline" size={16} color="#047857" style={{ marginRight: 6 }} />
                      <Text style={[styles.detailActionBtnText, { color: '#047857' }]}>AI Diagnostics</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* AI Copilot Panel */}
                <View style={styles.aiInsightsPanel}>
                  {isAiLoading && (
                    <View style={styles.aiLoadingContainer}>
                      <ActivityIndicator size="small" color="#10B981" />
                      <Text style={styles.aiLoadingText}>Querying AgriSense AI Copilot...</Text>
                    </View>
                  )}

                  {aiInsights && (
                    <ScrollView style={styles.aiResultScroll} showsVerticalScrollIndicator={false}>
                      <View style={[
                        styles.aiResultHeader,
                        aiInsights.urgency === 'High' && styles.aiHeaderHigh,
                        aiInsights.urgency === 'Medium' && styles.aiHeaderMedium
                      ]}>
                        <View style={styles.logoRow}>
                          <Ionicons name="bulb-outline" size={16} color="#0f172a" style={{ marginRight: 4 }} />
                          <Text style={styles.aiResultTitle}>AgriSense AI Analysis</Text>
                        </View>
                        <Text style={styles.aiResultTime}>{aiInsights.timestamp}</Text>
                      </View>
                      <View style={styles.aiResultContent}>
                        <Text style={styles.aiResultSummary}>{aiInsights.summary}</Text>
                        {aiInsights.insights.map((insight, idx) => {
                          const parts = insight.split('**');
                          return (
                            <Text key={idx} style={styles.aiResultParagraph}>
                              {parts.map((part, partIdx) => 
                                partIdx % 2 === 1 ? (
                                  <Text key={partIdx} style={{ fontWeight: 'bold' }}>{part}</Text>
                                ) : (
                                  part
                                )
                              )}
                            </Text>
                          );
                        })}
                      </View>
                    </ScrollView>
                  )}

                  {!aiInsights && !isAiLoading && (
                    <View style={styles.aiPlaceholder}>
                      <Text style={styles.aiPlaceholderText}>Tap "AI Diagnostics" above to get live crop recommendations powered by Gemini.</Text>
                    </View>
                  )}
                </View>

                {/* --- CROP MONITORING RECORDS MODULE --- */}
                <View style={styles.recordsSection}>
                  <View style={styles.logoRow}>
                    <Ionicons name="document-text-outline" size={18} color="#0f172a" style={{ marginRight: 6 }} />
                    <Text style={styles.recordsSectionTitle}>Crop Monitoring Records</Text>
                  </View>
                  
                  {/* Fields form */}
                  <View style={styles.recordFormCard}>
                    <Text style={styles.recordFormLabel}>Planting Cycle Date</Text>
                    <TextInput
                      style={styles.recordFormInput}
                      value={recordDate}
                      onChangeText={setRecordDate}
                      placeholder="e.g. 2026-06-01"
                    />

                    <Text style={styles.recordFormLabel}>Current Growth Stage</Text>
                    <View style={styles.recordStageRow}>
                      {GROWTH_STAGES.map((stage) => (
                        <TouchableOpacity
                          key={stage}
                          style={[
                            styles.recordStageBtn,
                            recordStage === stage && styles.recordStageBtnActive
                          ]}
                          onPress={() => setRecordStage(stage)}
                        >
                          <Text style={[
                            styles.recordStageText,
                            recordStage === stage && styles.recordStageTextActive
                          ]}>{stage}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.recordFormLabel}>Field Observation Note</Text>
                    <TextInput
                      style={[styles.recordFormInput, { height: 60 }]}
                      value={recordObservationText}
                      onChangeText={setRecordObservationText}
                      placeholder="Enter status observations..."
                      multiline
                    />

                    <TouchableOpacity 
                      style={styles.saveRecordBtn}
                      onPress={handleAddCropObservation}
                    >
                      <Text style={styles.saveRecordBtnText}>Save Monitoring Log</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Observations history logs */}
                  <Text style={styles.obsListTitle}>Observation Logs History</Text>
                  {(!selectedField.cropRecords?.observations || selectedField.cropRecords.observations.length === 0) ? (
                    <Text style={styles.emptyObsText}>No observations recorded yet.</Text>
                  ) : (
                    selectedField.cropRecords.observations.map((obs) => (
                      <View key={obs.id} style={styles.obsLogItem}>
                        <View style={styles.obsLogHeader}>
                          <Text style={styles.obsLogDate}>{obs.date}</Text>
                        </View>
                        <Text style={styles.obsLogText}>{obs.note}</Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Delete Node Option */}
                <TouchableOpacity 
                  style={[styles.deleteNodeButton, { marginTop: 24 }]}
                  onPress={() => handleDeleteField(selectedField.id)}
                >
                  <Text style={styles.deleteNodeText}>Remove Field Node</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoutButtonWrapper: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  logoutButton: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110,
  },
  welcomeContainer: {
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  alertNotificationCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  alertBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertBoxTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#991b1b',
  },
  alertBoxText: {
    fontSize: 12,
    color: '#b91c1c',
    marginBottom: 4,
    lineHeight: 16,
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    padding: 14,
    borderRadius: 18,
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  statCardFields: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  statCardMoisture: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statCardTemp: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  statCardHumidity: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  statIcon: {
    fontSize: 24,
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  statValueFields: {
    color: '#047857',
  },
  statValueMoisture: {
    color: '#1d4ed8',
  },
  statValueTemp: {
    color: '#b45309',
  },
  statValueHumidity: {
    color: '#6d28d9',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  fieldItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  fieldMain: {
    flex: 1,
  },
  fieldName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cropBadge: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cropBadgeText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
  },
  fieldAreaText: {
    fontSize: 11,
    color: '#64748b',
  },
  fieldMetrics: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  metricBadgeIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  metricBadgeText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '800',
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    elevation: 0,
    shadowOpacity: 0,
  },
  secondaryButtonText: {
    color: '#475569',
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    height: 65,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
  },
  tabIcon: {
    fontSize: 18,
    color: '#94a3b8',
    marginBottom: 2,
  },
  tabIconActive: {
    color: '#10B981',
  },
  tabLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: '92%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 8,
    marginTop: 14,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  cropSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  cropSelectorButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cropSelectorButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  cropSelectorText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  cropSelectorTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 28,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modalBtnSubmit: {
    backgroundColor: '#10B981',
  },
  modalBtnTextCancel: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalBtnTextSubmit: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  detailsModalContent: {
    paddingBottom: 20,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailsFieldName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  detailsFieldSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailSensorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailSensorCard: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
  },
  detailSensorIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  detailSensorLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  detailSensorVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  pumpStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  pumpOnBg: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  pumpOffBg: {
    backgroundColor: '#fafaf9',
    borderColor: '#e7e5e4',
  },
  pumpStatusLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569',
  },
  pumpBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pumpBadgeOn: {
    backgroundColor: '#10B98120',
  },
  pumpBadgeOff: {
    backgroundColor: '#78716c20',
  },
  pumpBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  detailActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  irrigationBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  aiBtn: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  detailActionBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiInsightsPanel: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    height: 180,
    padding: 16,
    marginBottom: 20,
  },
  aiPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPlaceholderText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  aiLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  aiLoadingText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '700',
  },
  aiResultScroll: {
    flex: 1,
  },
  aiResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 8,
    marginBottom: 8,
  },
  aiResultTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  aiResultTime: {
    fontSize: 10,
    color: '#64748b',
  },
  aiResultContent: {
    gap: 8,
  },
  aiResultSummary: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    lineHeight: 16,
  },
  aiResultParagraph: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
  aiHeaderHigh: {
    borderBottomColor: '#fecaca',
  },
  aiHeaderMedium: {
    borderBottomColor: '#fed7aa',
  },
  // Crop Records Styles
  recordsSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 16,
  },
  recordsSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  recordFormCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  recordFormLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 8,
  },
  recordFormInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  recordStageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  recordStageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  recordStageBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  recordStageText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  recordStageTextActive: {
    color: '#fff',
  },
  saveRecordBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 14,
  },
  saveRecordBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  obsListTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
    marginTop: 10,
  },
  emptyObsText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  obsLogItem: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  obsLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  obsLogDate: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
  },
  obsLogText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  deleteNodeButton: {
    backgroundColor: '#fff1f2',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  deleteNodeText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default DashboardScreen;
