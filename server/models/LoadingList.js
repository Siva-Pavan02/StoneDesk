const mongoose = require('mongoose');

const LoadedPieceSchema = new mongoose.Schema({
  lengthDisplay: { type: String },
  widthDisplay: { type: String },
  lengthFt: { type: Number, required: true },
  widthFt: { type: Number, required: true },
  sqFt: { type: Number, required: true }
}, { _id: false });

const RequirementSchema = new mongoose.Schema({
  lengthDisplay: { type: String },
  widthDisplay: { type: String },
  lengthFt: { type: Number, required: true, min: 0 },
  widthFt: { type: Number, required: true, min: 0 },
  requiredQuantity: { type: Number, required: true, min: 0 },
  loadedQuantity: { type: Number, required: true, default: 0, min: 0 },
  balance: { type: Number, required: true },
  loadedPieces: [LoadedPieceSchema]
});

const LoadingListSchema = new mongoose.Schema({
  loadingListNumber: { type: String, required: true, unique: true, index: true },
  date: { type: Date, required: true, default: Date.now, index: true },
  supervisor: { type: String, required: true },
  buyerDestination: { type: String, required: true },
  stoneType: { type: String, required: true },
  finish: { type: String, required: true },
  requirements: [RequirementSchema],
  status: { type: String, required: true, enum: ['Draft', 'Loading', 'Completed'], default: 'Draft' }
}, { timestamps: true });

module.exports = mongoose.model('LoadingList', LoadingListSchema);
