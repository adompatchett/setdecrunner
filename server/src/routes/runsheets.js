// src/routes/runsheets.js
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import Runsheet from '../models/Runsheet.js';
import Item from '../models/Item.js';
import User from '../models/User.js';
import Place from '../models/Place.js';
import { authRequired, requireSiteAuthorized, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ---------------------------- Upload utils ---------------------------------
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
await fs.mkdir(UPLOAD_ROOT, { recursive: true });

/** attach req.uploadDest before calling `upload.array()` */
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
  // map absolute upload path → public URL path (served elsewhere in app)
  const rel = path.relative(path.resolve(process.cwd(), 'uploads'), absPath);
  return '/uploads/' + rel.replace(/\\/g, '/');
};

const unlinkIfExists = async (abs) => {
  try { await fs.unlink(abs); } catch { /* ignore */ }
};

const objectId = (id) => (id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null);

// ---------------------------- Helpers --------------------------------------
const populateLite = (q) =>
  q.populate('assignedTo', 'name role')
   .populate({
     path: 'stops.place',
     select: 'name address lat lng'
   });

async function loadFull(id) {
  return populateLite(Runsheet.findById(id)).lean();
}

function allowDelete(runsheet, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return String(runsheet.createdBy) === String(user._id);
}

function buildListQuery(req) {
  const q = {};
  if (req.query.mine) q.createdBy = req.user._id;
  if (req.query.assignedToMe) q.assignedTo = req.user._id;
  if (req.query.open) {
    q.status = 'open';
    q.assignedTo = { $in: [null, undefined] };
  }
  if (req.query.status) q.status = req.query.status;
  return q;
}

// All routes below require auth + site authorization
router.use(authRequired, requireSiteAuthorized);

// ----------------------------- List / Create -------------------------------
router.get('/', async (req, res, next) => {
  try {
    const q = buildListQuery(req);
    const list = await Runsheet.find(q)
      .sort({ createdAt: -1 })
      .select('title status date createdAt createdBy assignedTo photos')
      .populate('assignedTo', 'name role')
      .populate('createdBy', 'name')
      .lean();

    res.json(list);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title = 'Untitled', status = 'draft', date = null } = req.body || {};
    const rs = await Runsheet.create({
      title,
      status,
      date: date ? new Date(date) : null,
      photos: [],
      stops: [],
      createdBy: req.user._id
    });
    res.status(201).json(await loadFull(rs._id));
  } catch (e) { next(e); }
});

