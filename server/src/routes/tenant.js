import { Router } from 'express';
import Production from '../models/Production.js';

const router = Router();

router.get('/tenant/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!slug) return res.status(400).json({ error: 'Missing slug' });

    const p = await Production.findOne({ slug }).select('name slug branding');
    if (!p) return res.status(404).json({ error: 'Not found' });

    res.json({ name: p.name, slug: p.slug, branding: p.branding || {} });
  } catch (e) { next(e); }
});

export default router;