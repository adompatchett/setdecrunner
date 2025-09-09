// src/routes/people.js
import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { resolveTenant } from '../middleware/tenant.js';
import { withTenant } from '../utils/withTenant.js';

import Person from '../models/People.js';
import { authRequired, requireSiteAuthorized, requireRole } from '../middleware/auth.js';

const router = express.Router();

const objectId = (id) =>
  (id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null);

// ---------------------------- Upload utils ---------------------------------
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
await fs.mkdir(UPLOAD_ROOT, { recursive: true });

function setUploadDest(fn) {
  return async (req, res, next) => {
    try {
      req.uploadDest = await fn(req);
      await fs.mkdir(req.uploadDest, { recursive: true });
      next();
    } catch (e) {
      next(e);
    }
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, req.uploadDest || UPLOAD_ROOT),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    cb(null, base + ext);
  }
});
const upload = multer({ storage });

const toPublicPath = (absPath) => {
  const rel = path.relative(path.resolve(process.cwd(), 'uploads'), absPath);
  return '/uploads/' + rel.replace(/\\/g, '/');
};

const unlinkIfExists = async (abs) => {
  try { await fs.unlink(abs); } catch { /* ignore */ }
};

// ---------------------------- Middleware -----------------------------------
router.use(authRequired, requireSiteAuthorized);

// ---------------------------- List -----------------------------------------
/**
 * GET /people?q=...&limit=...
 */
router.get('/', authRequired,resolveTenant, withTenant( async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);

    const filter = q
      ? {
          $or: [
            { name:  { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
            { phone: { $regex: q, $options: 'i' } },
          ],
        }
      : {};

    const list = await Person.find(filter)
      .sort({ name: 1 })
      .limit(limit)
      .populate('user', 'name email role photo')
      .lean();

    res.json(list);
  } catch (e) { next(e); }
}));

// ---------------------------- Create ---------------------------------------
/**
 * POST /people
 * Allow any authenticated, site-authorized user to create a person.
 */
router.post('/',authRequired,resolveTenant, withTenant( async (req, res, next) => {
  try {
    const { name = '', email = '', phone = '', user = null, notes = '', role = '', photo = null } = req.body || {};

    if (!name && !email) {
      return res.status(400).json({ error: 'Name or email is required' });
    }

    const userId = user
      ? (typeof user === 'string' ? objectId(user) : objectId(user?._id || user?.id))
      : null;

    const created = await Person.create({
      name,
      email,
      phone,
      user: userId,
      notes,
      role,
      photo: photo || null,
    });

    const full = await Person.findById(created._id).populate('user', 'name email role photo').lean();
    res.status(201).json(full);
  } catch (e) { next(e); }
}));

// ---------------------------- Read -----------------------------------------
/**
 * GET /people/:id
 */
router.get('/:id',authRequired,resolveTenant, withTenant( async (req, res, next) => {
  try {
    const p = await Person.findById(req.params.id).populate('user', 'name email role photo').lean();
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (e) { next(e); }
}));

// ---------------------------- Update ---------------------------------------
/**
 * PATCH /people/:id
 * Allow any authenticated, site-authorized user to edit.
 */
router.patch('/:id', authRequired,resolveTenant, withTenant( async (req, res, next) => {
  try {
    const { name, email, phone, user, notes, role, photo } = req.body || {};
    const update = {};

    if (name !== undefined)  update.name  = name;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;
    if (notes !== undefined) update.notes = notes;
    if (role !== undefined)  update.role  = role;
    if (photo !== undefined) update.photo = photo; // allow direct string update if desired

    if (user !== undefined) {
      const userId = user ? (typeof user === 'string' ? objectId(user) : objectId(user?._id || user?.id)) : null;
      update.user = userId;
    }

    await Person.findByIdAndUpdate(req.params.id, { $set: update });
    const full = await Person.findById(req.params.id).populate('user', 'name email role photo').lean();
    if (!full) return res.status(404).json({ error: 'Not found' });
    res.json(full);
  } catch (e) { next(e); }
}));

// ---------------------------- Delete ---------------------------------------
/**
 * DELETE /people/:id
 * Admin only.
 */
router.delete('/:id', requireRole('admin'),authRequired,resolveTenant, withTenant( async (req, res, next) => {
  try {
    const existed = await Person.findById(req.params.id).select('_id photo');
    if (!existed) return res.status(404).json({ error: 'Not found' });

    // cleanup local photo if stored under /uploads
    if (existed.photo?.startsWith('/uploads/')) {
      const abs = path.join(process.cwd(), existed.photo.replace('/uploads/', 'uploads/'));
      await unlinkIfExists(abs);
    }

    await Person.deleteOne({ _id: existed._id });
    res.json({ ok: true });
  } catch (e) { next(e); }
}));

// ---------------------------- Photo upload ---------------------------------
/**
 * POST /people/:id/photo
 * Body: multipart/form-data; field "photo"
 */
router.post(
  '/:id/photo',
  authRequired,resolveTenant,
  setUploadDest(async (req) => path.join(UPLOAD_ROOT, 'people', req.params.id)),
  upload.single('photo'),
  withTenant(
  async (req, res, next) => {
    try {
      const person = await Person.findById(req.params.id);
      if (!person) return res.status(404).json({ error: 'Not found' });
      if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

      // remove previous local photo (if any)
      if (person.photo?.startsWith('/uploads/')) {
        const prevAbs = path.join(process.cwd(), person.photo.replace('/uploads/', 'uploads/'));
        await unlinkIfExists(prevAbs);
      }

      const publicPath = toPublicPath(path.join(req.uploadDest, req.file.filename));
      person.photo = publicPath;
      await person.save();

      const full = await Person.findById(person._id).populate('user', 'name email role photo').lean();
      res.json(full);
    } catch (e) { next(e); }
  }
));

/**
 * DELETE /people/:id/photo
 * Clears photo field and removes local file if it lives under /uploads.
 */
router.delete('/:id/photo',authRequired,resolveTenant, withTenant( async (req, res, next) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) return res.status(404).json({ error: 'Not found' });

    if (person.photo?.startsWith('/uploads/')) {
      const abs = path.join(process.cwd(), person.photo.replace('/uploads/', 'uploads/'));
      await unlinkIfExists(abs);
    }

    person.photo = null;
    await person.save();

    const full = await Person.findById(person._id).populate('user', 'name email role photo').lean();
    res.json(full);
  } catch (e) { next(e); }
}));

export default router;
