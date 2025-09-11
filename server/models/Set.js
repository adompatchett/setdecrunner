// server/models/Set.js
import mongoose from 'mongoose';

const SetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // String so values like "S-101" / "01" are valid; NOT globally unique
    number: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '' },
    // Tenant scope
    productionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Production',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Enforce uniqueness per production (not globally)
SetSchema.index({ productionId: 1, number: 1 }, { unique: true });

// Optional: text search on name/number
SetSchema.index({ name: 'text', number: 'text' });

export default mongoose.model('Set', SetSchema);
