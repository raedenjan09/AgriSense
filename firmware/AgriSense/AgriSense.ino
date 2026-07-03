#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ==========================================
// CONFIGURATION - Update these values
// ==========================================
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Your backend API endpoint. 
// If running locally, use your computer's local IP address (e.g., http://192.168.1.100:5000/sensors/data)
// DO NOT use "localhost" or "127.0.0.1" as the ESP32 is a separate device on the network.
const char* serverName = "http://192.168.0.114:5000/api/sensors/data";

// Time between sensor reads and uploads (in milliseconds)
const unsigned long sendInterval = 10000; 

// ==========================================
// PIN CONFIGURATION
// ==========================================
#define DHTPIN 4              // Digital pin connected to the DHT11 sensor
#define DHTTYPE DHT11         // DHT 11
#define SOIL_MOISTURE_PIN 34  // Analog pin for Soil Moisture Sensor (ADC1_CH6)
#define WATER_LEVEL_PIN 35    // Analog pin for Water Level Sensor (ADC1_CH7)

// ==========================================
// SENSOR CALIBRATION VALUES
// ==========================================
// Calibration values for Capacitive Soil Moisture Sensor (12-bit ADC: 0 - 4095)
const int AirValue = 3200;   // Value in dry air
const int WaterValue = 1300; // Value in water

// Calibration values for Water Level Sensor (12-bit ADC: 0 - 4095)
const int EmptyReservoirValue = 0;   // Sensor dry
const int FullReservoirValue = 2500;  // Sensor fully submerged
const float MaxWaterDepthCm = 10.0;  // Max height of sensor in cm

// Initialize DHT sensor
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastTime = 0;

void setup() {
  Serial.begin(115200);
  
  // Enable internal pull-up resistor to help with DHT reading failures
  pinMode(DHTPIN, INPUT_PULLUP);
  
  // Initialize DHT
  dht.begin();
  
  // Set ADC resolution to 12-bit (0 - 4095)
  analogReadResolution(12);

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Connected! IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Wait for the defined interval before reading sensors and posting
  if ((millis() - lastTime) >= sendInterval) {
    if (WiFi.status() == WL_CONNECTED) {
      
      // 1. Read DHT11 Sensor (Temperature & Humidity)
      float humidity = dht.readHumidity();
      float temperature = dht.readTemperature(); // Celsius

      // Check if any reads failed and set to 0 as fallback
      if (isnan(humidity) || isnan(temperature)) {
        Serial.println(F("Failed to read from DHT sensor! Setting to 0."));
        humidity = 0.0;
        temperature = 0.0;
      }

      // 2. Read Capacitive Soil Moisture
      int soilMoistureAnalog = analogRead(SOIL_MOISTURE_PIN);
      // Map analog reading to a percentage (0% to 100%)
      // Since it's capacitive, higher analog values = drier soil
      float soilMoisturePercent = map(soilMoistureAnalog, AirValue, WaterValue, 0, 100);
      soilMoisturePercent = constrain(soilMoisturePercent, 0.0, 100.0);

      // 3. Read Water Level Sensor
      int waterLevelAnalog = analogRead(WATER_LEVEL_PIN);
      // Map analog reading to cm
      float waterLevelCm = map(waterLevelAnalog, EmptyReservoirValue, FullReservoirValue, 0, MaxWaterDepthCm * 100) / 100.0;
      waterLevelCm = constrain(waterLevelCm, 0.0, MaxWaterDepthCm);

      // Log values to Serial Monitor
      Serial.println("--- Sensor Readings ---");
      Serial.print("Temperature: "); Serial.print(temperature); Serial.println(" °C");
      Serial.print("Humidity: "); Serial.print(humidity); Serial.println(" %");
      Serial.print("Soil Moisture: "); Serial.print(soilMoisturePercent); Serial.println(" %");
      Serial.print("Water Level: "); Serial.print(waterLevelCm); Serial.println(" cm");
      Serial.println("-----------------------");

      // 4. Construct JSON Payload
      WiFiClient client;
      HTTPClient http;
      
      http.begin(client, serverName);
      http.addHeader("Content-Type", "application/json");

      String jsonPayload = "{\"soilMoisture\":" + String(soilMoisturePercent, 1) + 
                           ",\"temperature\":" + String(temperature, 1) + 
                           ",\"humidity\":" + String(humidity, 1) + 
                           ",\"waterLevel\":" + String(waterLevelCm, 1) + "}";

      Serial.print("Sending POST request to backend: ");
      Serial.println(jsonPayload);
      
      int httpResponseCode = http.POST(jsonPayload);
      
      if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.print("HTTP Response code: ");
        Serial.println(httpResponseCode);
        Serial.print("Response: ");
        Serial.println(response);
      } else {
        Serial.print("Error code in POST request: ");
        Serial.println(httpResponseCode);
      }
      
      http.end();
    } else {
      Serial.println("WiFi Disconnected. Reconnecting...");
      WiFi.disconnect();
      WiFi.begin(ssid, password);
    }
    
    lastTime = millis();
  }
}
