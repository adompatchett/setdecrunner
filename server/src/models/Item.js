import mongoose from 'mongoose';
import { tenantScopePlugin } from '../plugins/tenantScope.js';


const ItemSchema = new mongoose.Schema({
name: { type: String, required: true, index: 'text' },
description: String,
quantity: { type: Number, default: 1 },
tags: [String],
photos: [String],
location: { type: mongoose.Schema.Types.ObjectId, ref: 'Place' },
owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
archived: { type: Boolean, default: false }
}, { timestamps: true });

ItemSchema.plugin(tenantScopePlugin);


export default mongoose.model('Item', ItemSchema);