import mongoose from 'mongoose';
import { tenantScopePlugin } from '../plugins/tenantScope.js';


const PlaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    googlePlaceId: {
      type: String
    },
    address: String,
    lat: Number,
    lng: Number,
    phone: String,
    website: String,
    notes: String,
    photos: [String],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

PlaceSchema.plugin(tenantScopePlugin);

export default mongoose.model('Place', PlaceSchema);