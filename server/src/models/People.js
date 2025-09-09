import mongoose from 'mongoose';
import { tenantScopePlugin } from '../plugins/tenantScope.js';

const PersonSchema = new mongoose.Schema({
  // Optional link to an app user (if the person has a login)
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Display identity for runsheets/search
  name:   { type: String, required: true, trim: true },
  email:  { type: String, trim: true, default: '' },
  phone:  { type: String, trim: true, default: '' },

  // Optional notes/role for internal use
  role:   { type: String, trim: true, default: '' },
  notes:  { type: String, trim: true, default: '' },

  // NEW: photo stored as a public path (e.g., "/uploads/people/<id>/<file>")
  photo:  { type: String, default: null },
}, { timestamps: true });

PersonSchema.index({ name: 'text', email: 'text', phone: 'text', role: 'text' });
PersonSchema.plugin(tenantScopePlugin);

export default mongoose.model('Person', PersonSchema);