import mongoose from 'mongoose';

const { Schema } = mongoose;

const RESERVED = new Set([
  'login','logout','register','signup','pricing','buy','purchase','billing',
  'about','contact','help','support','terms','privacy','dashboard',
  'api','assets','static','auth','users'
]);

const MemberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'editor' },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export function normalizeSlug(input = '') {
  return String(input)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// server/models/Production.js  (add fields if not present)

const ProductionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug:  { type: String, required: true, trim: true, unique: true, index: true },

    // Who claimed ownership first (used as the canonical admin)
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // Per-production memberships (authoritative for roles)
    members: { type: [MemberSchema], default: [] },

    // (existing) Stripe & flags
    stripe:   { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
     productionphone:   { type: String, trim: true, default: '' },
    productionaddress: { type: String, trim: true, default: '' },
    productioncompany: { type: String, trim: true, default: '' },

    // (Optional) legacy/aliases so old code continues to work
    name:    { type: String, trim: true, default: '' },
    phone:   { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);



ProductionSchema.pre('validate', function(next) {
  if (this.slug) this.slug = normalizeSlug(this.slug);
  if (!this.slug && this.title) this.slug = normalizeSlug(this.title);
  if (!this.slug) return next(new Error('Slug required'));
  if (RESERVED.has(this.slug)) return next(new Error('Slug is reserved'));
  next();
});

// Virtuals: normalized getters so callers can use either style
ProductionSchema.virtual('vCompanyName').get(function () {
  return this.productioncompany || this.company || this.productionname || this.name || '';
});
ProductionSchema.virtual('vProductionTitle').get(function () {
  // If you want a distinct “title” (show/production title) separate from company name:
  return this.productionname || this.name || '';
});
ProductionSchema.virtual('vPhone').get(function () {
  return this.productionphone || this.phone || '';
});
ProductionSchema.virtual('vAddress').get(function () {
  return this.productionaddress || this.address || '';
});

ProductionSchema.index({ 'members.user': 1 }); // fast membership lookups

export default mongoose.model('Production', ProductionSchema);