import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
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

function setUploadDest(fn) {
  return async (req, res, next) => {
    try {
      req.uploadDest = await fn(req);
      await fs.mkdir(req.uploadDest, { recursive: true });
      next();
    } catch (e) { next(e); }
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

const unlinkIfExists = async (abs) => { try { await fs.unlink(abs); } catch {} };

const objectId = (id) =>
  (id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null);

// ---------------------------- Helpers --------------------------------------
const PURCHASE_TYPES     = ['purchase', 'rental'];
const POST_LOCATION_OPTS = ['hold_on_truck','office','setdec_storage','address_below'];
const PD_TYPES           = ['pickup', 'delivering'];
const PAY_METHODS        = ['cheque', 'cash'];
const RD_TYPES           = ['pu', 'take'];

const populateLite = (q) =>
  q.populate('assignedTo', 'name role')
   .populate('createdBy', 'name')
   .populate({ path: 'stops.place', select: 'name address lat lng' })
   .populate({ path: 'takeTo', select: 'name address lat lng' })
   .populate({ path: 'set', select: 'number name' })
   .populate({ path: 'contact', select: 'name email phone' })
   .populate({ path: 'postPlace', select: 'name address lat lng' })
   .populate({ path: 'pdCompletedBy', select: 'name email' })
   .populate({ path: 'rdCompletedBy', select: 'name email' });

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

/** Dates: undefined → not provided; null/'' → clear; Date → parsed */
function parseDateInputStrict(v, fieldName = 'date') {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`Invalid ${fieldName}`); err.status = 400; throw err;
  }
  return d;
}

/** Times are stored as HH:mm strings (or empty) */
function parseTimeInputStrict(v, fieldName = 'time') {
  if (v === undefined) return undefined;
  if (v === null || v === '') return '';
  const s = String(v).trim();
  if (!/^\d{1,2}:\d{2}$/.test(s)) {
    const err = new Error(`Invalid ${fieldName} (expected HH:mm)`); err.status = 400; throw err;
  }
  return s;
}

function validateRunsheetFields({ purchaseType, pickupDate, returnDate }) {
  if (purchaseType !== undefined) {
    if (!PURCHASE_TYPES.includes(purchaseType)) {
      const err = new Error('Invalid purchaseType (expected "purchase" or "rental")');
      err.status = 400; throw err;
    }
  }
  if (purchaseType === 'rental') {
    if (!pickupDate || !returnDate) {
      const err = new Error('Rental runsheets require both pickupDate and returnDate');
      err.status = 400; throw err;
    }
    if (returnDate < pickupDate) {
      const err = new Error('returnDate cannot be before pickupDate');
      err.status = 400; throw err;
    }
  }
}

function validatePostChoice({ postLocation, postAddress, postPlace }) {
  if (postLocation !== undefined && postLocation !== null && !POST_LOCATION_OPTS.includes(postLocation)) {
    const err = new Error('Invalid postLocation'); err.status = 400; throw err;
  }
  if (postLocation === 'address_below') {
    const hasAddr  = !!(postAddress && String(postAddress).trim());
    const hasPlace = !!postPlace;
    if (!hasAddr && !hasPlace) {
      const err = new Error('postAddress or postPlace is required when postLocation is "address_below"');
      err.status = 400; throw err;
    }
  }
}

/** ObjectId coercion (string/object/null/undefined) */
function coerceObjectId(val) {
  if (val === undefined || val === '') return undefined;
  if (val === null) return null;
  if (typeof val === 'string') return objectId(val);
  if (typeof val === 'object') {
    const id = val._id || val.id;
    return id ? objectId(String(id)) : null;
  }
  return null;
}

function boolish(v) {
  if (v === undefined) return undefined;
  if (typeof v === 'boolean') return v;
  if (v === null || v === '') return undefined;
  const s = String(v).toLowerCase();
  if (['true','1','yes','y','on'].includes(s)) return true;
  if (['false','0','no','n','off'].includes(s)) return false;
  return undefined;
}

// All routes below require auth + site authorization
router.use(authRequired, requireSiteAuthorized);

