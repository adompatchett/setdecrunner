// scripts/seed-production.js
import 'dotenv/config';
import mongoose from 'mongoose';
import Production from '../src/models/Production.js';

await mongoose.connect(process.env.MONGO_URI, { dbName: 'setdeco' });

const name = process.argv[2] || 'Demo Production';
const slug = (process.argv[3] || 'demo').toLowerCase();

const existing = await Production.findOne({ slug });
if (existing) {
  console.log('Already exists:', slug);
} else {
  await Production.create({ name, slug, branding: {} });
  console.log('Created production:', { name, slug });
}

await mongoose.disconnect();
process.exit(0);