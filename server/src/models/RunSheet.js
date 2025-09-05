import mongoose from 'mongoose';

const { Schema } = mongoose;

const RunItemSchema = new Schema({
  item:     { type: Schema.Types.ObjectId, ref: 'Item' },
  name:     { type: String, trim: true },
  quantity: { type: Number, default: 1 },
  notes:    { type: String, trim: true, default: '' },
  photos:   { type: [String], default: [] },
}, { _id: false });

const StopSchema = new Schema({
  place:        { type: Schema.Types.ObjectId, ref: 'Place' },
  title:        { type: String, trim: true, default: 'Stop' },
  instructions: { type: String, trim: true, default: '' },
  items:        { type: [RunItemSchema], default: [] },
}, { _id: true });

const POST_LOCATION_OPTS = ['hold_on_truck', 'office', 'setdec_storage', 'address_below'];
const PURCHASE_TYPES     = ['purchase', 'rental'];
const PD_TYPES           = ['pickup', 'delivering']; // Pickup/Delivering section
const PAY_METHODS        = ['cheque', 'cash'];
const RD_TYPES           = ['pu', 'take'];           // Return/Drop Off section

const RunsheetSchema = new Schema({
  title:  { type: String, trim: true, default: 'Untitled' },
  status: {
    type: String,
    enum: ['draft','open','assigned','claimed','in_progress','completed','cancelled'],
    default: 'draft'
  },

  date:        { type: Date, default: null },
  createdBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo:  { type: Schema.Types.ObjectId, ref: 'User' },

  photos:   { type: [String], default: [] },
  receipts: { type: [String], default: [] },

  // Run
  stops: { type: [StopSchema], default: [] },

  // Type
  purchaseType: { type: String, enum: PURCHASE_TYPES, default: 'purchase' },
  pickupDate:   { type: Date, default: null },
  returnDate:   { type: Date, default: null },

  // Destination (Take To)
  takeTo: { type: Schema.Types.ObjectId, ref: 'Place', default: null },

  // Link to Set
  set: { type: Schema.Types.ObjectId, ref: 'Set', default: null },

  // Primary Contact (Person)
  contact: { type: Schema.Types.ObjectId, ref: 'Person', default: null },

  // Post-Run Destination (one-of)
  postLocation: { type: String, enum: POST_LOCATION_OPTS, default: null },
  postAddress:  { type: String, trim: true, default: '' }, // used when address_below
  postPlace:    { type: Schema.Types.ObjectId, ref: 'Place', default: null }, // optional helper

  // Purchase Info
  getInvoice:    { type: Boolean, default: false },
  getDeposit:    { type: Boolean, default: false },
  chequeNumber:  { type: String, trim: true, default: '' }, // Cheque #
  poNumber:      { type: String, trim: true, default: '' }, // PO #
  paid:          { type: Boolean, default: false },         // PAID yes/no
  amount:        { type: Number, default: 0 },              // currency amount
  receivedBy:    { type: String, trim: true, default: '' }, // Cheque/Cash received by (name)

  // Pickup / Delivering section
  pdType:           { type: String, enum: PD_TYPES, default: null },      // 'pickup' | 'delivering'
  pdPaymentMethod:  { type: String, enum: PAY_METHODS, default: null },   // 'cheque' | 'cash'
  pdDate:           { type: Date, default: null },
  pdTime:           { type: String, trim: true, default: '' },            // HH:mm (UI string)
  pdInstructions:   { type: String, trim: true, default: '' },
  pdCompletedBy:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
  pdCompletedOn:    { type: Date, default: null },                         // date finished

  // Return / Drop Off section
  rdType:           { type: String, enum: RD_TYPES, default: null },      // 'pu' | 'take'
  rdCheque:         { type: Boolean, default: false },                    // on/off
  rdDate:           { type: Date, default: null },
  rdTime:           { type: String, trim: true, default: '' },            // HH:mm (UI string)
  rdInstructions:   { type: String, trim: true, default: '' },
  rdCompletedBy:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
  rdCompletedOn:    { type: Date, default: null },

  // QC on return
  qcItemsGood:     { type: Boolean, default: null }, // null until set; true/false afterwards
  qcSignatureData: { type: String, default: '' },    // data URL (PNG) or empty
}, { timestamps: true });

RunsheetSchema.index({ title: 'text', status: 'text' });

export default mongoose.model('Runsheet', RunsheetSchema);

