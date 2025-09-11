import mongoose from 'mongoose';

const { Schema } = mongoose;

const UserSchema = new Schema({
  email:       { type: String, required: true, lowercase: true, unique: true, index: true },
  name:        { type: String },
  passwordHash:{ type: String },                 // for local login
  providers: {                                   // for social auth
    googleId:   { type: String, index: true },
    facebookId: { type: String, index: true },
  },
  productionIds: [{ type: Schema.Types.ObjectId, ref: 'Production' }], // memberships
  role: { type: String, default: 'user' },
}, { timestamps: true });

export default mongoose.model('User', UserSchema);
