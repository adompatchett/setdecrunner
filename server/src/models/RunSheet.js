import mongoose from 'mongoose';


const RunItemSchema = new mongoose.Schema({
item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
name: String,
quantity: { type: Number, default: 1 },
notes: String,
photos: [String]
}, { _id: false });


const StopSchema = new mongoose.Schema({
place: { type: mongoose.Schema.Types.ObjectId, ref: 'Place' },
title: String,
instructions: String,
items: [RunItemSchema]
}, { _id: true });


const RunSheetSchema = new mongoose.Schema({
title: { type: String, required: true },
date: Date,
status: { type: String, enum: ['draft','open','assigned','claimed','in_progress','completed','cancelled'], default: 'draft' },
createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
photos: [String],
stops: [StopSchema]
}, { timestamps: true });


export default mongoose.model('RunSheet', RunSheetSchema);