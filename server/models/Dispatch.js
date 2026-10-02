const mongoose = require('mongoose');

const PieceSchema = new mongoose.Schema({
  lengthFt: { type: Number, required: true },
  widthFt: { type: Number, required: true },
  sqFt: { type: Number, required: true }
}, { _id: false });

const InventoryGroupSchema = new mongoose.Schema({
  stoneType: { type: String, required: true },
  finish: { type: String, required: true },
  ratePerSqFt: { type: Number, required: true },
  lineTotal: { type: Number, required: true },
  pieces: [PieceSchema]
}, { _id: false });

const DispatchSchema = new mongoose.Schema({
  dispatchSlipNumber: { type: String, required: true, unique: true, index: true },
  date: { type: Date, required: true, default: Date.now, index: true },
  supervisor: { type: String, required: true },
  logistics: {
    truckNumber: { type: String, required: true },
    buyerDestination: { type: String, required: true }
  },
  inventory: [InventoryGroupSchema],
  summary: {
    totalDispatchVolumeSqFt: { type: Number, required: true },
    baseMaterialTotal: { type: Number, required: true },
    loadingAndRoyaltyFees: { type: Number, required: true },
    netBillableAmount: { type: Number, required: true }
  },
  status: { type: String, required: true, enum: ['Draft', 'Dispatched', 'Delivered'], default: 'Draft' }
}, { timestamps: true });

module.exports = mongoose.model('Dispatch', DispatchSchema);
