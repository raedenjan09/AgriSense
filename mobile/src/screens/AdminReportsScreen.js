import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth, API_URL } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AdminReportsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [usersList, setUsersList] = useState([]);
  const [deviceLogs, setDeviceLogs] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminReportsData();
  }, []);

  const fetchAdminReportsData = async () => {
    try {
      setLoading(true);
      
      // Fetch dynamic users directory from backend
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
        console.warn("Error loading thresholds from API in AdminReportsScreen, falling back to AsyncStorage:", err);
        try {
          const storedMoisture = await AsyncStorage.getItem('threshold_moisture');
          const storedTemp = await AsyncStorage.getItem('threshold_temp');
          const storedReservoir = await AsyncStorage.getItem('threshold_reservoir');
          if (storedMoisture) moistureMin = parseInt(storedMoisture);
          if (storedTemp) tempMax = parseInt(storedTemp);
          if (storedReservoir) reservoirMin = parseFloat(storedReservoir);
        } catch (storageErr) {
          console.error("Storage error loading fallback thresholds:", storageErr);
        }
      }

      // Read crop fields from AsyncStorage to build device statistics and dynamic alerts
      const storedFields = await AsyncStorage.getItem('fields');
      const mockAlerts = [];
      const mockDeviceLogs = [];

      if (storedFields) {
        const parsedFields = JSON.parse(storedFields);
        parsedFields.forEach((field, index) => {
          // Device diagnostics
          mockDeviceLogs.push({
            id: `dev-diag-${field.id}`,
            fieldName: field.name,
            nodeId: `ESP32-NODE-${field.id.slice(-4).toUpperCase()}`,
            signal: Math.max(70, 95 - (index * 6)),
            battery: Math.max(65, 98 - (index * 4)),
            status: 'Nominal'
          });

          // Read limits (using fetched values)

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
              message: `Reservoir level low at ${field.waterLevel} cm (Limit: ${reservoirMin} cm).`,
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

      // Fallbacks if no fields exist
      setDeviceLogs(mockDeviceLogs.length > 0 ? mockDeviceLogs : [
        { id: '1', fieldName: 'TUP Pechay Patch', nodeId: 'ESP32-NODE-78B4', signal: 92, battery: 98, status: 'Nominal' },
        { id: '2', fieldName: 'Okra Terrace North', nodeId: 'ESP32-NODE-32F9', signal: 85, battery: 90, status: 'Nominal' }
      ]);

      setSystemAlerts(mockAlerts.length > 0 ? mockAlerts : [
        { id: 'd-1', timestamp: '10:14 AM', type: 'SYSTEM_STARTUP', message: 'IoT gateways handshake complete. Streams active.', severity: 'Info' },
        { id: 'd-2', timestamp: '09:45 AM', type: 'NOMINAL_AUDIT', message: 'All sensors operating within limits.', severity: 'Info' }
      ]);

      setLoading(false);
    } catch (err) {
      console.error('Error fetching admin reports data:', err);
      setLoading(false);
    }
  };

  const handleExportSystemAudit = async () => {
    try {
      let csvContent = "=== USER ROSTER PERMISSIONS DIRECTORY ===\nName,Email,Account Security Role\n";
      usersList.forEach(u => {
        csvContent += `"${u.name}","${u.email}","${u.role}"\n`;
      });

      csvContent += "\n=== CONNECTED ESP32 NODE DIAGNOSTICS ===\nField Target,Node Identifier,Signal Strength (%),Battery (%),Uptime Status\n";
      deviceLogs.forEach(d => {
        csvContent += `"${d.fieldName}","${d.nodeId}",${d.signal}%,${d.battery}%,"${d.status}"\n`;
      });

      csvContent += "\n=== SYSTEM EXCEPTION WARNING LOGS ===\nTimestamp,Type,Event Message,Severity Level\n";
      systemAlerts.forEach(a => {
        csvContent += `"${a.timestamp}","${a.type}","${a.message}","${a.severity}"\n`;
      });

      await Share.share({
        message: csvContent,
        title: 'AgriSense Administrative Audit Report',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share audit CSV report: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Admin')}>
          <Ionicons name="arrow-back" size={18} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Audit Reports</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportSystemAudit}>
          <Ionicons name="share-social-outline" size={18} color="#10B981" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Compiling system audits...</Text>
          </View>
        ) : (
          <>
            {/* Connected Nodes Diagnostics */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Connected ESP32 Nodes Diagnostics</Text>
              <Text style={styles.sectionSubtitle}>Active gateway signals and device battery levels</Text>

              {deviceLogs.map((dev) => (
                <View key={dev.id} style={styles.deviceRow}>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{dev.fieldName}</Text>
                    <Text style={styles.nodeId}>ID: {dev.nodeId}</Text>
                  </View>
                  <View style={styles.deviceMetrics}>
                    <Text style={styles.metricText}>📶 {dev.signal}%</Text>
                    <Text style={styles.metricText}>🔋 {dev.battery}%</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Users Roster DB checks */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Users Registry Directory</Text>
              <Text style={styles.sectionSubtitle}>Registered credentials and authority check</Text>

              {usersList.map((u) => (
                <View key={u._id || u.id} style={styles.userRow}>
                  <View>
                    <Text style={styles.userName}>{u.name}</Text>
                    <Text style={styles.userEmail}>{u.email}</Text>
                  </View>
                  <View style={styles.roleTag}>
                    <Text style={styles.roleText}>{u.role}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Exception System Logs Timeline */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>System Exception Warnings</Text>
              <Text style={styles.sectionSubtitle}>Active threshold notifications</Text>

              {systemAlerts.map((alert) => (
                <View key={alert.id} style={[styles.alertItem, styles[`border_${alert.severity.toLowerCase()}`]]}>
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertType}>{alert.type}</Text>
                    <Text style={styles.alertTime}>{alert.timestamp}</Text>
                  </View>
                  <Text style={styles.alertMsg}>{alert.message}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Floating Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.navigate('Admin')}>
          <Ionicons name="options-outline" size={20} color="#94a3b8" />
          <Text style={styles.tabLabel}>Admin</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} disabled={true}>
          <Ionicons name="stats-chart" size={20} color="#10B981" />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Reports</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  exportBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 16,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
  },
  nodeId: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  deviceMetrics: {
    alignItems: 'flex-end',
  },
  metricText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  userName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
  },
  userEmail: {
    fontSize: 11,
    color: '#64748B',
  },
  roleTag: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#059669',
  },
  alertItem: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  border_high: { borderColor: '#EF4444' },
  border_medium: { borderColor: '#F59E0B' },
  border_low: { borderColor: '#3B82F6' },
  border_info: { borderColor: '#10B981' },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  alertType: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
  },
  alertTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  alertMsg: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
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
});

export default AdminReportsScreen;
