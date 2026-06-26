/**
 * AgriSense AI Copilot Service - Localized to Taguig City Urban Agriculture Program
 * Analyzes crop sensor data (Moisture, Temp, Humidity, Water Level) against ideal urban farming profiles.
 */

const IDEAL_CONDITIONS = {
  Pechay: { minMoisture: 65, maxMoisture: 80, minTemp: 18, maxTemp: 28, minWaterLevel: 2, maxWaterLevel: 5, label: 'Pechay' },
  Tomato: { minMoisture: 60, maxMoisture: 75, minTemp: 21, maxTemp: 30, minWaterLevel: 3, maxWaterLevel: 6, label: 'Tomato' },
  Eggplant: { minMoisture: 65, maxMoisture: 75, minTemp: 22, maxTemp: 32, minWaterLevel: 4, maxWaterLevel: 8, label: 'Eggplant' },
  Okra: { minMoisture: 55, maxMoisture: 70, minTemp: 24, maxTemp: 35, minWaterLevel: 2, maxWaterLevel: 5, label: 'Okra' },
  Chili: { minMoisture: 50, maxMoisture: 65, minTemp: 20, maxTemp: 32, minWaterLevel: 2, maxWaterLevel: 4, label: 'Chili' },
};

export const generateCropInsights = (field) => {
  const { name, cropType, soilMoisture, temperature, humidity, waterLevel = 0 } = field;
  const config = IDEAL_CONDITIONS[cropType] || { minMoisture: 55, maxMoisture: 75, minTemp: 20, maxTemp: 32, minWaterLevel: 2, maxWaterLevel: 5, label: cropType };

  const insights = [];
  let urgency = 'Low';

  // 1. Analyze Moisture (Controls 5V Pump Actuation recommendation)
  if (soilMoisture < config.minMoisture) {
    urgency = 'High';
    insights.push(
      `💧 **Soil moisture is Low (${soilMoisture}%)**: Ideal range is ${config.minMoisture}%–${config.maxMoisture}%. Under-watering slowsPeachy/Tomato growth and stresses roots. **Action Required:** The 5V Water Pump has been automatically activated to irrigate the field until moisture reaches optimal thresholds.`
    );
  } else if (soilMoisture > config.maxMoisture) {
    insights.push(
      `🌊 **Soil is Over-saturated (${soilMoisture}%)**: Exceeds maximum threshold of ${config.maxMoisture}%. This can starve roots of oxygen and trigger root rot. **Recommendation:** Ensure proper drainage in the farm plot and defer all watering.`
    );
  } else {
    insights.push(
      `✅ **Soil moisture is Optimal (${soilMoisture}%)**: Inside the healthy ${config.minMoisture}%–${config.maxMoisture}% range. Ideal for active root transpiration and nutrient absorption.`
    );
  }

  // 2. Analyze Water Level (Capacitive Water Level Sensor)
  if (waterLevel < config.minWaterLevel) {
    urgency = urgency === 'High' ? 'High' : 'Medium';
    insights.push(
      `🚰 **Water Reservoir Level is Low (${waterLevel} cm)**: Below the safety minimum of ${config.minWaterLevel} cm. This may cause dry conditions or damage the 5V pump if run dry. **Action Required:** Replenish the water reservoir feed immediately.`
    );
  } else if (waterLevel > config.maxWaterLevel) {
    insights.push(
      `⚠️ **Water Reservoir level is High (${waterLevel} cm)**: Exceeds the recommended capacity of ${config.maxWaterLevel} cm. Monitor the supply tank for overflow risks.`
    );
  } else {
    insights.push(
      `✅ **Water Reservoir is Stable (${waterLevel} cm)**: Sufficient buffer capacity exists to run automated 5V Pump cycles.`
    );
  }

  // 3. Analyze Temperature (DHT11)
  if (temperature < config.minTemp) {
    insights.push(
      `🌡️ **Cool Air Temperature (${temperature}°C)**: Below the ideal ${config.minTemp}°C. Pechay/Tomato leaf growth might slow down. Monitor early morning microclimates.`
    );
  } else if (temperature > config.maxTemp) {
    urgency = urgency === 'High' ? 'High' : 'Medium';
    insights.push(
      `🔥 **Heat Stress Alert (${temperature}°C)**: Exceeds recommended ${config.maxTemp}°C for Taguig City urban farming. Leaf respiration increases, draining water reserves. **Recommendation:** Apply organic mulching or shade netting to lower soil temperature.`
    );
  } else {
    insights.push(
      `☀️ **Air Temperature is Optimal (${temperature}°C)**: Promotes optimal photosynthesis and vegetative development.`
    );
  }

  // 4. Analyze Air Humidity (DHT11)
  if (humidity > 75) {
    urgency = urgency === 'High' ? 'High' : 'Medium';
    insights.push(
      `🐛 **High Relative Humidity (${humidity}%)**: Creates a microclimate highly susceptible to fungal blights (like leaf spot or mildew). **Action Required:** Ensure spacing between Pechay/Tomato leaves to allow adequate air ventilation.`
    );
  } else if (humidity < 40) {
    insights.push(
      `🍃 **Dry Air Advisory (${humidity}%)**: Promotes dry wind stress, accelerating water loss through leaf stomata.`
    );
  } else {
    insights.push(
      `🌾 **Humidity is Balanced (${humidity}%)**: Healthy air moisture, minimizing mold and leaf stress risks.`
    );
  }

  // Synthesis Summary
  let summary = '';
  if (urgency === 'High') {
    summary = `⚠️ **AI Copilot Diagnostic:** Critical conditions detected in **${name}**. Adjust water reservoir level or ensure the 5V Pump completes its irrigation cycle.`;
  } else if (urgency === 'Medium') {
    summary = `⚡ **AI Copilot Diagnostic:** Environmental anomalies detected. Review warning parameters to optimize crop health.`;
  } else {
    summary = `🌟 **AI Copilot Diagnostic:** Dynamic settings are fully aligned. Crop is performing in optimal parameters.`;
  }

  return {
    urgency,
    summary,
    insights,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
};
