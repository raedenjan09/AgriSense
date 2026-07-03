import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';

const ReportsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const handleExportCSV = async () => {
    try {
      const headers = 'Day,Water Usage (L),Reservoir Level (cm),Field Name,Harvest Projection Progress\n';
      let csvContent = headers;
      
      for (let i = 0; i < 7; i++) {
        const dayData = waterUsage[i];
        const resData = reservoirLevels[i];
        const fieldData = fieldPerformances[i % fieldPerformances.length];
        
        csvContent += `${dayData.day},${dayData.amount},${resData.level},"${fieldData.name}",${Math.round(fieldData.progress * 100)}%\n`;
      }
      
      await Share.share({
        message: csvContent,
        title: 'AgriSense Historical Sensor Report',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share CSV report: ' + error.message);
    }
  };

  // Mock weekly water usage data (Liters)
  const waterUsage = [
    { day: 'Mon', amount: 120, label: '120L' },
    { day: 'Tue', amount: 150, label: '150L' },
    { day: 'Wed', amount: 80, label: '80L' },
    { day: 'Thu', amount: 200, label: '200L' },
    { day: 'Fri', amount: 110, label: '110L' },
    { day: 'Sat', amount: 95, label: '95L' },
    { day: 'Sun', amount: 140, label: '140L' },
  ];

  // Mock weekly reservoir water levels (cm) - Capacitive Water Level Sensor
  const reservoirLevels = [
    { day: 'Mon', level: 4.8 },
    { day: 'Tue', level: 4.5 },
    { day: 'Wed', level: 3.2 },
    { day: 'Thu', level: 2.1 },
    { day: 'Fri', level: 4.9 },
    { day: 'Sat', level: 4.6 },
    { day: 'Sun', level: 4.2 },
  ];

  // Mock field progress data (Taguig City Urban Crops)
  const fieldPerformances = [
    { name: 'TUP Pechay Patch', progress: 0.85, status: 'Excellent', color: '#10B981' },
    { name: 'Bicutan Tomatoes', progress: 0.68, status: 'Good', color: '#059669' },
    { name: 'Okra Terrace North', progress: 0.42, status: 'Seedling Stage', color: '#D97706' },
  ];

  const maxWaterAmount = Math.max(...waterUsage.map((w) => w.amount));
  const maxReservoirLevel = 5.0;

  return (
    <View style={styles.container}>
      {/* Modern Minimalist Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AgriSense Analytics</Text>
        <TouchableOpacity style={styles.exportButton} onPress={handleExportCSV}>
          <Ionicons name="share-outline" size={20} color="#10B981" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Analytics Summary */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.title}>Crop Analytics & Insights</Text>
          <Text style={styles.subtitle}>Historical irrigation and health parameters across all fields</Text>
        </View>

        {/* Highlight Cards with Soft Color Backgrounds */}
        <View style={styles.highlightsContainer}>
          <View style={[styles.highlightCard, styles.highlightCardWater]}>
            <Ionicons name="water-outline" size={26} color="#1d4ed8" style={{ marginBottom: 6 }} />
            <Text style={[styles.highlightValue, styles.highlightValueWater]}>895 Liters</Text>
            <Text style={styles.highlightLabel}>Weekly Water Used</Text>
          </View>
          <View style={[styles.highlightCard, styles.highlightCardYield]}>
            <Ionicons name="beaker-outline" size={26} color="#047857" style={{ marginBottom: 6 }} />
            <Text style={[styles.highlightValue, styles.highlightValueYield]}>4.1 cm</Text>
            <Text style={styles.highlightLabel}>Avg Reservoir Level</Text>
          </View>
        </View>

        {/* Weekly Water Usage Bar Chart (Emerald Green) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Weekly Water Consumption</Text>
          <Text style={styles.sectionSubtitle}>Liters of water applied across fields per day</Text>
          
          <View style={styles.chartContainer}>
            <View style={styles.chartYAxis}>
              <Text style={styles.yLabel}>200L</Text>
              <Text style={styles.yLabel}>100L</Text>
              <Text style={styles.yLabel}>0L</Text>
            </View>
            <View style={styles.chartBars}>
              {waterUsage.map((item, index) => {
                const barHeightPercent = (item.amount / maxWaterAmount) * 100;
                return (
                  <View key={index} style={styles.barWrapper}>
                    <View style={styles.barValueTooltip}>
                      <Text style={styles.tooltipText}>{item.label}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${barHeightPercent}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>{item.day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Water Reservoir Level Trend (Capacitive Water Level Sensor) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Water Reservoir Levels (cm)</Text>
          <Text style={styles.sectionSubtitle}>Daily height levels measured by capacitive sensor</Text>
          
          <View style={styles.reservoirList}>
            {reservoirLevels.map((item, index) => {
              const fillPercent = (item.level / maxReservoirLevel) * 100;
              const isLow = item.level < 2.5;
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

        {/* Crop Yield Progress Bar Chart (Taguig Crops) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Yield Projection Progress</Text>
          <Text style={styles.sectionSubtitle}>Estimated crop maturity vs. target harvest threshold</Text>

          <View style={styles.progressList}>
            {fieldPerformances.map((field, index) => (
              <View key={index} style={styles.progressItem}>
                <View style={styles.progressRow}>
                  <Text style={styles.fieldName}>{field.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: field.color + '15' }]}>
                    <Text style={[styles.statusBadgeText, { color: field.color }]}>{field.status}</Text>
                  </View>
                </View>
                <View style={styles.progressBarTrack}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${field.progress * 100}%`, backgroundColor: field.color }
                    ]} 
                  />
                </View>
                <Text style={styles.progressPercent}>{Math.round(field.progress * 100)}% of target maturity</Text>
              </View>
            ))}
          </View>
        </View>

        {/* AI Recommendations Highlight */}
        <View style={styles.aiAlertCard}>
          <View style={styles.aiHeader}>
            <Ionicons name="bulb-outline" size={20} color="#047857" style={{ marginRight: 6 }} />
            <Text style={styles.aiTitle}>Agronomic Recommendations</Text>
          </View>
          <Text style={styles.aiText}>
            Water level in reservoir dropped below critical 2.0 cm on Thursday, prompting tank replenishment. Currently, Pechay and Tomato fields show healthy moisture values. No active pest risk detected.
          </Text>
        </View>
      </ScrollView>

      {/* Modern Floating Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        {user?.role !== 'Farmer' ? (
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => navigation.navigate('Admin')}
          >
            <Ionicons name="options-outline" size={20} color="#94a3b8" />
            <Text style={styles.tabLabel}>Admin</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => navigation.navigate('Dashboard')}
          >
            <Ionicons name="home-outline" size={20} color="#94a3b8" />
            <Text style={styles.tabLabel}>Dashboard</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.tabItem} 
          disabled={true}
        >
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
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 60,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110, // Avoid bottom tab bar overlap
  },
  welcomeContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
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
  highlightIcon: {
    fontSize: 26,
    marginBottom: 6,
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  fieldName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
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
  aiIcon: {
    fontSize: 20,
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
  exportButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3FDF9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6F7F0',
  },
});

export default ReportsScreen;
