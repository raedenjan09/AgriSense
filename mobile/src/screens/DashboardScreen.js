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
  ActivityIndicator,
  Image,
  Platform,
  Share
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth, API_URL } from '../context/AuthContext';
import { generateCropInsights } from '../services/aiService';
import * as ImagePicker from 'expo-image-picker';

const DEFAULT_FIELDS = [];

const CROP_TYPES = ['Pechay', 'Tomato', 'Eggplant', 'Okra', 'Chili'];
const GROWTH_STAGES = ['Seedling', 'Vegetative', 'Flowering', 'Harvesting'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DashboardScreen = () => {
  const navigation = useNavigation();
  const { user, logout, updateProfile } = useAuth();

  // Local state variables
  const [fields, setFields] = useState([]);
  const [tempUnit, setTempUnit] = useState('C');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [selectedAnalyticsDay, setSelectedAnalyticsDay] = useState('All');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(24);
  const [endDate, setEndDate] = useState(30);
  const [tempStartDate, setTempStartDate] = useState(24);
  const [tempEndDate, setTempEndDate] = useState(30);
  const [selectedMonth, setSelectedMonth] = useState(5); // June
  const [selectedYear, setSelectedYear] = useState(2026);
  const [tempMonth, setTempMonth] = useState(5);
  const [tempYear, setTempYear] = useState(2026);

  const handlePrevMonth = () => {
    if (tempMonth === 0) {
      setTempMonth(11);
      setTempYear(prev => prev - 1);
    } else {
      setTempMonth(prev => prev - 1);
    }
    setTempStartDate(1);
    setTempEndDate(7);
  };

  const handleNextMonth = () => {
    if (tempMonth === 11) {
      setTempMonth(0);
      setTempYear(prev => prev + 1);
    } else {
      setTempMonth(prev => prev + 1);
    }
    setTempStartDate(1);
    setTempEndDate(7);
  };

  // Dynamic alert thresholds state
  const [moistureMin, setMoistureMin] = useState(50);
  const [tempMax, setTempMax] = useState(32);
  const [reservoirMin, setReservoirMin] = useState(2.0);

  const fetchThresholds = async () => {
    try {
      const response = await fetch(`${API_URL}/sensors/thresholds`);
      if (response.ok) {
        const data = await response.json();
        setMoistureMin(data.moistureMin);
        setTempMax(data.tempMax);
        setReservoirMin(data.reservoirMin);
        await AsyncStorage.setItem('threshold_moisture', data.moistureMin.toString());
        await AsyncStorage.setItem('threshold_temp', data.tempMax.toString());
        await AsyncStorage.setItem('threshold_reservoir', data.reservoirMin.toString());
      }
    } catch (error) {
      console.warn('Error fetching alert thresholds from API in mobile user dashboard:', error);
      try {
        const storedMoisture = await AsyncStorage.getItem('threshold_moisture');
        const storedTemp = await AsyncStorage.getItem('threshold_temp');
        const storedReservoir = await AsyncStorage.getItem('threshold_reservoir');
        if (storedMoisture) setMoistureMin(parseInt(storedMoisture));
        if (storedTemp) setTempMax(parseInt(storedTemp));
        if (storedReservoir) setReservoirMin(parseFloat(storedReservoir));
      } catch (err) {
        console.error('Error loading fallback AsyncStorage thresholds:', err);
      }
    }
  };



  const handleExportCSV = async () => {
    try {
      const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      let csvContent = 'Day,Average Soil Moisture (%),Average Reservoir Level (cm),Average Temperature (°C),Average Humidity (%)\n';

      for (let d = startDate; d <= endDate; d++) {
        const dayLabel = `${daysOfWeek[(d - 1) % 7]} ${d}`;
        
        // Filter readings for day d in selected month and year
        const dayReadings = sensorHistory.filter(r => {
          const date = new Date(r.timestamp);
          return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth && date.getDate() === d;
        });

        if (dayReadings.length > 0) {
          const avgSoilMoisture = Math.round(dayReadings.reduce((sum, r) => sum + r.soilMoisture, 0) / dayReadings.length);
          const avgWaterLevel = parseFloat((dayReadings.reduce((sum, r) => sum + r.waterLevel, 0) / dayReadings.length).toFixed(1));
          const avgTemp = parseFloat((dayReadings.reduce((sum, r) => sum + r.temperature, 0) / dayReadings.length).toFixed(1));
          const avgHumidity = Math.round(dayReadings.reduce((sum, r) => sum + r.humidity, 0) / dayReadings.length);

          csvContent += `${dayLabel},${avgSoilMoisture}%,${avgWaterLevel}cm,${avgTemp}°C,${avgHumidity}%\n`;
        } else {
          csvContent += `${dayLabel},No Data,No Data,No Data,No Data\n`;
        }
      }

      await Share.share({
        message: csvContent,
        title: 'AgriSense Historical Sensor Report',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share CSV report: ' + error.message);
    }
  };

  // User Profile Settings State
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [profilePictureUrl, setProfilePictureUrl] = useState(user?.profilePicture || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Focus states for textboxes in Settings
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

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

  // Weather state
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(null);

  // Sensor History state
  const [sensorHistory, setSensorHistory] = useState([]);

  // Fetch latest sensor reading from backend server and update all fields
  const fetchLatestSensorData = async () => {
    try {
      const response = await fetch(`${API_URL}/sensors/latest`);
      if (response.ok) {
        const sensorData = await response.json();
        if (sensorData && sensorData.soilMoisture !== undefined) {
          setFields(prevFields => {
            const updatedFields = prevFields.map(field => {
              return {
                ...field,
                soilMoisture: sensorData.soilMoisture,
                temperature: sensorData.temperature,
                humidity: sensorData.humidity,
                waterLevel: sensorData.waterLevel
              };
            });
            const actuatedFields = checkPumpActuation(updatedFields);

            // Persist in background
            AsyncStorage.setItem('fields', JSON.stringify(actuatedFields)).catch(err =>
              console.error('Error persisting fields:', err)
            );

            // Update selected details modal
            setSelectedField(prev => {
              if (prev) {
                const updatedSelected = actuatedFields.find(f => f.id === prev.id);
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

  // Fetch historical sensor readings from database
  const fetchSensorHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/sensors/history`);
      if (response.ok) {
        const data = await response.json();
        setSensorHistory(data);
      }
    } catch (error) {
      console.warn('Error fetching sensor history in mobile:', error);
    }
  };

  // Fetch weather data from backend Open-Meteo proxy
  const fetchWeatherData = async () => {
    try {
      setWeatherLoading(true);
      const response = await fetch(`${API_URL}/weather/forecast`);
      if (response.ok) {
        const data = await response.json();
        setWeatherData(data);
        setWeatherError(null);
      } else {
        setWeatherError('Failed to fetch weather data');
      }
    } catch (error) {
      console.warn('Error fetching weather data:', error);
      setWeatherError(error.message);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Generate smart irrigation advisory
  const getIrrigationAdvisory = () => {
    if (!weatherData) return { level: 'info', items: [] };
    const rainProb = weatherData.daily?.[0]?.rainProbability || 0;
    const temp = weatherData.current?.temperature || 0;
    const avgMoisture = fields.length > 0 ? Math.round(fields.reduce((s, f) => s + f.soilMoisture, 0) / fields.length) : 0;
    const items = [];
    let level = 'safe';
    if (rainProb >= 70) {
      items.push({ icon: '🌧️', text: `High rain probability (${rainProb}%) — skip irrigation today.` });
    } else if (rainProb >= 40) {
      items.push({ icon: '⛅', text: `Moderate rain chance (${rainProb}%) — monitor before irrigating.` });
      level = 'warning';
    } else {
      items.push({ icon: '☀️', text: `Low rain probability (${rainProb}%) — irrigation may be needed.` });
    }
    if (temp > 35) {
      items.push({ icon: '🔥', text: `Extreme heat (${temp}°C) — increase irrigation frequency.` });
      level = 'danger';
    } else if (temp > 32) {
      items.push({ icon: '🌡️', text: `High temperature (${temp}°C) — monitor crops for wilting.` });
      if (level !== 'danger') level = 'warning';
    } else {
      items.push({ icon: '✅', text: `Temperature optimal (${temp}°C) — ideal growing conditions.` });
    }
    if (avgMoisture > 0 && avgMoisture < 40) {
      items.push({ icon: '💧', text: `Soil moisture critically low (${avgMoisture}%) — irrigate immediately.` });
      level = 'danger';
    } else if (avgMoisture >= 40 && avgMoisture < 55) {
      items.push({ icon: '🪣', text: `Soil moisture below optimal (${avgMoisture}%) — consider irrigating.` });
      if (level !== 'danger') level = 'warning';
    } else if (avgMoisture >= 55) {
      items.push({ icon: '🌱', text: `Soil moisture healthy (${avgMoisture}%) — no irrigation needed.` });
    }
    return { level, items };
  };

  const formatHour = (timeStr) => {
    const date = new Date(timeStr);
    const hours = date.getHours();
    if (hours === 0) return '12AM';
    if (hours === 12) return '12PM';
    return hours > 12 ? `${hours - 12}PM` : `${hours}AM`;
  };

  const formatDay = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatDateShort = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Load fields on component mount and setup 5-second polling interval
  useEffect(() => {
    const init = async () => {
      await loadFields();
      await fetchLatestSensorData();
      await fetchThresholds();
      await fetchWeatherData();
      await fetchSensorHistory();
    };
    init();

    const interval = setInterval(() => {
      fetchLatestSensorData();
      fetchSensorHistory();
    }, 5000);

    // Refresh weather every 5 minutes
    const weatherInterval = setInterval(() => {
      fetchWeatherData();
    }, 300000);

    return () => {
      clearInterval(interval);
      clearInterval(weatherInterval);
    };
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

  const openSettings = () => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
    setProfilePictureUrl(user?.profilePicture || '');
    setIsSettingsModalVisible(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your photos to upload a profile picture.');
      return;
    }

    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        await uploadToCloudinary(selectedUri);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'An error occurred while opening the image gallery.');
    }
  };

  const uploadToCloudinary = async (uri) => {
    setUploadingImage(true);
    try {
      // 1. Fetch Cloudinary signature from backend
      const signResponse = await fetch(`${API_URL}/auth/cloudinary-sign`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      if (!signResponse.ok) {
        throw new Error('Failed to obtain upload signature from backend.');
      }
      const { signature, timestamp, apiKey, cloudName } = await signResponse.json();

      // 2. Perform signed upload directly to Cloudinary
      const data = new FormData();
      let uriParts = uri.split('.');
      let fileType = uriParts[uriParts.length - 1];

      data.append('file', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        type: `image/${fileType}`,
        name: `photo.${fileType}`,
      });
      data.append('api_key', apiKey);
      data.append('timestamp', timestamp.toString());
      data.append('signature', signature);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: data,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();
      if (response.ok && result.secure_url) {
        setProfilePictureUrl(result.secure_url);
        Alert.alert('Success', 'Photo uploaded successfully!');
      } else {
        console.error('Cloudinary response error:', result);
        Alert.alert('Upload Failed', result.error?.message || 'Cloudinary upload failed.');
      }
    } catch (error) {
      console.error('Error uploading image to Cloudinary:', error);
      Alert.alert('Upload Error', error.message || 'Failed to upload image. Please check your internet connection.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!editName.trim() || !editEmail.trim()) {
      Alert.alert('Error', 'Please enter your name and email.');
      return;
    }

    setIsUpdatingProfile(true);
    const result = await updateProfile(editName.trim(), editEmail.trim(), profilePictureUrl);
    setIsUpdatingProfile(false);

    if (result.success) {
      setIsSettingsModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } else {
      Alert.alert('Error', result.message || 'Failed to update profile.');
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
    fields.forEach(field => {
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
      soilMoisture: 0,
      temperature: 0,
      humidity: 0,
      waterLevel: 0,
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
      {/* Modern Profile Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Ionicons name="leaf" size={22} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={styles.logo}>AgriSense</Text>
        </View>
        <TouchableOpacity
          style={styles.profileAvatarWrapper}
          activeOpacity={0.85}
          onPress={openSettings}
        >
          {user?.profilePicture ? (
            <Image source={{ uri: user.profilePicture }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'Dashboard' ? (
          <>
            {/* Welcome Section */}
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>Welcome Back, {user?.name || 'Farmer'}! 👋</Text>
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
                  onPress={() => setActiveTab('Reports')}
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
          </>
        ) : activeTab === 'Reports' ? (() => {
          // Dynamically build chart data from picked date range from DB
          const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const waterUsageRange = [];
          const reservoirLevelsRange = [];
          let totalWater = 0;
          let sumLevel = 0;
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
              
              totalWater += avgSoilMoisture;
              sumLevel += avgWaterLevel;
              
              waterUsageRange.push({ day: dayLabel, amount: avgSoilMoisture, label: `${avgSoilMoisture}%`, noData: false });
              reservoirLevelsRange.push({ day: dayLabel, level: avgWaterLevel, noData: false });
            } else {
              waterUsageRange.push({ day: dayLabel, amount: 0, label: '0%', noData: true });
              reservoirLevelsRange.push({ day: dayLabel, level: 0, noData: true });
            }
          }
          const avgLevel = daysWithDataCount > 0 ? (sumLevel / daysWithDataCount).toFixed(1) : '0.0';

          return (
            <>
              {/* Reports header */}
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeTitle}>Crop Analytics & Insights</Text>
                <Text style={styles.welcomeSubtitle}>Historical irrigation and health parameters across all fields</Text>
              </View>

              {/* Date range picker trigger */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="calendar-outline" size={20} color="#10B981" />
                  <Text style={styles.cardTitle}>Selected Analytics Range</Text>
                </View>
                <Text style={styles.cardSubtitle}>Tap to choose a custom date range</Text>
                <TouchableOpacity
                  style={styles.pickerTriggerBox}
                  activeOpacity={0.8}
                  onPress={() => {
                    setTempStartDate(startDate);
                    setTempEndDate(endDate);
                    setTempMonth(selectedMonth);
                    setTempYear(selectedYear);
                    setShowDatePicker(true);
                  }}
                >
                  <View style={styles.pickerTriggerRow}>
                    <Ionicons name="calendar" size={18} color="#10B981" style={{ marginRight: 10 }} />
                    <Text style={styles.pickerTriggerText}>
                      {MONTH_NAMES[selectedMonth]} {startDate}, {selectedYear} — {MONTH_NAMES[selectedMonth]} {endDate}, {selectedYear}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Day filter strip */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="funnel-outline" size={20} color="#10B981" />
                  <Text style={styles.cardTitle}>Filter by Day</Text>
                </View>
                <Text style={styles.cardSubtitle}>Tap a day within the range to drill down</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelectorScroll}>
                  <TouchableOpacity
                    style={[styles.daySelectBtn, selectedAnalyticsDay === 'All' && styles.daySelectBtnActive]}
                    onPress={() => setSelectedAnalyticsDay('All')}
                  >
                    <Text style={[styles.daySelectBtnText, selectedAnalyticsDay === 'All' && styles.daySelectBtnTextActive]}>All Days</Text>
                  </TouchableOpacity>
                  {waterUsageRange.map(item => {
                    const numDay = item.day.split(' ')[1];
                    return (
                      <TouchableOpacity
                        key={item.day}
                        style={[styles.daySelectBtn, selectedAnalyticsDay === numDay && styles.daySelectBtnActive]}
                        onPress={() => setSelectedAnalyticsDay(numDay)}
                      >
                        <Text style={[styles.daySelectBtnText, selectedAnalyticsDay === numDay && styles.daySelectBtnTextActive]}>
                          {item.day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Highlight summary cards */}
              <View style={styles.highlightsContainer}>
                <View style={[styles.highlightCard, styles.highlightCardWater]}>
                  <Ionicons name="water-outline" size={26} color="#1d4ed8" style={{ marginBottom: 6 }} />
                  <Text style={[styles.highlightValue, styles.highlightValueWater]}>
                    {daysWithDataCount > 0 ? Math.round(totalWater / daysWithDataCount) : 0}%
                  </Text>
                  <Text style={styles.highlightLabel}>Avg Soil Moisture</Text>
                </View>
                <View style={[styles.highlightCard, styles.highlightCardYield]}>
                  <Ionicons name="beaker-outline" size={26} color="#047857" style={{ marginBottom: 6 }} />
                  <Text style={[styles.highlightValue, styles.highlightValueYield]}>{avgLevel} cm</Text>
                  <Text style={styles.highlightLabel}>Avg Reservoir Level</Text>
                </View>
              </View>

              {/* Soil Moisture Bar Chart */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Soil Moisture History</Text>
                <Text style={styles.sectionSubtitle}>Average soil moisture percentage in selected range</Text>
                <View style={styles.chartContainer}>
                  <View style={styles.chartYAxis}>
                    <Text style={styles.yLabel}>100%</Text>
                    <Text style={styles.yLabel}>50%</Text>
                    <Text style={styles.yLabel}>0%</Text>
                  </View>
                  <View style={styles.chartBars}>
                    {waterUsageRange.map((item, index) => {
                      const numDay = item.day.split(' ')[1];
                      const barH = item.amount; // amount is already 0 to 100 (percentage)
                      const isSelected = selectedAnalyticsDay === 'All' || selectedAnalyticsDay === numDay;
                      return (
                        <View key={index} style={[styles.barWrapper, { opacity: isSelected ? 1 : 0.25 }]}>
                          <View style={styles.barValueTooltip}><Text style={styles.tooltipText}>{item.noData ? 'No Data' : item.label}</Text></View>
                          <View style={[styles.barTrack, item.noData && { borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: 'transparent' }]}>
                            {!item.noData && <View style={[styles.barFill, { height: `${barH}%`, backgroundColor: '#10B981' }]} />}
                          </View>
                          <Text style={styles.barLabel}>{item.day}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Reservoir Levels */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Water Reservoir Levels (cm)</Text>
                <Text style={styles.sectionSubtitle}>Daily height measured by capacitive sensor</Text>
                <View style={styles.reservoirList}>
                  {reservoirLevelsRange
                    .filter(item => {
                      const numDay = item.day.split(' ')[1];
                      return selectedAnalyticsDay === 'All' || selectedAnalyticsDay === numDay;
                    })
                    .map((item, index) => {
                      const fillPercent = (item.level / 5.0) * 100;
                      const isLow = item.level < 2.5;
                      return (
                        <View key={index} style={styles.reservoirRow}>
                          <Text style={styles.reservoirDay}>{item.day}</Text>
                          <View style={styles.reservoirTrack}>
                            <View style={[styles.reservoirFill, { width: `${fillPercent}%`, backgroundColor: isLow ? '#EF4444' : '#0ea5e9' }]} />
                          </View>
                          <Text style={[styles.reservoirValue, isLow && { color: '#EF4444', fontWeight: 'bold' }]}>
                            {item.level.toFixed(1)} cm
                          </Text>
                        </View>
                      );
                    })}
                </View>
              </View>

              {/* Crop Yield Progress */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Yield Projection Progress</Text>
                <Text style={styles.sectionSubtitle}>Estimated crop maturity vs. target harvest threshold</Text>
                <View style={styles.progressList}>
                  {fields.length === 0 ? (
                    <Text style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', paddingVertical: 10 }}>
                      No active crop fields. Add fields in the Dashboard tab to project yield progress.
                    </Text>
                  ) : (
                    fields.map((field, index) => {
                      const stage = field.cropRecords?.growthStage || 'Seedling';
                      let progress = 0.25;
                      let status = 'Seedling Stage';
                      let color = '#D97706';
                      
                      if (stage === 'Vegetative') {
                        progress = 0.50;
                        status = 'Vegetative Stage';
                        color = '#3B82F6';
                      } else if (stage === 'Flowering') {
                        progress = 0.75;
                        status = 'Flowering Stage';
                        color = '#8B5CF6';
                      } else if (stage === 'Harvesting') {
                        progress = 1.0;
                        status = 'Ready for Harvest';
                        color = '#10B981';
                      }

                      return (
                        <View key={field.id || index} style={styles.progressItem}>
                          <View style={styles.progressRow}>
                            <Text style={styles.fieldName}>{field.name} ({field.cropType})</Text>
                            <View style={[styles.statusBadge, { backgroundColor: color + '15' }]}>
                              <Text style={[styles.statusBadgeText, { color: color }]}>{status}</Text>
                            </View>
                          </View>
                          <View style={styles.progressBarTrack}>
                            <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
                          </View>
                          <Text style={styles.progressPercent}>{Math.round(progress * 100)}% of target maturity</Text>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>

              {/* AI Recommendations */}
              <View style={styles.aiAlertCard}>
                <View style={styles.aiHeader}>
                  <Ionicons name="bulb-outline" size={20} color="#047857" style={{ marginRight: 6 }} />
                  <Text style={styles.aiTitle}>Agronomic Recommendations</Text>
                </View>
                <Text style={styles.aiText}>
                  Water level in reservoir dropped below critical 2.0 cm on selected dates. Currently, Pechay and Tomato fields show healthy moisture values. No active pest risk detected.
                </Text>
              </View>

              {/* Export CSV */}
              <TouchableOpacity
                style={[styles.actionButton, { marginTop: 20, backgroundColor: '#10B981', height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }]}
                onPress={handleExportCSV}
              >
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>📥 Share CSV Analytics Report</Text>
              </TouchableOpacity>
            </>
          );
        })() : null}

        {/* ====== WEATHER TAB CONTENT ====== */}
        {activeTab === 'Weather' && (
          <>
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>☁️ Weather & Forecast</Text>
              <Text style={styles.welcomeSubtitle}>Real-time weather and irrigation advisory for Taguig City</Text>
            </View>

            {weatherLoading && !weatherData ? (
              <View style={{ alignItems: 'center', padding: 60 }}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={{ color: '#64748b', marginTop: 12, fontWeight: '600' }}>Fetching weather data...</Text>
              </View>
            ) : weatherError && !weatherData ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Ionicons name="cloud-offline-outline" size={48} color="#94a3b8" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#64748b', marginTop: 12 }}>Unable to Load Weather</Text>
                <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>{weatherError}</Text>
                <TouchableOpacity
                  style={{ marginTop: 16, backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 }}
                  onPress={fetchWeatherData}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : weatherData ? (
              <>
                {/* Current Conditions Hero */}
                <View style={weatherStyles.heroCard}>
                  <View style={weatherStyles.heroTop}>
                    <Text style={weatherStyles.heroLocation}>📍 {weatherData.location}</Text>
                    <Text style={weatherStyles.heroIcon}>{weatherData.current.icon}</Text>
                  </View>
                  <View style={weatherStyles.heroTempRow}>
                    <Text style={weatherStyles.heroTemp}>{Math.round(weatherData.current.temperature)}°C</Text>
                    <View>
                      <Text style={weatherStyles.heroCondition}>{weatherData.current.description}</Text>
                      <Text style={weatherStyles.heroFeelsLike}>Feels like {Math.round(weatherData.current.feelsLike)}°C</Text>
                    </View>
                  </View>
                  <View style={weatherStyles.heroStatsRow}>
                    <View style={weatherStyles.heroStat}>
                      <Text style={weatherStyles.heroStatValue}>{weatherData.current.humidity}%</Text>
                      <Text style={weatherStyles.heroStatLabel}>Humidity</Text>
                    </View>
                    <View style={weatherStyles.heroStat}>
                      <Text style={weatherStyles.heroStatValue}>{weatherData.current.windSpeed} km/h</Text>
                      <Text style={weatherStyles.heroStatLabel}>Wind</Text>
                    </View>
                    <View style={weatherStyles.heroStat}>
                      <Text style={weatherStyles.heroStatValue}>{weatherData.daily?.[0]?.rainProbability || 0}%</Text>
                      <Text style={weatherStyles.heroStatLabel}>Rain</Text>
                    </View>
                  </View>
                </View>

                {/* Smart Irrigation Advisory */}
                {(() => {
                  const advisory = getIrrigationAdvisory();
                  const bgColor = advisory.level === 'danger' ? '#fef2f2' : advisory.level === 'warning' ? '#fffbeb' : '#ecfdf5';
                  const borderColor = advisory.level === 'danger' ? '#fca5a5' : advisory.level === 'warning' ? '#fcd34d' : '#86efac';
                  const titleColor = advisory.level === 'danger' ? '#b91c1c' : advisory.level === 'warning' ? '#b45309' : '#047857';
                  const titleIcon = advisory.level === 'danger' ? '🚨' : advisory.level === 'warning' ? '⚠️' : '🌱';
                  const titleText = advisory.level === 'danger' ? 'Urgent Action Required' : advisory.level === 'warning' ? 'Monitor Conditions' : 'All Clear';
                  return (
                    <View style={[weatherStyles.advisoryCard, { backgroundColor: bgColor, borderColor }]}>
                      <Text style={[weatherStyles.advisoryTitle, { color: titleColor }]}>{titleIcon} {titleText}</Text>
                      {advisory.items.map((item, idx) => (
                        <View key={idx} style={weatherStyles.advisoryItem}>
                          <Text style={{ fontSize: 16, marginRight: 8 }}>{item.icon}</Text>
                          <Text style={weatherStyles.advisoryText}>{item.text}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {/* 5-Day Forecast */}
                <View style={weatherStyles.sectionCard}>
                  <Text style={styles.sectionTitle}>📅 5-Day Forecast</Text>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>Daily temperature range and rain outlook</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {weatherData.daily.slice(0, 5).map((day, index) => (
                      <View key={index} style={weatherStyles.forecastCard}>
                        <Text style={weatherStyles.forecastDay}>{index === 0 ? 'Today' : formatDay(day.date)}</Text>
                        <Text style={weatherStyles.forecastDate}>{formatDateShort(day.date)}</Text>
                        <Text style={weatherStyles.forecastIcon}>{day.icon}</Text>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          <Text style={weatherStyles.forecastTempMax}>{Math.round(day.tempMax)}°</Text>
                          <Text style={weatherStyles.forecastTempMin}>{Math.round(day.tempMin)}°</Text>
                        </View>
                        <Text style={[weatherStyles.forecastRain, day.rainProbability >= 60 && { color: '#dc2626' }]}>
                          💧 {day.rainProbability}%
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </>
            ) : null}
          </>
        )}


      </ScrollView>

      {/* Modern Floating Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('Dashboard')}
        >
          <Ionicons name={activeTab === 'Dashboard' ? "home" : "home-outline"} size={20} color={activeTab === 'Dashboard' ? "#10B981" : "#94a3b8"} />
          <Text style={[styles.tabLabel, activeTab === 'Dashboard' && styles.tabLabelActive]}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('Reports')}
        >
          <Ionicons name={activeTab === 'Reports' ? "stats-chart" : "stats-chart-outline"} size={20} color={activeTab === 'Reports' ? "#10B981" : "#94a3b8"} />
          <Text style={[styles.tabLabel, activeTab === 'Reports' && styles.tabLabelActive]}>Analytics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => { setActiveTab('Weather'); if (!weatherData) fetchWeatherData(); }}
        >
          <Ionicons name={activeTab === 'Weather' ? "cloudy" : "cloudy-outline"} size={20} color={activeTab === 'Weather' ? "#10B981" : "#94a3b8"} />
          <Text style={[styles.tabLabel, activeTab === 'Weather' && styles.tabLabelActive]}>Weather</Text>
        </TouchableOpacity>
      </View>

      {/* --- Date Range Picker Modal --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDatePicker}
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.calendarModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={handlePrevMonth} style={{ padding: 4 }}>
                  <Ionicons name="chevron-back" size={20} color="#10B981" />
                </TouchableOpacity>
                <Text style={styles.calendarMonthTitle}>{MONTH_NAMES[tempMonth]} {tempYear}</Text>
                <TouchableOpacity onPress={handleNextMonth} style={{ padding: 4 }}>
                  <Ionicons name="chevron-forward" size={20} color="#10B981" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.calendarModalSubtitle}>Tap any date to select a 7-day range starting on that day</Text>

            <View style={styles.calendarDaysRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dl, idx) => (
                <Text key={idx} style={styles.calendarDayLabel}>{dl}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {(() => {
                const getDaysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();
                const daysInMonth = getDaysInMonth(tempMonth, tempYear);
                return Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                  const isStart = tempStartDate === d;
                  const isEnd = tempEndDate === d;
                  const inRange = tempStartDate && tempEndDate && d > tempStartDate && d < tempEndDate;
                  const isSelected = isStart || isEnd;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.calendarDayCell,
                        inRange && styles.calendarDayInRange,
                        isStart && styles.calendarDayStart,
                        isEnd && styles.calendarDayEnd,
                      ]}
                      onPress={() => {
                        let start = d;
                        let end = d + 6;
                        if (end > daysInMonth) {
                          end = daysInMonth;
                          start = Math.max(1, daysInMonth - 6);
                        }
                        setTempStartDate(start);
                        setTempEndDate(end);
                      }}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        inRange && styles.calendarDayTextInRange,
                        isSelected && styles.calendarDayTextSelected,
                      ]}>{d}</Text>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>

            <View style={styles.selectedDatesPreview}>
              <Text style={styles.previewLabel}>Selected Range:</Text>
              <Text style={styles.previewValue}>
                {tempStartDate ? `${MONTH_NAMES[tempMonth]} ${tempStartDate}` : 'Select Start'} — {tempEndDate ? `${MONTH_NAMES[tempMonth]} ${tempEndDate}` : 'Select End'}
              </Text>
            </View>

            <View style={styles.calendarActionRow}>
              <TouchableOpacity
                style={[styles.calendarActionBtn, styles.calendarCancelBtn]}
                onPress={() => {
                  setTempStartDate(startDate);
                  setTempEndDate(endDate);
                  setTempMonth(selectedMonth);
                  setTempYear(selectedYear);
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.calendarCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.calendarActionBtn, styles.calendarApplyBtn]}
                disabled={!tempStartDate || !tempEndDate}
                onPress={() => {
                  if (tempStartDate && tempEndDate) {
                    setStartDate(tempStartDate);
                    setEndDate(tempEndDate);
                    setSelectedMonth(tempMonth);
                    setSelectedYear(tempYear);
                    setShowDatePicker(false);
                  }
                }}
              >
                <Text style={styles.calendarApplyBtnText}>Apply Range</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* --- APP & USER SETTINGS MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isSettingsModalVisible}
        onRequestClose={() => setIsSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.scrollModalContent} style={styles.settingsModalScroll}>
            <View style={styles.settingsModalCard}>
              <Text style={styles.modalTitle}>Profile & Settings</Text>

              {/* Profile Photo Uploader */}
              <View style={styles.photoUploadContainer}>
                <TouchableOpacity
                  onPress={pickImage}
                  disabled={uploadingImage}
                  activeOpacity={0.8}
                  style={styles.photoContainer}
                >
                  {profilePictureUrl ? (
                    <Image source={{ uri: profilePictureUrl }} style={styles.photoPreview} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>
                        {editName ? editName.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>
                  )}
                  {uploadingImage ? (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  ) : (
                    <View style={styles.editBadge}>
                      <Ionicons name="camera" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.photoHint}>Tap to change profile picture</Text>
              </View>

              {/* Edit Profile Fields */}
              <View style={styles.settingsForm}>
                <View style={styles.settingsInputContainer}>
                  <Text style={styles.settingsLabel}>Full Name</Text>
                  <View style={[
                    styles.settingsInputWrapper,
                    nameFocused && styles.settingsInputWrapperFocused
                  ]}>
                    <Ionicons
                      name="person-outline"
                      size={18}
                      color={nameFocused ? '#10B981' : '#9CA3AF'}
                      style={styles.settingsInputIcon}
                    />
                    <TextInput
                      style={styles.settingsInput}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Enter your full name"
                      placeholderTextColor="#9CA3AF"
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                    />
                  </View>
                </View>

                <View style={styles.settingsInputContainer}>
                  <Text style={styles.settingsLabel}>Email Address</Text>
                  <View style={[
                    styles.settingsInputWrapper,
                    emailFocused && styles.settingsInputWrapperFocused
                  ]}>
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={emailFocused ? '#10B981' : '#9CA3AF'}
                      style={styles.settingsInputIcon}
                    />
                    <TextInput
                      style={styles.settingsInput}
                      value={editEmail}
                      onChangeText={setEditEmail}
                      placeholder="Enter your email"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                    />
                  </View>
                </View>
              </View>

              {/* Temperature Preference Section */}
              <Text style={styles.settingsSectionTitle}>App Preferences</Text>
              <Text style={styles.settingsLabel}>Temperature Metric Units</Text>
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

              {/* Modal Actions */}
              <View style={[styles.modalActions, { marginTop: 24, flexDirection: 'row', gap: 12 }]}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel, { flex: 1 }]}
                  onPress={() => setIsSettingsModalVisible(false)}
                  disabled={isUpdatingProfile}
                >
                  <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSubmit, { flex: 1 }]}
                  onPress={handleSaveSettings}
                  disabled={isUpdatingProfile || uploadingImage}
                >
                  {isUpdatingProfile ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnTextSubmit}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Red-accented Logout action */}
              <TouchableOpacity
                style={styles.modalLogoutButton}
                onPress={() => {
                  setIsSettingsModalVisible(false);
                  handleLogout();
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.modalLogoutButtonText}>Log Out Account</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  // Modern profile bar styles
  profileAvatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
  },
  headerAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Settings & User Profile Styles
  settingsModalScroll: {
    width: '100%',
  },
  scrollModalContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  settingsModalCard: {
    width: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  photoUploadContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  photoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    color: '#137333',
    fontSize: 32,
    fontWeight: 'bold',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  photoHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
    fontWeight: '500',
  },
  settingsForm: {
    width: '100%',
    marginVertical: 12,
  },
  settingsInputContainer: {
    marginBottom: 16,
  },
  settingsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  settingsInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: '#F9FAFB',
  },
  settingsInputWrapperFocused: {
    borderColor: '#10B981',
    backgroundColor: '#ffffff',
  },
  settingsInputIcon: {
    marginRight: 8,
  },
  settingsInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#1F2937',
  },
  settingsSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 6,
  },
  modalBtnCancel: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalBtnTextCancel: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalLogoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
  },
  modalLogoutButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  highlightsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  highlightCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  highlightCardWater: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  highlightCardYield: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  highlightValue: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  highlightValueWater: {
    color: '#1d4ed8',
  },
  highlightValueYield: {
    color: '#047857',
  },
  highlightLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 20,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 160,
    alignItems: 'flex-end',
  },
  chartYAxis: {
    justifyContent: 'space-between',
    height: 130,
    paddingRight: 10,
    paddingBottom: 25,
  },
  yLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'right',
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueTooltip: {
    backgroundColor: '#1e293b',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  tooltipText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  barTrack: {
    height: 110,
    width: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 7,
  },
  barLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 6,
    fontWeight: '600',
  },
  reservoirList: {
    gap: 12,
  },
  reservoirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reservoirDay: {
    width: 36,
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  reservoirTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 5,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  reservoirFill: {
    height: '100%',
    borderRadius: 5,
  },
  reservoirValue: {
    width: 50,
    fontSize: 12,
    color: '#334155',
    textAlign: 'right',
    fontWeight: '600',
  },
  progressList: {
    gap: 15,
  },
  progressItem: {
    marginBottom: 5,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'right',
  },
  aiAlertCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#047857',
  },
  aiText: {
    fontSize: 13,
    color: '#065f46',
    lineHeight: 18,
  },

  // ── Calendar Date Picker Modal ──────────────────────────────
  calendarModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  calendarMonthTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  calendarModalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 14,
  },
  calendarDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  calendarDayLabel: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  calendarDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  calendarDayInRange: {
    backgroundColor: '#d1fae5',
    borderRadius: 0,
  },
  calendarDayStart: {
    backgroundColor: '#10B981',
    borderRadius: 20,
  },
  calendarDayEnd: {
    backgroundColor: '#10B981',
    borderRadius: 20,
  },
  calendarDayText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  calendarDayTextInRange: {
    color: '#047857',
    fontWeight: '600',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  selectedDatesPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  previewLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  previewValue: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '700',
    flex: 1,
  },
  calendarActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  calendarActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  calendarCancelBtn: {
    backgroundColor: '#f1f5f9',
  },
  calendarCancelBtnText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 14,
  },
  calendarApplyBtn: {
    backgroundColor: '#10B981',
  },
  calendarApplyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  pickerTriggerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  pickerTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerTriggerText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  daySelectorScroll: {
    paddingVertical: 8,
    gap: 10,
    flexDirection: 'row',
  },
  daySelectBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelectBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  daySelectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  daySelectBtnTextActive: {
    color: '#ffffff',
  },
});

const weatherStyles = StyleSheet.create({
  heroCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#4f46e5',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroLocation: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  heroIcon: {
    fontSize: 48,
  },
  heroTempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  heroTemp: {
    fontSize: 52,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -2,
  },
  heroCondition: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  heroFeelsLike: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  heroStat: {
    alignItems: 'center',
    gap: 2,
  },
  heroStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  heroStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  advisoryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  advisoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  advisoryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  advisoryText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  forecastCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    width: 90,
  },
  forecastDay: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  forecastDate: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 6,
  },
  forecastIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  forecastTempMax: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  forecastTempMin: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
  },
  forecastRain: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '600',
    marginTop: 4,
  },
});

export default DashboardScreen;