// ----------------------------- List / Create -------------------------------
router.get('/', async (req, res, next) => {
  try {
    const q = buildListQuery(req);
    const list = await Runsheet.find(q)
      .sort({ createdAt: -1 })
      .select('title status date purchaseType pickupDate returnDate takeTo set createdAt createdBy assignedTo photos receipts postLocation postAddress contact')
      .populate('assignedTo', 'name role')
      .populate('createdBy', 'name')
      .populate('takeTo', 'name address')
      .populate('set', 'number name')
      .populate('contact', 'name email phone')
      .lean();

    res.json(list);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};

    const dateVal       = parseDateInputStrict(b.date, 'date') ?? null;
    const pickupDateVal = parseDateInputStrict(b.pickupDate, 'pickupDate') ?? null;
    const returnDateVal = parseDateInputStrict(b.returnDate, 'returnDate') ?? null;

    const takeToId = b.takeTo === undefined ? undefined : coerceObjectId(b.takeTo);
    const setId    = b.set    === undefined ? undefined : coerceObjectId(b.set);
    const contact  = b.contact === undefined ? undefined : coerceObjectId(b.contact);

    // Post choice
    const postPlace = b.postPlace === undefined ? undefined : coerceObjectId(b.postPlace);
    validatePostChoice({
      postLocation: b.postLocation ?? null,
      postAddress:  b.postAddress ?? '',
      postPlace
    });

    validateRunsheetFields({
      purchaseType: b.purchaseType,
      pickupDate:   pickupDateVal,
      returnDate:   returnDateVal
    });

    // Purchase Info (coerce)
    const getInvoice   = boolish(b.getInvoice) ?? false;
    const getDeposit   = boolish(b.getDeposit) ?? false;
    const paid         = boolish(b.paid) ?? false;
    const rdCheque     = boolish(b.rdCheque) ?? false;

    // Pickup/Delivering
    const pdDate = parseDateInputStrict(b.pdDate, 'pdDate') ?? null;
    const pdTime = parseTimeInputStrict(b.pdTime, 'pdTime') ?? '';

    // Return/Drop Off
    const rdDate = parseDateInputStrict(b.rdDate, 'rdDate') ?? null;
    const rdTime = parseTimeInputStrict(b.rdTime, 'rdTime') ?? '';

    // QC
    const qcItemsGood = boolish(b.qcItemsGood) ?? null;

    const rs = await Runsheet.create({
      title: b.title || 'Untitled',
      status: b.status || 'draft',
      date: dateVal,
      createdBy: req.user._id,
      assignedTo: undefined,

      photos: [],
      receipts: [],
      stops: [],

      purchaseType: b.purchaseType || 'purchase',
      pickupDate: pickupDateVal,
      returnDate: returnDateVal,

      takeTo: takeToId ?? null,
      set: setId ?? null,

      contact: contact ?? null,

      postLocation: b.postLocation ?? null,
      postAddress: b.postLocation === 'address_below' ? (b.postAddress || '') : '',
      postPlace: b.postLocation === 'address_below' ? (postPlace ?? null) : null,

      getInvoice,
      getDeposit,
      chequeNumber: b.chequeNumber || '',
      poNumber: b.poNumber || '',
      paid,
      amount: typeof b.amount === 'number' ? b.amount : Number(b.amount || 0),
      receivedBy: b.receivedBy || '',

      pdType: b.pdType && PD_TYPES.includes(b.pdType) ? b.pdType : null,
      pdPaymentMethod: b.pdPaymentMethod && PAY_METHODS.includes(b.pdPaymentMethod) ? b.pdPaymentMethod : null,
      pdDate,
      pdTime,
      pdInstructions: b.pdInstructions || '',
      pdCompletedBy: coerceObjectId(b.pdCompletedBy) ?? null,
      pdCompletedOn: parseDateInputStrict(b.pdCompletedOn, 'pdCompletedOn') ?? null,

      rdType: b.rdType && RD_TYPES.includes(b.rdType) ? b.rdType : null,
      rdCheque,
      rdDate,
      rdTime,
      rdInstructions: b.rdInstructions || '',
      rdCompletedBy: coerceObjectId(b.rdCompletedBy) ?? null,
      rdCompletedOn: parseDateInputStrict(b.rdCompletedOn, 'rdCompletedOn') ?? null,

      qcItemsGood,
      qcSignatureData: b.qcSignatureData || '',
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
    const b = req.body || {};
    const update = {};
    const unset  = {};

    // Simple strings/enums
    if (b.title !== undefined)  update.title = String(b.title || 'Untitled');
    if (b.status !== undefined) update.status = String(b.status);

    // Dates
    if (b.date !== undefined)        update.date        = parseDateInputStrict(b.date, 'date');
    if (b.pickupDate !== undefined)  update.pickupDate  = parseDateInputStrict(b.pickupDate, 'pickupDate');
    if (b.returnDate !== undefined)  update.returnDate  = parseDateInputStrict(b.returnDate, 'returnDate');

    // Purchase type rules
    if (b.purchaseType !== undefined) update.purchaseType = String(b.purchaseType);

    // Relations
    if (b.takeTo !== undefined) {
      const id = coerceObjectId(b.takeTo);
      if (id === null) unset.takeTo = ''; else update.takeTo = id;
    }
    if (b.set !== undefined) {
      const id = coerceObjectId(b.set);
      if (id === null) unset.set = ''; else update.set = id;
    }
    if (b.contact !== undefined) {
      const id = coerceObjectId(b.contact);
      if (id === null) unset.contact = ''; else update.contact = id;
    }

    // Post destination
    if (b.postLocation !== undefined) update.postLocation = b.postLocation === null ? null : String(b.postLocation);
    if (b.postAddress !== undefined)  update.postAddress  = String(b.postAddress || '');
    if (b.postPlace !== undefined) {
      const id = coerceObjectId(b.postPlace);
      if (id === null) unset.postPlace = ''; else update.postPlace = id;
    }

    // Purchase Info
    if (b.getInvoice !== undefined)  update.getInvoice   = !!boolish(b.getInvoice);
    if (b.getDeposit !== undefined)  update.getDeposit   = !!boolish(b.getDeposit);
    if (b.chequeNumber !== undefined) update.chequeNumber = String(b.chequeNumber || '');
    if (b.poNumber !== undefined)     update.poNumber     = String(b.poNumber || '');
    if (b.paid !== undefined)         update.paid         = !!boolish(b.paid);
    if (b.amount !== undefined)       update.amount       = typeof b.amount === 'number' ? b.amount : Number(b.amount || 0);
    if (b.receivedBy !== undefined)   update.receivedBy   = String(b.receivedBy || '');

    // Pickup/Delivering
    if (b.pdType !== undefined)            update.pdType          = b.pdType === null ? null : String(b.pdType);
    if (b.pdPaymentMethod !== undefined)   update.pdPaymentMethod = b.pdPaymentMethod === null ? null : String(b.pdPaymentMethod);
    if (b.pdDate !== undefined)            update.pdDate          = parseDateInputStrict(b.pdDate, 'pdDate');
    if (b.pdTime !== undefined)            update.pdTime          = parseTimeInputStrict(b.pdTime, 'pdTime');
    if (b.pdInstructions !== undefined)    update.pdInstructions  = String(b.pdInstructions || '');
    if (b.pdCompletedBy !== undefined) {
      const id = coerceObjectId(b.pdCompletedBy);
      if (id === null) unset.pdCompletedBy = ''; else update.pdCompletedBy = id;
    }
    if (b.pdCompletedOn !== undefined)     update.pdCompletedOn   = parseDateInputStrict(b.pdCompletedOn, 'pdCompletedOn');

    // Return/Drop Off
    if (b.rdType !== undefined)            update.rdType          = b.rdType === null ? null : String(b.rdType);
    if (b.rdCheque !== undefined)          update.rdCheque        = !!boolish(b.rdCheque);
    if (b.rdDate !== undefined)            update.rdDate          = parseDateInputStrict(b.rdDate, 'rdDate');
    if (b.rdTime !== undefined)            update.rdTime          = parseTimeInputStrict(b.rdTime, 'rdTime');
    if (b.rdInstructions !== undefined)    update.rdInstructions  = String(b.rdInstructions || '');
    if (b.rdCompletedBy !== undefined) {
      const id = coerceObjectId(b.rdCompletedBy);
      if (id === null) unset.rdCompletedBy = ''; else update.rdCompletedBy = id;
    }
    if (b.rdCompletedOn !== undefined)     update.rdCompletedOn   = parseDateInputStrict(b.rdCompletedOn, 'rdCompletedOn');

    // QC
    if (b.qcItemsGood !== undefined)       update.qcItemsGood     = boolish(b.qcItemsGood) ?? null;
    if (b.qcSignatureData !== undefined)   update.qcSignatureData = String(b.qcSignatureData || '');

    // Fetch current to validate merged state
    const current = await Runsheet.findById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });

    // Purchase type validations
    validateRunsheetFields({
      purchaseType: update.purchaseType ?? current.purchaseType ?? 'purchase',
      pickupDate:   update.pickupDate   !== undefined ? update.pickupDate   : current.pickupDate,
      returnDate:   update.returnDate   !== undefined ? update.returnDate   : current.returnDate
    });

    // Validate post choice
    validatePostChoice({
      postLocation: update.postLocation !== undefined ? update.postLocation : current.postLocation,
      postAddress:  update.postAddress  !== undefined ? update.postAddress  : current.postAddress,
      postPlace:    (update.postPlace !== undefined ? update.postPlace
                    : (unset.postPlace !== undefined ? null : current.postPlace))
    });

    // Validate enums (pd/rd)
    const nextPdType = update.pdType !== undefined ? update.pdType : current.pdType;
    if (nextPdType != null && !PD_TYPES.includes(nextPdType)) {
      const err = new Error('Invalid pdType'); err.status = 400; throw err;
    }
    const nextPdPay = update.pdPaymentMethod !== undefined ? update.pdPaymentMethod : current.pdPaymentMethod;
    if (nextPdPay != null && !PAY_METHODS.includes(nextPdPay)) {
      const err = new Error('Invalid pdPaymentMethod'); err.status = 400; throw err;
    }
    const nextRdType = update.rdType !== undefined ? update.rdType : current.rdType;
    if (nextRdType != null && !RD_TYPES.includes(nextRdType)) {
      const err = new Error('Invalid rdType'); err.status = 400; throw err;
    }

    const ops = {};
    if (Object.keys(update).length) ops.$set = update;
    if (Object.keys(unset).length)  ops.$unset = unset;

    await Runsheet.findByIdAndUpdate(req.params.id, ops, { new: false });
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

    if (url?.startsWith('/uploads/')) {
      const abs = path.join(process.cwd(), url.replace('/uploads/', 'uploads/'));
      await unlinkIfExists(abs);
    }

    res.json(await loadFull(rs._id));
  } catch (e) { next(e); }
});

