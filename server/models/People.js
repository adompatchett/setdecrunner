// server/models/People.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const PersonSchema = new Schema(
  {
    // 🔹 Scope every person to a production (tenant)
    productionId: {
      type: Schema.Types.ObjectId,
      ref: 'Production',
      required: true,
      index: true,
    },

    // Optional link to an app user (if the person has a login)
    user: { type: Schema.Types.ObjectId, ref: 'User' },

    // Display identity for runsheets/search
    name:  { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },

    // Optional notes/role for internal use
    role:  { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },

    // Photo stored as a public path (e.g., "/uploads/people/<id>/<file>")
    photo: { type: String, default: null },
  },
  { timestamps: true }
);

// Text search
PersonSchema.index({ name: 'text', email: 'text', phone: 'text', role: 'text' });

// Helpful compound indexes
PersonSchema.index({ productionId: 1, name: 1 });
PersonSchema.index({ productionId: 1, createdAt: -1 });

// Enforce unique email per production (only when email is non-empty)
PersonSchema.index(
  { productionId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string', $ne: '' } } }
);

// Query helper to scope by production
PersonSchema.query.byProduction = function (prodId) {
  return this.where({ productionId: prodId });
};

export default mongoose.model('Person', PersonSchema);
