// scripts/seed-production.js
import 'dotenv/config';
import mongoose from 'mongoose';
import Production from '../server/models/Production.js';

const name = process.argv[2] || 'Demo Production';
const slug = (process.argv[3] || 'demo').toLowerCase();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'setdeco' });
    console.log('Connected to Mongo');

    const existing = await Production.findOne({ slug });
    if (existing) {
      console.log('Production already exists:', existing);
    } else {
      const prod = await Production.create({ name, slug, branding: {} });
      console.log('Created new production:', prod);
    }
  } catch (err) {
    console.error('Error seeding production', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();