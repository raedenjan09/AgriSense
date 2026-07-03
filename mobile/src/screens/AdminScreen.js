import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  Share,
  StatusBar,
  TextInput,
  Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth, API_URL } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Initial state is empty — data is loaded dynamically from DB and AsyncStorage

const AdminScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation();

  // Dynamic alert thresholds state
  const [moistureMin, setMoistureMin] = useState(50);
  const [tempMax, setTempMax] = useState(32);
  const [reservoirMin, setReservoirMin] = useState(2.0);

  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [searchQuery, setSearchQuery] = useState('');
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
  const [sensorHistory, setSensorHistory] = useState([]);

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

  const fetchSensorHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/sensors/history`);
      if (response.ok) {
        const data = await response.json();
        setSensorHistory(data);
      }
    } catch (error) {
      console.warn('Error fetching sensor history from API in AdminScreen:', error);
    }
  };

  // Load custom configurations
  useEffect(() => {
    loadSettings();
    fetchSensorHistory();
    const interval = setInterval(() => {
      fetchSensorHistory();
      fetchUsers();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const loadSettings = async () => {
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
      } else {
        throw new Error('API response not ok');
      }
    } catch (error) {
      console.warn('Error fetching thresholds from API, using AsyncStorage fallback:', error);
      try {
        const storedMoisture = await AsyncStorage.getItem('threshold_moisture');
        const storedTemp = await AsyncStorage.getItem('threshold_temp');
        const storedReservoir = await AsyncStorage.getItem('threshold_reservoir');

        if (storedMoisture) setMoistureMin(parseInt(storedMoisture));
        if (storedTemp) setTempMax(parseInt(storedTemp));
        if (storedReservoir) setReservoirMin(parseFloat(storedReservoir));
      } catch (err) {
        console.error('Error loading fallback AsyncStorage settings:', err);
      }
    } finally {
      fetchUsers();
    }
  };

  // Dynamically map active fields to connected gateways and active alert logs on mobile
  useEffect(() => {
    const fetchFieldsAndAlerts = async () => {
      try {
        const storedFields = await AsyncStorage.getItem('fields');
        if (storedFields) {
          const parsedFields = JSON.parse(storedFields);
          
          // Map fields to Connected Gateways
          const mappedDevices = parsedFields.map((field, idx) => ({
            id: `dev-${field.id}`,
            name: `Node Gateway ${field.name}`,
            status: 'Online',
            signal: Math.max(70, 95 - (idx * 6)),
            battery: Math.max(65, 98 - (idx * 4)),
            lastSeen: 'Just now'
          }));
          setDevices(mappedDevices);

          // Calculate dynamic alert warnings
          const dynamicLogs = [];
          parsedFields.forEach((field) => {
            if (field.soilMoisture < moistureMin) {
              dynamicLogs.push({
                id: `l-${field.id}-moist`,
                time: 'Just now',
                node: field.name,
                alert: `Moisture critical (${field.soilMoisture}%) - Pump ON`
              });
            }
            if (field.waterLevel < reservoirMin) {
              dynamicLogs.push({
                id: `l-${field.id}-water`,
                time: 'Just now',
                node: field.name,
                alert: `Water level low (${field.waterLevel} cm) - Refill tank`
              });
            }
            if (field.temperature > tempMax) {
              dynamicLogs.push({
                id: `l-${field.id}-temp`,
                time: 'Just now',
                node: field.name,
                alert: `Heat stress warning (${field.temperature}°C)`
              });
            }
          });

          if (dynamicLogs.length > 0) {
            setLogs(dynamicLogs);
          } else {
            setLogs([
              { id: 'ok-1', time: '10:14 AM', node: 'System Audit', alert: 'All nodes operating inside healthy limits.' }
            ]);
          }
        }
      } catch (err) {
        console.error('Error mapping mobile admin fields:', err);
      }
    };

    fetchFieldsAndAlerts();
  }, [moistureMin, tempMax, reservoirMin]);

  const handleRoleChange = async (userId, currentRole) => {
    let nextRole = 'Farmer';
    if (currentRole === 'Farmer') nextRole = 'Extension Worker';
    else if (currentRole === 'Extension Worker') nextRole = 'Admin';
    
    try {
      const response = await fetch(`${API_URL}/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ role: nextRole })
      });
      if (response.ok) {
        setUsers(prev => prev.map(u => (u._id === userId || u.id === userId) ? { ...u, role: nextRole } : u));
        Alert.alert('Success', `Updated role to ${nextRole}`);
      } else {
        const data = await response.json();
        Alert.alert('Error', data.message || 'Failed to update user role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      Alert.alert('Error', 'Failed to update user role');
    }
  };

  const handleSaveThresholds = async () => {
    try {
      setLoading(true);
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
        await AsyncStorage.setItem('threshold_moisture', moistureMin.toString());
        await AsyncStorage.setItem('threshold_temp', tempMax.toString());
        await AsyncStorage.setItem('threshold_reservoir', reservoirMin.toString());
        Alert.alert('Success', 'Global alert thresholds synced and saved successfully!');
      } else {
        throw new Error('API failed');
      }
    } catch (error) {
      console.warn('Error saving thresholds to API, saving to AsyncStorage fallback:', error);
      try {
        await AsyncStorage.setItem('threshold_moisture', moistureMin.toString());
        await AsyncStorage.setItem('threshold_temp', tempMax.toString());
        await AsyncStorage.setItem('threshold_reservoir', reservoirMin.toString());
        Alert.alert('Local Save', 'Global alert thresholds saved locally (Offline mode).');
      } catch (err) {
        Alert.alert('Error', 'Failed to save configuration limits.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const headers = 'Day,Water Usage (L),Reservoir Level (cm),Field Name,Harvest Projection Progress\n';
      let csvContent = headers;
      
      const waterUsage = [
        { day: 'Mon', amount: 120 }, { day: 'Tue', amount: 150 }, { day: 'Wed', amount: 80 },
        { day: 'Thu', amount: 200 }, { day: 'Fri', amount: 110 }, { day: 'Sat', amount: 95 }, { day: 'Sun', amount: 140 }
      ];
      
      const reservoirLevels = [
        { level: 4.8 }, { level: 4.5 }, { level: 3.2 }, { level: 2.1 }, { level: 4.9 }, { level: 4.6 }, { level: 4.2 }
      ];

      for (let i = 0; i < 7; i++) {
        csvContent += `${waterUsage[i].day},${waterUsage[i].amount},${reservoirLevels[i].level},"TUP Pechay Patch",85%\n`;
      }
      
      await Share.share({
        message: csvContent,
        title: 'AgriSense System Audit Report',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to export CSV: ' + error.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigation.replace('Landing');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3FDF9" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AgriSense Admin</Text>
          <Text style={styles.headerSub}>Role: {user?.role || 'Admin'}</Text>
        </View>
        
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {activeTab === 'Overview' && (
          <>
            {/* Threshold Adjustment Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="options-outline" size={20} color="#10B981" />
                <Text style={styles.cardTitle}>Global Threshold Config</Text>
              </View>
              <Text style={styles.cardSubtitle}>Set alarm parameters for soil nodes</Text>

              {/* Moisture Limit */}
              <View style={styles.settingRow}>
                <View style={styles.settingMeta}>
                  <Text style={styles.settingLabel}>Min Soil Moisture</Text>
                  <Text style={styles.settingValue}>{moistureMin}%</Text>
                </View>
                <View style={styles.numberControls}>
                  <TouchableOpacity 
                    style={styles.adjustBtn} 
                    onPress={() => setMoistureMin(Math.max(20, moistureMin - 5))}
                  >
                    <Text style={styles.adjustText}>-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.adjustBtn} 
                    onPress={() => setMoistureMin(Math.min(80, moistureMin + 5))}
                  >
                    <Text style={styles.adjustText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Temperature Limit */}
              <View style={styles.settingRow}>
                <View style={styles.settingMeta}>
                  <Text style={styles.settingLabel}>Max Temperature</Text>
                  <Text style={styles.settingValue}>{tempMax}°C</Text>
                </View>
                <View style={styles.numberControls}>
                  <TouchableOpacity 
                    style={styles.adjustBtn} 
                    onPress={() => setTempMax(Math.max(20, tempMax - 1))}
                  >
                    <Text style={styles.adjustText}>-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.adjustBtn} 
                    onPress={() => setTempMax(Math.min(45, tempMax + 1))}
                  >
                    <Text style={styles.adjustText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reservoir Limit */}
              <View style={styles.settingRow}>
                <View style={styles.settingMeta}>
                  <Text style={styles.settingLabel}>Min Reservoir Level</Text>
                  <Text style={styles.settingValue}>{reservoirMin.toFixed(1)} cm</Text>
                </View>
                <View style={styles.numberControls}>
                  <TouchableOpacity 
                    style={styles.adjustBtn} 
                    onPress={() => setReservoirMin(Math.max(1.0, reservoirMin - 0.2))}
                  >
                    <Text style={styles.adjustText}>-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.adjustBtn} 
                    onPress={() => setReservoirMin(Math.min(4.0, reservoirMin + 0.2))}
                  >
                    <Text style={styles.adjustText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveThresholds} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Parameters</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Alert Logs & Actions */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" />
                <Text style={styles.cardTitle}>Audit & Reporting</Text>
              </View>
              
              <TouchableOpacity
                style={[styles.csvBtn, { backgroundColor: '#0F172A', marginBottom: 10 }]}
                onPress={() => navigation.navigate('AdminReports')}
              >
                <Ionicons name="bar-chart-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.csvBtnText}>View Analytics Reports</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.csvBtn} onPress={handleExportCSV}>
                <Ionicons name="cloud-download-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.csvBtnText}>Export System Data (CSV)</Text>
              </TouchableOpacity>

              <Text style={styles.logsTitle}>Recent Sensor Events</Text>
              {logs.length === 0 ? (
                <Text style={styles.cardSubtitle}>No field data yet. Add crop fields to see live alerts.</Text>
              ) : (
                logs.map((log) => (
                  <View key={log.id} style={styles.logItem}>
                    <Text style={styles.logTime}>{log.time}</Text>
                    <Text style={styles.logText}><Text style={{ fontWeight: 'bold' }}>{log.node}:</Text> {log.alert}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {activeTab === 'Gateways' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="hardware-chip-outline" size={20} color="#10B981" />
              <Text style={styles.cardTitle}>IoT ESP32 Gateways</Text>
            </View>
            <Text style={styles.cardSubtitle}>Connected telemetry gateways across Taguig farm fields</Text>
            
            {/* Gateways Health Stats */}
            <View style={styles.gatewaysSummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryCount}>{devices.filter(d => d.status === 'Online').length}</Text>
                <Text style={styles.summaryLabel}>Online</Text>
              </View>
              <View style={[styles.summaryItem, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#F3FDF9' }]}>
                <Text style={styles.summaryCount}>{devices.filter(d => d.status !== 'Online').length}</Text>
                <Text style={styles.summaryLabel}>Offline</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryCount}>{devices.length}</Text>
                <Text style={styles.summaryLabel}>Total Nodes</Text>
              </View>
            </View>

            {devices.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="wifi-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyText}>No crop nodes active. Setup fields in the dashboard to register gateways.</Text>
              </View>
            ) : (
              devices.map((dev) => (
                <View key={dev.id} style={styles.deviceItem}>
                  <View style={styles.deviceRow}>
                    <Text style={styles.deviceName}>{dev.name}</Text>
                    <View style={[styles.statusIndicator, dev.status === 'Online' ? styles.online : styles.offline]}>
                      <Text style={styles.statusText}>{dev.status}</Text>
                    </View>
                  </View>
                  {dev.status === 'Online' && (
                    <Text style={styles.deviceMetrics}>Signal: 📶 {dev.signal}%  •  Battery: 🔋 {dev.battery}%  •  Last Seen: {dev.lastSeen}</Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'Users' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="people-outline" size={20} color="#10B981" />
              <Text style={styles.cardTitle}>User Accounts Directory</Text>
            </View>
            <Text style={styles.cardSubtitle}>Tap role badge to cycle permission levels</Text>

            {/* Live Search */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search users..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="person-remove-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyText}>No users matched your search criteria.</Text>
              </View>
            ) : (
              users
                .filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((u) => (
                  <View key={u._id || u.id} style={styles.userItem}>
                    <Text style={styles.userName}>{u.name}</Text>
                    <View style={styles.userMetaRow}>
                      <Text style={styles.userEmail}>{u.email}</Text>
                      <TouchableOpacity 
                        style={styles.roleTag} 
                        onPress={() => handleRoleChange(u._id || u.id, u.role)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.roleTagText}>{u.role} 🔄</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
            )}
          </View>
        )}

        {activeTab === 'Reports' && (() => {
          const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
          const waterUsage = [];
          const reservoirLevels = [];
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
              
              waterUsage.push({ day: dayLabel, amount: avgSoilMoisture, label: `${avgSoilMoisture}%`, noData: false });
              reservoirLevels.push({ day: dayLabel, level: avgWaterLevel, noData: false });
              tempRange.push({ day: dayLabel, temp: avgTemp, noData: false });
              humidityRange.push({ day: dayLabel, humidity: avgHumidity, noData: false });
            } else {
              waterUsage.push({ day: dayLabel, amount: 0, label: '0%', noData: true });
              reservoirLevels.push({ day: dayLabel, level: 0, noData: true });
              tempRange.push({ day: dayLabel, temp: 0, noData: true });
              humidityRange.push({ day: dayLabel, humidity: 0, noData: true });
            }
          }
          const avgLevel = daysWithDataCount > 0 ? (sumLevel / daysWithDataCount).toFixed(1) : '0.0';
          const avgMoistureOverall = daysWithDataCount > 0 ? Math.round(totalWater / daysWithDataCount) : 0;
          const avgTempOverall = daysWithDataCount > 0 ? (sumTemp / daysWithDataCount).toFixed(1) : '0.0';
          const avgHumidityOverall = daysWithDataCount > 0 ? Math.round(sumHumidity / daysWithDataCount) : 0;

          return (
            <>
              {/* Datepicker Trigger Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="calendar-outline" size={20} color="#10B981" />
                  <Text style={styles.cardTitle}>Selected Analytics Range</Text>
                </View>
                <Text style={styles.cardSubtitle}>Tap the input below to choose customized date ranges</Text>
                
                <TouchableOpacity 
                  style={styles.pickerTriggerBox} 
                  onPress={() => {
                    setTempStartDate(startDate);
                    setTempEndDate(endDate);
                    setTempMonth(selectedMonth);
                    setTempYear(selectedYear);
                    setShowDatePicker(true);
                  }}
                  activeOpacity={0.8}
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

              {daysWithDataCount === 0 ? (
                <View style={[styles.card, { padding: 40, alignItems: 'center', backgroundColor: '#f8fafc' }]}>
                  <Ionicons name="cloud-offline-outline" size={48} color="#94a3b8" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#64748b', marginTop: 12, textAlign: 'center' }}>
                    No Sensor Data Recorded
                  </Text>
                  <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                    There are no sensor readings in the database for {MONTH_NAMES[selectedMonth]} {startDate} to {MONTH_NAMES[selectedMonth]} {endDate}, {selectedYear}. Please verify your ESP32 connection or choose a different range.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Horizontal Day Selector calendar filter */}
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Ionicons name="funnel-outline" size={20} color="#10B981" />
                      <Text style={styles.cardTitle}>Filter Telemetry by Day</Text>
                    </View>
                    <Text style={styles.cardSubtitle}>Tap a day within range to filter telemetry</Text>
                    
                    <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelectorScroll}>
                      <TouchableOpacity
                        style={[
                          styles.daySelectBtn,
                          selectedAnalyticsDay === 'All' && styles.daySelectBtnActive
                        ]}
                        onPress={() => setSelectedAnalyticsDay('All')}
                      >
                        <Text style={[
                          styles.daySelectBtnText,
                          selectedAnalyticsDay === 'All' && styles.daySelectBtnTextActive
                        ]}>All Days</Text>
                      </TouchableOpacity>

                      {waterUsage.map(item => {
                        const cleanDay = item.day.split(' ')[0];
                        const numDay = item.day.split(' ')[1];
                        return (
                          <TouchableOpacity
                            key={item.day}
                            style={[
                              styles.daySelectBtn,
                              selectedAnalyticsDay === numDay && styles.daySelectBtnActive
                            ]}
                            onPress={() => setSelectedAnalyticsDay(numDay)}
                          >
                            <Text style={[
                              styles.daySelectBtnText,
                              selectedAnalyticsDay === numDay && styles.daySelectBtnTextActive
                            ]}>{cleanDay} {numDay}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Highlight Cards with Soft Color Backgrounds */}
                  <View style={styles.highlightsContainer}>
                    <View style={[styles.highlightCard, styles.highlightCardWater]}>
                      <Ionicons name="water-outline" size={26} color="#1d4ed8" style={{ marginBottom: 6 }} />
                      <Text style={[styles.highlightValue, styles.highlightValueWater]}>
                        {avgMoistureOverall}%
                      </Text>
                      <Text style={styles.highlightLabel}>Avg Soil Moisture</Text>
                    </View>
                    <View style={[styles.highlightCard, styles.highlightCardYield]}>
                      <Ionicons name="beaker-outline" size={26} color="#047857" style={{ marginBottom: 6 }} />
                      <Text style={[styles.highlightValue, styles.highlightValueYield]}>
                        {avgLevel} cm
                      </Text>
                      <Text style={styles.highlightLabel}>Avg Reservoir Level</Text>
                    </View>
                  </View>

                  <View style={styles.highlightsContainer}>
                    <View style={[styles.highlightCard, { backgroundColor: '#fffbeb' }]}>
                      <Ionicons name="thermometer-outline" size={26} color="#d97706" style={{ marginBottom: 6 }} />
                      <Text style={[styles.highlightValue, { color: '#b45309' }]}>
                        {avgTempOverall}°C
                      </Text>
                      <Text style={styles.highlightLabel}>Avg Temperature</Text>
                    </View>
                    <View style={[styles.highlightCard, { backgroundColor: '#f0fdf4' }]}>
                      <Ionicons name="cloud-outline" size={26} color="#059669" style={{ marginBottom: 6 }} />
                      <Text style={[styles.highlightValue, { color: '#047857' }]}>
                        {avgHumidityOverall}%
                      </Text>
                      <Text style={styles.highlightLabel}>Avg Humidity</Text>
                    </View>
                  </View>

                  {/* Users Signups Registration Analytics Card */}
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Ionicons name="people-outline" size={20} color="#10B981" />
                      <Text style={styles.cardTitle}>User Registration Analytics</Text>
                    </View>
                    <Text style={styles.cardSubtitle}>User signup counts and roles distribution in selected range</Text>

                    {/* Roles Summary Counter */}
                    <View style={styles.gatewaysSummary}>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryCount}>
                          {users.filter(u => u.role === 'Farmer').length || 3}
                        </Text>
                        <Text style={styles.summaryLabel}>Farmers</Text>
                      </View>
                      <View style={[styles.summaryItem, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#F3FDF9' }]}>
                        <Text style={styles.summaryCount}>
                          {users.filter(u => u.role === 'Extension Worker').length || 1}
                        </Text>
                        <Text style={styles.summaryLabel}>Workers</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryCount}>
                          {users.filter(u => u.role === 'Admin').length || 1}
                        </Text>
                        <Text style={styles.summaryLabel}>Admins</Text>
                      </View>
                    </View>

                    {/* Picked Day Signup Details */}
                    <View style={styles.dayDetailBox}>
                      <Text style={styles.dayDetailTitle}>
                        {selectedAnalyticsDay === 'All' ? 'Registration Metrics Summary' : `June ${selectedAnalyticsDay} Registrations`}
                      </Text>
                      {selectedAnalyticsDay === 'All' ? (
                        <Text style={styles.dayDetailDesc}>
                          Active credentials monitored in range (June {startDate} - {endDate}). Users list size: {users.length || 5} registered credentials.
                        </Text>
                      ) : (
                        (() => {
                          const dayInt = parseInt(selectedAnalyticsDay);
                          if (dayInt === 15) return <Text style={styles.dayDetailDesc}>• 1 User: Kate Diane Ross L. Buensuceso (Extension Worker)</Text>;
                          if (dayInt === 16) return <Text style={styles.dayDetailDesc}>• 2 Users: Mark Acosta (Farmer), Jay Tabigue (Farmer)</Text>;
                          if (dayInt === 18) return <Text style={styles.dayDetailDesc}>• 1 User: Raeden Jan F. Duque (Admin)</Text>;
                          return <Text style={styles.dayDetailDesc}>No signups recorded on this date.</Text>;
                        })()
                      )}
                    </View>
                  </View>

                  {/* Weekly Water Usage Bar Chart */}
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Soil Moisture History</Text>
                    <Text style={styles.sectionSubtitle}>Average soil moisture level (%) in selected range</Text>
                    
                    <View style={styles.chartContainer}>
                      <View style={styles.chartYAxis}>
                        <Text style={styles.yLabel}>100%</Text>
                        <Text style={styles.yLabel}>50%</Text>
                        <Text style={styles.yLabel}>0%</Text>
                      </View>
                      <View style={styles.chartBars}>
                        {waterUsage.map((item, index) => {
                          const numDay = item.day.split(' ')[1];
                          const barH = item.noData ? 0 : item.amount;
                          const isSelected = selectedAnalyticsDay === 'All' || selectedAnalyticsDay === numDay;
                          return (
                            <View key={index} style={[styles.barWrapper, { opacity: isSelected ? 1.0 : 0.25 }]}>
                              <View style={styles.barValueTooltip}>
                                <Text style={styles.tooltipText}>{item.noData ? 'No Data' : item.label}</Text>
                              </View>
                              <View style={[styles.barTrack, item.noData && { borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1' }]}>
                                {!item.noData && <View style={[styles.barFill, { height: `${barH}%`, backgroundColor: '#10B981' }]} />}
                              </View>
                              <Text style={styles.barLabel}>{item.day}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  {/* Water Reservoir Level Trend */}
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Water Reservoir Levels (cm)</Text>
                    <Text style={styles.sectionSubtitle}>Daily height levels measured by capacitive sensor</Text>
                    
                    <View style={styles.reservoirList}>
                      {reservoirLevels
                      .filter(item => {
                        const numDay = item.day.split(' ')[1];
                        return selectedAnalyticsDay === 'All' || selectedAnalyticsDay === numDay;
                      })
                      .map((item, index) => {
                        if (item.noData) {
                          return (
                            <View key={index} style={styles.reservoirRow}>
                              <Text style={styles.reservoirDay}>{item.day}</Text>
                              <Text style={[styles.reservoirValue, { color: '#94a3b8' }]}>No Data</Text>
                            </View>
                          );
                        }
                        const fillPercent = (item.level / 5.0) * 100;
                        const isLow = item.level < reservoirMin;
                        return (
                          <View key={index} style={styles.reservoirRow}>
                            <Text style={styles.reservoirDay}>{item.day}</Text>
                            <View style={styles.reservoirTrack}>
                              <View style={[
                                styles.reservoirFill, 
                                { width: `${fillPercent}%`, backgroundColor: isLow ? '#EF4444' : '#0ea5e9' }
                              ]} />
                            </View>
                            <Text style={[styles.reservoirValue, isLow && { color: '#EF4444', fontWeight: 'bold' }]}>
                              {item.level.toFixed(1)} cm
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Temperature Readings */}
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Daily Average Temperature (°C)</Text>
                    <Text style={styles.sectionSubtitle}>Air temperature history in selected range</Text>
                    <View style={styles.reservoirList}>
                      {tempRange
                        .filter(item => {
                          const numDay = item.day.split(' ')[1];
                          return selectedAnalyticsDay === 'All' || selectedAnalyticsDay === numDay;
                        })
                        .map((item, index) => {
                          if (item.noData) {
                            return (
                              <View key={index} style={styles.reservoirRow}>
                                <Text style={styles.reservoirDay}>{item.day}</Text>
                                <Text style={[styles.reservoirValue, { color: '#94a3b8' }]}>No Data</Text>
                              </View>
                            );
                          }
                          const fillPercent = Math.min((item.temp / 50) * 100, 100);
                          const isHot = item.temp > tempMax;
                          return (
                            <View key={index} style={styles.reservoirRow}>
                              <Text style={styles.reservoirDay}>{item.day}</Text>
                              <View style={styles.reservoirTrack}>
                                <View style={[styles.reservoirFill, { width: `${fillPercent}%`, backgroundColor: isHot ? '#EF4444' : '#f59e0b' }]} />
                              </View>
                              <Text style={[styles.reservoirValue, isHot && { color: '#EF4444', fontWeight: 'bold' }]}>
                                {item.temp.toFixed(1)} °C
                              </Text>
                            </View>
                          );
                        })}
                    </View>
                  </View>

                  {/* Humidity Readings */}
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Daily Average Humidity (%)</Text>
                    <Text style={styles.sectionSubtitle}>Relative humidity level in selected range</Text>
                    <View style={styles.reservoirList}>
                      {humidityRange
                        .filter(item => {
                          const numDay = item.day.split(' ')[1];
                          return selectedAnalyticsDay === 'All' || selectedAnalyticsDay === numDay;
                        })
                        .map((item, index) => {
                          if (item.noData) {
                            return (
                              <View key={index} style={styles.reservoirRow}>
                                <Text style={styles.reservoirDay}>{item.day}</Text>
                                <Text style={[styles.reservoirValue, { color: '#94a3b8' }]}>No Data</Text>
                              </View>
                            );
                          }
                          const fillPercent = item.humidity;
                          return (
                            <View key={index} style={styles.reservoirRow}>
                              <Text style={styles.reservoirDay}>{item.day}</Text>
                              <View style={styles.reservoirTrack}>
                                <View style={[styles.reservoirFill, { width: `${fillPercent}%`, backgroundColor: '#8b5cf6' }]} />
                              </View>
                              <Text style={styles.reservoirValue}>
                                {item.humidity}%
                              </Text>
                            </View>
                          );
                        })}
                    </View>
                  </View>
                </>
              )}
            </>
          );
        })()}

      </ScrollView>

      {/* Modern Floating Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('Overview')}
        >
          <Ionicons name={activeTab === 'Overview' ? "options" : "options-outline"} size={20} color={activeTab === 'Overview' ? "#10B981" : "#94a3b8"} />
          <Text style={[styles.tabLabel, activeTab === 'Overview' && styles.tabLabelActive]}>Overview</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('Gateways')}
        >
          <Ionicons name={activeTab === 'Gateways' ? "hardware-chip" : "hardware-chip-outline"} size={20} color={activeTab === 'Gateways' ? "#10B981" : "#94a3b8"} />
          <Text style={[styles.tabLabel, activeTab === 'Gateways' && styles.tabLabelActive]}>Gateways</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('Users')}
        >
          <Ionicons name={activeTab === 'Users' ? "people" : "people-outline"} size={20} color={activeTab === 'Users' ? "#10B981" : "#94a3b8"} />
          <Text style={[styles.tabLabel, activeTab === 'Users' && styles.tabLabelActive]}>Users</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('Reports')}
        >
          <Ionicons name={activeTab === 'Reports' ? "stats-chart" : "stats-chart-outline"} size={20} color={activeTab === 'Reports' ? "#10B981" : "#94a3b8"} />
          <Text style={[styles.tabLabel, activeTab === 'Reports' && styles.tabLabelActive]}>Analytics</Text>
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
              {['M','T','W','T','F','S','S'].map((dl, idx) => (
                <Text key={idx} style={styles.calendarDayLabel}>{dl}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {(() => {
                const getDaysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();
                const daysInMonth = getDaysInMonth(tempMonth, tempYear);
                return Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                  const isStart = tempStartDate === d;
                  const isEnd   = tempEndDate === d;
                  const inRange = tempStartDate && tempEndDate && d > tempStartDate && d < tempEndDate;
                  const isSelected = isStart || isEnd;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.calendarDayCell,
                        inRange && styles.calendarDayInRange,
                        isStart && styles.calendarDayStart,
                        isEnd   && styles.calendarDayEnd,
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
                        inRange    && styles.calendarDayTextInRange,
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3FDF9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#E6F7F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E6F7F0',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F3FDF9',
  },
  settingMeta: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 2,
  },
  numberControls: {
    flexDirection: 'row',
    gap: 8,
  },
  adjustBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3FDF9',
    borderWidth: 1.5,
    borderColor: '#E6F7F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  saveBtn: {
    backgroundColor: '#10B981',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  deviceItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F3FDF9',
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  online: {
    backgroundColor: '#ECFDF5',
  },
  offline: {
    backgroundColor: '#FEF2F2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  deviceMetrics: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  userItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F3FDF9',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  userMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#6B7280',
  },
  roleTag: {
    backgroundColor: '#F3FDF9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#A7F3D0',
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
  },
  csvBtn: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  csvBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  logsTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569',
    marginTop: 8,
    marginBottom: 10,
  },
  logItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E2E8F0',
  },
  logTime: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
  logText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  gatewaysSummary: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 8,
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    height: 64,
    backgroundColor: '#fff',
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#10B981',
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
  dayDetailBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayDetailTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  dayDetailDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  rangeSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 6,
  },
  rangeSelectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeSelectBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  rangeSelectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  rangeSelectBtnTextActive: {
    color: '#10B981',
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

  // ── Picker Trigger Input ───────────────────────────────────
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
});

export default AdminScreen;
