const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  passwordSalt: { type: String, required: true, select: false },
  role: { type: String, enum: ['Admin', 'Yard Manager', 'Dispatcher'], default: 'Dispatcher' },
  active: { type: Boolean, default: false },
  ownerSlot: { type: String, unique: true, sparse: true }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
