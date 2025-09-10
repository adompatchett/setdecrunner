import mongoose from 'mongoose';

const SupplierSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  address:     { type: String, required: true, trim: true },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  phone:       { type: String, trim: true },       // telephone
  contactName: { type: String, trim: true },       // contact name
  hours:       { type: String, trim: true },       // hours of operation (free text)
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

SupplierSchema.index({ name: 'text', address: 'text', contactName: 'text' });

export default mongoose.model('Supplier', SupplierSchema);