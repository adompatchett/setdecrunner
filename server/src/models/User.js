// server/models/User.js  (ESM shown; convert to CJS if needed)
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { tenantScopePlugin } from '../plugins/tenantScope.js';

const { Schema } = mongoose;

const UserSchema = new Schema({
  provider: { type: String, enum: ['local','google','facebook'], default: 'local' },
  oauthProvider: { type: String, enum: ['google','facebook'], sparse: true },
  oauthId: { type: String, sparse: true },

  username:   { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  firstName:  { type: String, trim: true },
  lastName:   { type: String, trim: true },
  email:      { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  password:   { type: String, select: false },

  role: { type: String, enum: ['admin','driver','user'], default: 'user' },
  siteAuthorized: { type: Boolean, default: false },
  banned: { type: Boolean, default: false },

  mustChangePassword: { type: Boolean, default: false },

  // Password reset / invite
  passwordResetToken: { type: String, index: true },
  passwordResetExpires: { type: Date },
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Generate a reset token; store a hashed version and expiry
UserSchema.methods.issueResetToken = function() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  this.passwordResetToken = hash;
  this.passwordResetExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
  return raw; // send this in the email link
};

export default mongoose.model('User', UserSchema);

