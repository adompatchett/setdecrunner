import express from 'express';
import mongoose from 'mongoose';
import Set from '../models/Set.js';
import { authRequired, requireSiteAuthorized, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require auth + site authorization
router.use(authRequired, requireSiteAuthorized);

// GET /sets?q=...&limit=...
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 200);
    const query = q
      ? {
          $or: [
            { name:   { $regex: q, $options: 'i' } },
            { number: { $regex: q, $options: 'i' } },
          ]
        }
      : {};
    const sets = await Set.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
    res.json(sets);
  } catch (e) { next(e); }
});

// POST /sets
router.post('/', async (req, res, next) => {
  try {
    const { name = 'Untitled Set', number, description = '' } = req.body || {};
    if (!number) return res.status(400).json({ error: 'number is required' });
    const s = await Set.create({ name, number, description });
    res.status(201).json(s);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Set number must be unique' });
    next(e);
  }
});

// GET /sets/:id
router.get('/:id', async (req, res, next) => {
  try {
    const s = await Set.findById(req.params.id).lean();
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (e) { next(e); }
});

// PATCH /sets/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, number, description } = req.body || {};
    const update = {};
    if (name !== undefined) update.name = name;
    if (number !== undefined) update.number = number;
    if (description !== undefined) update.description = description;

    const s = await Set.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Set number must be unique' });
    next(e);
  }
});

// DELETE /sets/:id (admin only)
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const s = await Set.findById(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });
    await Set.deleteOne({ _id: s._id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;