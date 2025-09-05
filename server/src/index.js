// src/server.js (or your main backend entry)
import 'dotenv/config';

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import path from 'path';
import { fileURLToPath } from 'url';
import './config/passport.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import runsheetRoutes from './routes/runsheets.js';
import itemRoutes from './routes/items.js';
import placeRoutes from './routes/places.js';
import supplierRoutes from './routes/suppliers.js';
import peopleRoutes from './routes/people.js';


// 🔹 NEW: Sets routes
import setRoutes from './routes/sets.js';

const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mongo
mongoose
  .connect(process.env.MONGO_URI, { dbName: 'setdeco' })
  .then(() => console.log('Mongo connected'))
  .catch(err => console.error('Mongo error', err));

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(passport.initialize());

// Static uploads (match runsheets upload path logic)
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(UPLOAD_ROOT));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/runsheets', runsheetRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/people', peopleRoutes);
// 🔹 NEW: Sets API
app.use('/api/sets', setRoutes);

// Health
app.get('/api/health', (_, res) => res.json({ ok: true }));

// Start
app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
