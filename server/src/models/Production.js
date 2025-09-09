import mongoose from 'mongoose';
const { Schema } = mongoose;

const ProductionSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,                 // creates a unique index (run ensureIndexes or createIndexes)
    lowercase: true,              // always stored lowercase
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens.'],
    index: true,                  // helps lookups by slug
  },
  branding: {
    logoUrl: { type: String, trim: true },
    primary: { type: String, trim: true },   // hex code or CSS var
    secondary: { type: String, trim: true },
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Compound index for name + slug if you ever want uniqueness per user/org
// ProductionSchema.index({ createdBy: 1, slug: 1 }, { unique: true });

export default mongoose.model('Production', ProductionSchema);
