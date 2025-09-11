// server/models/Item.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const ItemSchema = new Schema(
  {
    // 🔹 Scope every item to a production
    productionId: {
      type: Schema.Types.ObjectId,
      ref: 'Production',
      required: true,
      index: true,
    },

    name: { type: String, required: true },
    description: String,
    quantity: { type: Number, default: 1 },
    tags: [String],
    photos: [String],

    location: { type: Schema.Types.ObjectId, ref: 'Place' },
    owner: { type: Schema.Types.ObjectId, ref: 'User' },

    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Full-text search across common fields
ItemSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Helpful compound indexes for typical filters/sorts
ItemSchema.index({ productionId: 1, archived: 1, createdAt: -1 });
ItemSchema.index({ productionId: 1, name: 1 });

// Optional: query helper to enforce scoping in routes
ItemSchema.query.byProduction = function (prodId) {
  return this.where({ productionId: prodId });
};

export default mongoose.model('Item', ItemSchema);

