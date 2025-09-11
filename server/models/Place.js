// server/models/Place.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const PlaceSchema = new Schema(
  {
    // 🔹 Scope every place to a production (tenant)
    productionId: {
      type: Schema.Types.ObjectId,
      ref: 'Production',
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },

    // Optional Google Place ID (unique within a production when present)
    googlePlaceId: { type: String, trim: true },

    address: { type: String, trim: true, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    phone: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    photos: { type: [String], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Text search over common fields
PlaceSchema.index({ name: 'text', address: 'text', phone: 'text' });

// Helpful compound indexes
PlaceSchema.index({ productionId: 1, name: 1 });
PlaceSchema.index({ productionId: 1, createdAt: -1 });

// Enforce googlePlaceId uniqueness per production (only when provided)
PlaceSchema.index(
  { productionId: 1, googlePlaceId: 1 },
  { unique: true, partialFilterExpression: { googlePlaceId: { $exists: true, $type: 'string', $ne: '' } } }
);

// Query helper to scope by production
PlaceSchema.query.byProduction = function (prodId) {
  return this.where({ productionId: prodId });
};

export default mongoose.model('Place', PlaceSchema);
