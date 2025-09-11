import { Router } from 'express';
import User from '../models/User.js';
import Production from '../models/Production.js';

const router = Router();

export async function requireOwner(req, res, next) {
  const prod = await Production.findById(req.productionId).select('_id ownerUserId').lean();
  if (!prod) return res.status(404).json({ error: 'Production not found' });

  // If owner not set, let the current member claim ownership atomically
  if (!prod.ownerUserId) {
    const updated = await Production.findOneAndUpdate(
      { _id: prod._id, $or: [{ ownerUserId: { $exists: false } }, { ownerUserId: null }] },
      { $set: { ownerUserId: req.user.id } },
      { new: true }
    ).lean();

    // If someone else claimed it in between and it's not this user, block
    if (updated.ownerUserId && String(updated.ownerUserId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Owner permissions required' });
    }
    return next();
  }

  if (String(prod.ownerUserId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Owner permissions required' });
  }
  next();
}

/**
 * GET members of this production
 */
router.get('/members', async (req, res) => {
  const users = await User.find({ productionIds: req.productionId })
    .select('_id email name role')
    .lean();
  res.json({ items: users });
});

/**
 * Add a member by email (owner only)
 * body: { email }
 */
router.post('/members', requireOwner, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await User.findOneAndUpdate(
    { email },
    { $setOnInsert: { email }, $addToSet: { productionIds: req.productionId } },
    { upsert: true, new: true }
  );

  res.json({ ok: true, user: { id: user._id, email: user.email } });
});

/**
 * Remove a member (owner only)
 */
router.delete('/members/:userId', requireOwner, async (req, res) => {
  const { userId } = req.params;

  // owner cannot remove themself (optional rule)
  const prod = await Production.findById(req.productionId).select('ownerUserId').lean();
  if (String(prod.ownerUserId) === String(userId)) {
    return res.status(400).json({ error: 'Owner cannot be removed' });
  }

  await User.updateOne(
    { _id: userId },
    { $pull: { productionIds: req.productionId } }
  );

  res.json({ ok: true });
});

export default router;