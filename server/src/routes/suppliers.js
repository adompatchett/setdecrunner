import express from 'express';
import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';
import { resolveTenant } from '../middleware/tenant.js';
import { withTenant } from '../utils/withTenant.js';
import { authRequired, requireSiteAuthorized, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require auth + site authorization
router.use(authRequired, requireSiteAuthorized);

// Helpers
const toNumber = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

function buildFindQuery(qString) {
  const q = (qString || '').trim();
  if (!q) return {};
  // quick text search fallback
  return {
    $or: [
      { name:        { $regex: q, $options: 'i' } },
      { address:     { $regex: q, $options: 'i' } },
      { contactName: { $regex: q, $options: 'i' } },
      { phone:       { $regex: q, $options: 'i' } },
    ]
  };
}

// ----------------------------- List / Create -------------------------------
router.get('/', authRequired,resolveTenant, withTenant( async (req, res, next) => {
  try {
    const query = buildFindQuery(req.query.q);
    const list = await Supplier.find(query)
      .sort({ updatedAt: -1 })
      .select('name address location phone contactName hours createdAt updatedAt')
      .lean();
    res.json(list);
  } catch (e) { next(e); }
}));

router.post('/',authRequired,resolveTenant, withTenant( async (req, res, next) => {
  try {
    const { name, address, phone, contactName, hours, location } = req.body || {};

    if (!name || !address) {
      return res.status(400).json({ error: 'name and address are required' });
    }

    const doc = await Supplier.create({
      name: name.trim(),
      address: address.trim(),
      phone: phone?.trim(),
      contactName: contactName?.trim(),
      hours: hours?.trim(),
      location: {
        lat: toNumber(location?.lat),
        lng: toNumber(location?.lng),
      },
      createdBy: req.user._id,
    });

    res.status(201).json(await Supplier.findById(doc._id).lean());
  } catch (e) { next(e); }
}));

// ----------------------------- Read / Update / Delete ----------------------
router.get('/:id',authRequired,resolveTenant, withTenant( async (req, res, next) => {
  try {
    const s = await Supplier.findById(req.params.id).lean();
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (e) { next(e); }
}));

router.patch('/:id',authRequired,resolveTenant, withTenant( async (req, res, next) => {
  try {
    const { name, address, phone, contactName, hours, location } = req.body || {};
    const update = {};

    if (name !== undefined)        update.name = String(name).trim();
    if (address !== undefined)     update.address = String(address).trim();
    if (phone !== undefined)       update.phone = phone?.trim();
    if (contactName !== undefined) update.contactName = contactName?.trim();
    if (hours !== undefined)       update.hours = hours?.trim();

    if (location !== undefined) {
      update.location = {
        lat: toNumber(location?.lat),
        lng: toNumber(location?.lng),
      };
    }

    await Supplier.findByIdAndUpdate(req.params.id, { $set: update }, { new: false });
    res.json(await Supplier.findById(req.params.id).lean());
  } catch (e) { next(e); }
}));

router.delete('/:id', requireRole('admin'),authRequired,resolveTenant, withTenant( async (req, res, next) => {
  try {
    const s = await Supplier.findById(req.params.id);
    if (!s) return res.status(404).json({ error: 'Not found' });

    await Supplier.deleteOne({ _id: s._id });
    res.json({ ok: true });
  } catch (e) { next(e); }
}));

export default router;