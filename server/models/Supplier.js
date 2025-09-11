// server/models/Supplier.js
import mongoose from 'mongoose';

const SupplierSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    address:     { type: String, required: true, trim: true },

    // Simple lat/lng holder (not GeoJSON)
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },

    phone:       { type: String, trim: true },
    contactName: { type: String, trim: true },
    hours:       { type: String, trim: true },

    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // 🔑 Tenant scope
    productionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Production',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Text search helpers
SupplierSchema.index({ name: 'text', address: 'text', contactName: 'text' });

// Useful non-unique compound index for fast lookups per tenant
SupplierSchema.index({ productionId: 1, name: 1, address: 1 });

export default mongoose.model('Supplier', SupplierSchema);
