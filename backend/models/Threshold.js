const mongoose = require('mongoose');

const thresholdSchema = new mongoose.Schema({
  moistureMin: {
    type: Number,
    required: true,
    default: 50
  },
  tempMax: {
    type: Number,
    required: true,
    default: 32
  },
  reservoirMin: {
    type: Number,
    required: true,
    default: 2.0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Threshold', thresholdSchema);
