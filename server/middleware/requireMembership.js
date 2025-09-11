// server/middleware/requireMembership.js
import Production from '../models/Production.js';

export async function requireMembership(req, res, next) {
  try {
    const prodId =
      req.header('x-production-id') ||
      req.header('X-Production-Id') ||
      req.query.productionId ||
      req.body?.productionId;

    if (!prodId) return res.status(400).json({ error: 'Missing production context' });

    const prod = await Production.findById(prodId)
      .select('_id ownerUserId members title slug')
      .lean();

    if (!prod) return res.status(404).json({ error: 'Production not found' });

    const m = (prod.members || []).find((r) => String(r.user) === String(req.user._id));
    const isProdAdmin =
      String(prod.ownerUserId || '') === String(req.user._id) ||
      (m?.role === 'admin');

    if (!m && !isProdAdmin && !req.user.isAdmin) {
      // (site) superadmin bypass is req.user.isAdmin; otherwise must be member
      return res.status(403).json({ error: 'Not a member of this production' });
    }

    // attach context for downstream handlers
    req.production = prod;
    req.membership = { role: m?.role || (isProdAdmin ? 'admin' : 'viewer') };
    req.isProductionAdmin = isProdAdmin || !!req.user.isAdmin;
    next();
  } catch (e) {
    next(e);
  }
}

/** Optional: gate for production admin */
export function requireProductionAdmin(req, res, next) {
  if (req.isProductionAdmin) return next();
  return res.status(403).json({ error: 'Production admin only' });
}

