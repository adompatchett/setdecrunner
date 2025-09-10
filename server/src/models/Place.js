import mongoose from 'mongoose';

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

export default mongoose.model('Place', PlaceSchema);