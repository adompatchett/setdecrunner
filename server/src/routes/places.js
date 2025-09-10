import { Router } from 'express';
import Place from '../models/Place.js';
import { authRequired, requireSiteAuthorized } from '../middleware/auth.js';
import { upload } from '../utils/uploader.js';

const router = Router();
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Helpers
const toNumberOrNull = (v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
};

function sanitizeCreatePayload(body) {
    const payload = { ...body };
  
    // If googlePlaceId is missing, null, or empty string → remove it
    if (!payload.googlePlaceId || typeof payload.googlePlaceId !== 'string' || !payload.googlePlaceId.trim()) {
      delete payload.googlePlaceId;
    }
  
    return payload;
  }
function sanitizePatchPayload(body = {}) {
  // Copy; we'll construct an update object safely
  const b = { ...body };
  const update = { $set: {}, $unset: {} };

  // Basic fields (only set defined values)
  const setIfDefined = (k, v) => {
    if (typeof v !== 'undefined') update.$set[k] = v;
  };

  setIfDefined('name', b.name);
  setIfDefined('address', b.address);
  setIfDefined('phone', b.phone);
  setIfDefined('website', b.website);
  setIfDefined('notes', b.notes);

  if ('lat' in b) update.$set.lat = toNumberOrNull(b.lat);
  if ('lng' in b) update.$set.lng = toNumberOrNull(b.lng);

  // googlePlaceId: if provided but falsy => unset; if string => set
  if ('googlePlaceId' in b) {
    if (b.googlePlaceId) {
      update.$set.googlePlaceId = String(b.googlePlaceId);
    } else {
      update.$unset.googlePlaceId = '';
    }
  }

  // photos: if explicitly provided as array, set; otherwise ignore
  if ('photos' in b) {
    update.$set.photos = Array.isArray(b.photos) ? b.photos : [];
  }

  // Clean empty ops
  if (!Object.keys(update.$set).length) delete update.$set;
  if (!Object.keys(update.$unset).length) delete update.$unset;

  return update;
}

  
  router.post('/', authRequired, requireSiteAuthorized, async (req, res) => {
    try {
      const payload = sanitizeCreatePayload(req.body);
      const p = await Place.create({ ...payload, createdBy: req.user._id });
      res.status(201).json(p);
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({ error: 'Place already exists with this googlePlaceId' });
      }
      res.status(500).json({ error: 'Failed to create place', detail: err.message });
    }
  });

/** IMPORT via Google Place ID (idempotent) */
router.post('/import', authRequired, requireSiteAuthorized, async (req, res) => {
  try {
    const { googlePlaceId } = req.body;
    if (!googlePlaceId) return res.status(400).json({ error: 'googlePlaceId required' });
    if (!MAPS_KEY) return res.status(500).json({ error: 'Server missing GOOGLE_MAPS_API_KEY' });

    const detailsUrl =
      'https://maps.googleapis.com/maps/api/place/details/json' +
      `?place_id=${encodeURIComponent(googlePlaceId)}` +
      '&fields=name,formatted_address,geometry,website,formatted_phone_number,place_id' +
      `&key=${encodeURIComponent(MAPS_KEY)}`;

    const r = await fetch(detailsUrl);
    if (!r.ok) {
      return res.status(502).json({ error: 'Failed to query Google Places Details API' });
    }
    const data = await r.json();

    // Handle Google API response statuses
    const result = data?.result;
    const status = data?.status;
    if (!result || (status && status !== 'OK')) {
      return res.status(404).json({ error: 'Place not found from Google', status });
    }

    // Build upsert document
    const doc = {
      name: result.name,
      googlePlaceId: result.place_id || googlePlaceId,
      address: result.formatted_address || '',
      lat: toNumberOrNull(result.geometry?.location?.lat),
      lng: toNumberOrNull(result.geometry?.location?.lng),
      phone: result.formatted_phone_number || '',
      website: result.website || '',
      createdBy: req.user._id,
    };

    // Upsert by googlePlaceId (idempotent import)
    const p = await Place.findOneAndUpdate(
      { googlePlaceId: doc.googlePlaceId },
      { $setOnInsert: doc, $set: {
        // if Google details change over time, you may choose to refresh some fields:
        address: doc.address,
        phone: doc.phone,
        website: doc.website,
        lat: doc.lat,
        lng: doc.lng
      }},
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(p);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Place already exists with this googlePlaceId' });
    }
    res.status(500).json({ error: 'Failed to import place', detail: err.message });
  }
});

/** LIST */
router.get('/', authRequired, requireSiteAuthorized, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { address: { $regex: q, $options: 'i' } },
          ],
        }
      : {};
    const places = await Place.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json(places);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list places', detail: err.message });
  }
});

/** READ */
router.get('/:id', authRequired, requireSiteAuthorized, async (req, res) => {
  try {
    const p = await Place.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch place', detail: err.message });
  }
});

/** UPDATE */
router.patch('/:id', authRequired, requireSiteAuthorized, async (req, res) => {
  try {
    const update = sanitizePatchPayload(req.body);
    const options = { new: true, runValidators: true };
    const p = await Place.findByIdAndUpdate(req.params.id, update, options);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Duplicate googlePlaceId' });
    }
    res.status(500).json({ error: 'Failed to update place', detail: err.message });
  }
});

/** DELETE */
router.delete('/:id', authRequired, requireSiteAuthorized, async (req, res) => {
  try {
    await Place.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete place', detail: err.message });
  }
});

/** ADD PHOTOS */
router.post('/:id/photos', authRequired, requireSiteAuthorized, upload.array('photos', 6), async (req, res) => {
  try {
    const p = await Place.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });

    const urls = (req.files || []).map(f => `/uploads/${f.filename}`);
    if (!urls.length) return res.json(p); // nothing to add

    if (!Array.isArray(p.photos)) p.photos = [];
    p.photos.push(...urls);
    await p.save();

    res.json(p);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add photos', detail: err.message });
  }
});

/** REMOVE PHOTO */
router.delete('/:id/photos', authRequired, requireSiteAuthorized, async (req, res) => {
  try {
    const { url } = req.body;
    const p = await Place.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });

    p.photos = (p.photos || []).filter(ph => ph !== url);
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove photo', detail: err.message });
  }
});

export default router;
