const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  // All fields are optional to facilitate modular sensor testing (e.g. testing with only moisture first)
  soilMoisture: {
    type: Number,
    default: 0
  },
  temperature: {
    type: Number,
    default: 0
  },
  humidity: {
    type: Number,
    default: 0
  },
  waterLevel: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
