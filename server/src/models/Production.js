// models/Production.js
import mongoose from 'mongoose';
import slugify from 'slugify';

const productionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Production name is required'],
    trim: true,
    maxlength: [200, 'Production name cannot exceed 200 characters']
  },
  
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  type: {
    type: String,
    enum: ['film', 'tv', 'commercial', 'documentary', 'music-video', 'other'],
    default: 'film'
  },
  
  status: {
    type: String,
    enum: ['development', 'pre-production', 'production', 'post-production', 'completed', 'cancelled'],
    default: 'development'
  },
  
  startDate: {
    type: Date
  },
  
  endDate: {
    type: Date
  },
  
  budget: {
    type: Number,
    min: [0, 'Budget cannot be negative']
  },
  
  currency: {
    type: String,
    default: 'USD',
    maxlength: [3, 'Currency code should be 3 characters']
  },
  
  // Production company/owner
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Team members with roles
  team: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['producer', 'director', 'assistant-director', 'coordinator', 'accountant', 'viewer'],
      default: 'viewer'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Production settings
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
      default: 'MM/DD/YYYY'
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
productionSchema.index({ owner: 1, isActive: 1 });
productionSchema.index({ 'team.user': 1 });
productionSchema.index({ status: 1, isActive: 1 });

// Virtual for team count
productionSchema.virtual('teamCount').get(function() {
  return this.team ? this.team.length : 0;
});

// Pre-save middleware to generate slug
productionSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('name')) {
    let baseSlug = slugify(this.name, { 
      lower: true, 
      strict: true,
      remove: /[*+~.()'"!:@]/g 
    });
    
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug is unique
    while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    this.slug = slug;
  }
  next();
});

// Instance methods
productionSchema.methods.addTeamMember = function(userId, role = 'viewer') {
  // Check if user is already on team
  const existingMember = this.team.find(member => member.user.toString() === userId.toString());
  
  if (existingMember) {
    existingMember.role = role;
  } else {
    this.team.push({ user: userId, role });
  }
  
  return this.save();
};

productionSchema.methods.removeTeamMember = function(userId) {
  this.team = this.team.filter(member => member.user.toString() !== userId.toString());
  return this.save();
};

productionSchema.methods.getUserRole = function(userId) {
  if (this.owner.toString() === userId.toString()) {
    return 'owner';
  }
  
  const member = this.team.find(member => member.user.toString() === userId.toString());
  return member ? member.role : null;
};

productionSchema.methods.canUserAccess = function(userId) {
  return this.owner.toString() === userId.toString() || 
         this.team.some(member => member.user.toString() === userId.toString());
};

productionSchema.methods.canUserEdit = function(userId) {
  const role = this.getUserRole(userId);
  return ['owner', 'producer', 'director', 'coordinator'].includes(role);
};

// Static methods
productionSchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug, isActive: true }).populate('owner', 'name email').populate('team.user', 'name email');
};

productionSchema.statics.findUserProductions = function(userId) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { owner: userId },
          { 'team.user': userId }
        ]
      }
    ]
  }).populate('owner', 'name email').sort({ updatedAt: -1 });
};

export default mongoose.model('Production', productionSchema);