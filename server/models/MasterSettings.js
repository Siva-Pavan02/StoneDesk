const mongoose = require('mongoose');

const MasterSettingsSchema = new mongoose.Schema({
  quarryId: { type: String, required: true, unique: true, default: 'unit_04' },
  savedTrucks: [{ type: String, uppercase: true }],
  savedDestinations: [{ type: String }],
  stoneRates: [{
    stoneType: { type: String, required: true },
    finish: { type: String, required: true },
    defaultRate: { type: Number, required: true, min: 0 }
  }],
  defaultRoyaltyFee: { type: Number, default: 8500, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model('MasterSettings', MasterSettingsSchema);