// ----------------------------- Read / Update / Delete ----------------------
router.get('/:id', async (req, res, next) => {
  try {
    const rs = await loadFull(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });
    res.json(rs);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { title, status, date, assignedTo } = req.body || {};
    const update = {};
    if (typeof title === 'string') update.title = title;
    if (typeof status === 'string') update.status = status;
    if (date !== undefined) update.date = date ? new Date(date) : null;
    if (assignedTo !== undefined) update.assignedTo = assignedTo ? objectId(assignedTo) : null;

    await Runsheet.findByIdAndUpdate(req.params.id, { $set: update }, { new: false });
    res.json(await loadFull(req.params.id));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const rs = await Runsheet.findById(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });
    if (!allowDelete(rs, req.user)) return res.status(403).json({ error: 'Forbidden' });

    await Runsheet.deleteOne({ _id: rs._id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ----------------------------- Claim / Assign ------------------------------



// ----------------------------- Photos (runsheet) ---------------------------
router.post(
  '/:id/photos',
  setUploadDest(async (req) => path.join(UPLOAD_ROOT, 'runsheets', req.params.id)),
  upload.array('photos', 12),
  async (req, res, next) => {
    try {
      const rs = await Runsheet.findById(req.params.id);
      if (!rs) return res.status(404).json({ error: 'Not found' });

      const added = req.files.map(f => toPublicPath(path.join(req.uploadDest, f.filename)));
      rs.photos = [...(rs.photos || []), ...added];
      await rs.save();

      res.json(await loadFull(rs._id));
    } catch (e) { next(e); }
  }
);

router.delete('/:id/photos', async (req, res, next) => {
  try {
    const { url } = req.body || {};
    const rs = await Runsheet.findById(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });

    rs.photos = (rs.photos || []).filter(p => p !== url);
    await rs.save();

    // try to remove file on disk if under uploads
    if (url?.startsWith('/uploads/')) {
      const abs = path.join(process.cwd(), url.replace('/uploads/', 'uploads/'));
      await unlinkIfExists(abs);
    }

    res.json(await loadFull(rs._id));
  } catch (e) { next(e); }
});

// ----------------------------- Stops ---------------------------------------
router.post('/:id/stops', async (req, res, next) => {
  try {
    const { place, title, instructions = '' } = req.body || {};
    const rs = await Runsheet.findById(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });

    let stopTitle = title;
    if (!stopTitle && place) {
      const pl = await Place.findById(place).lean();
      stopTitle = pl?.name || 'Stop';
    }

    rs.stops.push({
      place: place ? objectId(place) : undefined,
      title: stopTitle || 'Stop',
      instructions,
      items: []
    });
    await rs.save();

    res.json(await loadFull(rs._id));
  } catch (e) { next(e); }
});

router.patch('/:id/stops/:stopId', async (req, res, next) => {
  try {
    const { title, instructions, items, place } = req.body || {};
    const id = req.params.id;
    const stopId = req.params.stopId;

    const set = {};
    if (title !== undefined) set['stops.$.title'] = title;
    if (instructions !== undefined) set['stops.$.instructions'] = instructions;
    if (items !== undefined) set['stops.$.items'] = items; // array replace
    if (place !== undefined) set['stops.$.place'] = place ? objectId(place) : undefined;

    const updated = await Runsheet.findOneAndUpdate(
      { _id: id, 'stops._id': stopId },
      { $set: set },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Stop not found' });

    res.json(await loadFull(updated._id));
  } catch (e) { next(e); }
});

router.delete('/:id/stops/:stopId', async (req, res, next) => {
  try {
    const id = req.params.id;
    const stopId = req.params.stopId;

    const updated = await Runsheet.findByIdAndUpdate(
      id,
      { $pull: { stops: { _id: stopId } } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Stop not found' });

    res.json(await loadFull(updated._id));
  } catch (e) { next(e); }
});

// ----------------------------- Stop Items ----------------------------------
router.post('/:id/stops/:stopId/items', async (req, res, next) => {
  try {
    const { itemId, quantity = 1 } = req.body || {};
    const it = await Item.findById(itemId).lean();
    if (!it) return res.status(400).json({ error: 'Item not found' });

    const id = req.params.id;
    const stopId = req.params.stopId;

    // Push a snapshot of item info so runsheet stays stable if item changes later
    const runItem = {
      itemId: it._id,
      name: it.name,
      quantity: Number(quantity) || 1,
      notes: '',
      photos: []
    };

    const updated = await Runsheet.findOneAndUpdate(
      { _id: id, 'stops._id': stopId },
      { $push: { 'stops.$.items': runItem } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Stop not found' });

    res.json(await loadFull(updated._id));
  } catch (e) { next(e); }
});

router.post(
  '/:id/stops/:stopId/items/:idx/photos',
  setUploadDest(async (req) => path.join(UPLOAD_ROOT, 'runsheets', req.params.id, `stop-${req.params.stopId}-item-${req.params.idx}`)),
  upload.array('photos', 12),
  async (req, res, next) => {
    try {
      const { id, stopId, idx } = req.params;
      const runsheet = await Runsheet.findById(id);
      if (!runsheet) return res.status(404).json({ error: 'Not found' });

      const stop = runsheet.stops.id(stopId);
      if (!stop) return res.status(404).json({ error: 'Stop not found' });

      const index = Number(idx);
      if (!Number.isInteger(index) || index < 0 || index >= stop.items.length) {
        return res.status(400).json({ error: 'Invalid item index' });
      }

      const added = req.files.map(f => toPublicPath(path.join(req.uploadDest, f.filename)));
      stop.items[index].photos = [...(stop.items[index].photos || []), ...added];

      await runsheet.save();
      res.json(await loadFull(runsheet._id));
    } catch (e) { next(e); }
  }
);

const attachUser = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findById(req.userId).select('_id name email isAdmin');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user; // now available in route handlers
    next();
  } catch (err) {
    console.error('attachUser error', err);
    res.status(500).json({ error: 'Failed to attach user' });
  }
};

// POST /runsheets/:id/claim
router.post('/:id/claim', async (req, res, next) => {
  try {
    const rs = await Runsheet.findById(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });

    if (rs.status !== 'open' || rs.assignedTo) {
      return res.status(400).json({ error: 'Not claimable' });
    }

    rs.assignedTo = req.user._id;      // authRequired already set req.user
    rs.status = 'claimed';
    await rs.save();

    // return hydrated document for the client
    const full = await loadFull(rs._id);
    res.json(full);
  } catch (e) { next(e); }
});

// POST /runsheets/:id/assign  (ADMIN or anyone with permission)
router.post('/:id/assign', requireRole('admin'), async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const user = await User.findById(userId).select('_id');
    if (!user) return res.status(400).json({ error: 'User not found' });

    const rs = await Runsheet.findById(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });

    rs.assignedTo = user._id;
    if (['draft', 'open', 'claimed'].includes(rs.status)) {
      rs.status = 'assigned';
    }
    await rs.save();

    const full = await loadFull(rs._id);
    res.json(full);
  } catch (e) { next(e); }
});

// POST /runsheets/:id/release  (assigned user can release; admin can force)
router.post('/:id/release', async (req, res, next) => {
  try {
    const rs = await Runsheet.findById(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });

    const isOwner = rs.assignedTo?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin' || req.user.isAdmin === true;
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not allowed to release' });
    }

    rs.assignedTo = undefined;
    if (!['completed', 'cancelled'].includes(rs.status)) {
      rs.status = 'open';
    }
    await rs.save();

    const full = await loadFull(rs._id);
    res.json(full);
  } catch (e) { next(e); }
});
// GET /users?q=...&limit=...
router.get('/users', authRequired, requireRole('any'), async (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const query = q
    ? { $or: [
        { name:  { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ] }
    : {};
  const users = await User.find(query).select('_id name email').limit(limit).sort({ name: 1 });
  res.json(users);
});

// ---------------------------------------------------------------------------
export default router;
