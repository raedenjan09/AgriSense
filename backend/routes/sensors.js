const express = require('express');
const SensorReading = require('../models/SensorReading');

const router = express.Router();

// POST: Receives sensor data from the ESP32
router.post('/data', async (req, res) => {
  try {
    const { soilMoisture, temperature, humidity, waterLevel } = req.body;

    // Create a reading record. Missing values default to 0 (allowing modular testing)
    const reading = new SensorReading({
      soilMoisture: soilMoisture !== undefined ? soilMoisture : 0,
      temperature: temperature !== undefined ? temperature : 0,
      humidity: humidity !== undefined ? humidity : 0,
      waterLevel: waterLevel !== undefined ? waterLevel : 0,
    });

    const savedReading = await reading.save();
    console.log('Successfully saved sensor reading:', savedReading);
    
    res.status(201).json({ 
      success: true, 
      message: 'Sensor reading saved successfully',
      data: savedReading 
    });
  } catch (error) {
    console.error('Error saving sensor reading:', error);
    res.status(500).json({ success: false, message: 'Server error saving sensor reading', error: error.message });
  }
});

// GET: Fetches the most recent sensor reading
router.get('/latest', async (req, res) => {
  try {
    const latestReading = await SensorReading.findOne().sort({ timestamp: -1 });
    
    if (!latestReading) {
      // Return a friendly default if no data has been uploaded yet
      return res.json({
        soilMoisture: 0,
        temperature: 0,
        humidity: 0,
        waterLevel: 0,
        timestamp: new Date()
      });
    }

    res.json(latestReading);
  } catch (error) {
    console.error('Error fetching latest reading:', error);
    res.status(500).json({ success: false, message: 'Server error fetching latest reading', error: error.message });
  }
});

// GET: Fetches historical logs (last 50 readings) chronological
router.get('/history', async (req, res) => {
  try {
    const readings = await SensorReading.find()
      .sort({ timestamp: -1 })
      .limit(50);
      
    // Reverse array to return chronological order (oldest to newest) for charting
    res.json(readings.reverse());
  } catch (error) {
    console.error('Error fetching sensor history:', error);
    res.status(500).json({ success: false, message: 'Server error fetching sensor history', error: error.message });
  }
});

module.exports = router;
