// middleware/tenant.js
import Production from '../models/Production.js';

export async function resolveTenant(req, res, next) {
  try {
    const slug = (req.headers['x-production-slug'] || '').toLowerCase();
    if (!slug) return res.status(400).json({ error: 'Missing x-production-slug header' });

    const prod = await Production.findOne({ slug }).select('_id slug');
    if (!prod) return res.status(404).json({ error: 'Production not found' });

    req.productionId = prod._id;
    req.productionSlug = prod.slug;
    next();
  } catch (e) { next(e); }
}