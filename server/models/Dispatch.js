const mongoose = require('mongoose');

const PieceSchema = new mongoose.Schema({
  lengthDisplay: { type: String, required: true },
  widthDisplay: { type: String, required: true },
  lengthFt: { type: Number, required: true },
  widthFt: { type: Number, required: true },
  sqFt: { type: Number, required: true }
}, { _id: false });

const InventoryGroupSchema = new mongoose.Schema({
  stoneType: { type: String, required: true },
  finish: { type: String, required: true },
  ratePerSqFt: { type: Number, required: true },
  lineTotal: { type: Number, required: true },
  totalSqFt: Number,
  measurementRows: [{
    lengthFt: Number, widthFt: Number, lengthDisplay: String, widthDisplay: String,
    quantity: Number, category: { type: String, enum: ['Regular', 'TOP'] },
    sqFt: Number, lineTotal: Number
  }],
  pieces: [PieceSchema]
}, { _id: false });

const DispatchSchema = new mongoose.Schema({
  dispatchSlipNumber: { type: String, required: true, unique: true, index: true },
  date: { type: Date, required: true, default: Date.now, index: true },
  supervisor: { type: String, required: true },
  partyName: { type: String, trim: true },
  clientRequestId: { type: String, unique: true, sparse: true },
  businessSnapshot: { businessName: String, address: String, phone: String, logoDataUrl: String },
  logistics: {
    truckNumber: { type: String, required: true },
    buyerDestination: { type: String, required: true }
  },
  inventory: [InventoryGroupSchema],
  summary: {
    totalPieces: Number,
    totalDispatchVolumeSqFt: { type: Number, required: true },
    baseMaterialTotal: { type: Number, required: true },
    loadingAndRoyaltyFees: { type: Number, required: true },
    netBillableAmount: { type: Number, required: true }
  },
  status: { type: String, required: true, enum: ['Draft', 'Dispatched', 'Delivered'], default: 'Draft' }
}, { timestamps: true });

module.exports = mongoose.model('Dispatch', DispatchSchema);
