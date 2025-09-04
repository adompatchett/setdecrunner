import mongoose from 'mongoose';


const UserSchema = new mongoose.Schema({
oauthProvider: { type: String, enum: ['google', 'facebook'], required: true },
oauthId: { type: String, required: true },
name: String,
email: { type: String, index: true },
photo: String,
role: { type: String, enum: ['admin', 'driver', 'user'], default: 'user' },
siteAuthorized: { type: Boolean, default: false },
banned: { type: Boolean, default: false }
}, { timestamps: true });


export default mongoose.model('User', UserSchema);