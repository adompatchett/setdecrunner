// server/routes/productions.js
import { Router } from 'express';
import Production from '../models/Production.js';
import { authRequired } from '../middleware/auth.js';

const r = Router();

// Public read (optional)
r.get('/productions', async (_, res, next) => {
  try {
    const list = await Production.find({}).select('name slug').sort('name');
    res.json(list);
  } catch (e) { next(e); }
});

// Admin create (lock this down however you want)
r.post('/productions', authRequired, async (req, res, next) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
    const doc = await Production.create({ name, slug: slug.toLowerCase() });
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

export default r;