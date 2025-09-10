import mongoose from 'mongoose';

const SetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // Use string so you can support things like "S-101" or "01"
  number: { type: String, required: true, trim: true, index: true, unique: true },
  description: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('Set', SetSchema);