// ----------------------------- Receipts (runsheet) -------------------------
router.post(
  '/:id/receipts',
  setUploadDest(async (req) => path.join(UPLOAD_ROOT, 'runsheets', req.params.id, 'receipts')),
  upload.array('receipts', 20),
  async (req, res, next) => {
    try {
      const rs = await Runsheet.findById(req.params.id);
      if (!rs) return res.status(404).json({ error: 'Not found' });

      const added = req.files.map(f => toPublicPath(path.join(req.uploadDest, f.filename)));
      rs.receipts = [...(rs.receipts || []), ...added];
      await rs.save();

      res.json(await loadFull(rs._id));
    } catch (e) { next(e); }
  }
);

router.delete('/:id/receipts', async (req, res, next) => {
  try {
    const { url } = req.body || {};
    const rs = await Runsheet.findById(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });

    rs.receipts = (rs.receipts || []).filter(p => p !== url);
    await rs.save();

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

    const placeId = coerceObjectId(place);
    let stopTitle = title;

    if (!stopTitle && (placeId || placeId === null)) {
      const pl = placeId ? await Place.findById(placeId).lean() : null;
      stopTitle = pl?.name || 'Stop';
    }

    rs.stops.push({
      place: placeId ?? undefined,
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

    const $set = {};
    const $unset = {};

    if (title !== undefined)        $set['stops.$.title'] = title;
    if (instructions !== undefined) $set['stops.$.instructions'] = instructions;
    if (items !== undefined)        $set['stops.$.items'] = items;

    if (place !== undefined) {
      const coerced = coerceObjectId(place);
      if (coerced === null) $unset['stops.$.place'] = '';
      else $set['stops.$.place'] = coerced;
    }

    const ops = {};
    if (Object.keys($set).length)   ops.$set = $set;
    if (Object.keys($unset).length) ops.$unset = $unset;

    const updated = await Runsheet.findOneAndUpdate(
      { _id: id, 'stops._id': stopId },
      ops,
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

    const runItem = {
      item: it._id,
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
  setUploadDest(async (req) => path.join(
    UPLOAD_ROOT,
    'runsheets',
    req.params.id,
    `stop-${req.params.stopId}-item-${req.params.idx}`
  )),
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

// ----------------------------- Claim / Assign ------------------------------
router.post('/:id/claim', async (req, res, next) => {
  try {
    const rs = await Runsheet.findById(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Not found' });

    if (rs.status !== 'open' || rs.assignedTo) {
      return res.status(400).json({ error: 'Not claimable' });
    }

    rs.assignedTo = req.user._id;
    rs.status = 'claimed';
    await rs.save();

    res.json(await loadFull(rs._id));
  } catch (e) { next(e); }
});

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

    res.json(await loadFull(rs._id));
  } catch (e) { next(e); }
});

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

    res.json(await loadFull(rs._id));
  } catch (e) { next(e); }
});

// Utility: search users (kept for Runsheet editor helpers)
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

export default router;






