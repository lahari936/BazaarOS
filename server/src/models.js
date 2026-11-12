import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const id = Schema.Types.ObjectId;
const money = { type: Number, default: 0, min: 0 };

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  phone: { type: String, trim: true },
}, { timestamps: true });

const businessSchema = new Schema({
  ownerId: { type: id, ref: 'User', required: true, unique: true }, // MVP: one shop per owner
  shopName: { type: String, required: true, trim: true },
  businessType: { type: String, default: 'vegetables', trim: true },
  preferredLanguage: { type: String, enum: ['te-IN', 'hi-IN', 'en-IN'], default: 'te-IN' },
  location: { type: String, trim: true },
  currency: { type: String, default: 'INR' },
}, { timestamps: true });

export const UNITS = ['kg', 'g', 'dozen', 'piece', 'litre', 'bunch', 'packet'];

const productSchema = new Schema({
  businessId: { type: id, ref: 'Business', required: true, index: true },
  name: { type: String, required: true, trim: true },
  nameLocal: { type: String, trim: true },
  aliases: [{ type: String, trim: true }], // extra spoken forms used by voice matching
  category: { type: String, default: 'Vegetables', trim: true },
  quantity: { ...money },
  unit: { type: String, enum: UNITS, default: 'kg' },
  averagePurchasePrice: { ...money }, // weighted average cost per unit
  sellingPrice: { ...money },
  lowStockThreshold: { type: Number, default: 5, min: 0 },
}, { timestamps: true });
productSchema.index({ businessId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const customerSchema = new Schema({
  businessId: { type: id, ref: 'Business', required: true, index: true },
  name: { type: String, required: true, trim: true },
  nameLocal: { type: String, trim: true },
  phone: { type: String, trim: true },
  totalCredit: { ...money },
  totalPaid: { ...money },
  outstandingBalance: { ...money },
}, { timestamps: true });
customerSchema.index({ businessId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const TXN_TYPES = ['PURCHASE', 'SALE', 'EXPENSE', 'CREDIT', 'PAYMENT_IN'];
export const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'CREDIT'];

const itemSchema = new Schema({
  productId: { type: id, ref: 'Product' },
  name: String,
  quantity: Number,
  unit: String,
  unitPrice: Number, // purchase cost or selling price per unit
  unitCost: Number, // weighted-average cost at time of sale (SALE only)
  cogs: Number, // quantity * unitCost (SALE only)
}, { _id: false });

const transactionSchema = new Schema({
  businessId: { type: id, ref: 'Business', required: true },
  customerId: { type: id, ref: 'Customer' },
  type: { type: String, enum: TXN_TYPES, required: true },
  items: [itemSchema],
  amount: { type: Number, required: true, min: 0 },
  cogs: { type: Number, default: 0 }, // total COGS for SALE
  category: String, // EXPENSE category
  note: String,
  paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'CASH' },
  paymentStatus: { type: String, enum: ['PAID', 'UNPAID'], default: 'PAID' },
  source: { type: String, enum: ['VOICE', 'MANUAL', 'SEED'], default: 'MANUAL' },
  transcript: String,
  voiceLogId: { type: id, ref: 'VoiceLog' },
  idempotencyKey: String,
}, { timestamps: true });
transactionSchema.index({ businessId: 1, createdAt: -1 });
transactionSchema.index({ businessId: 1, type: 1, createdAt: -1 });
transactionSchema.index({ businessId: 1, customerId: 1, createdAt: -1 });
// Same key can never create two transactions: blocks double-confirm and retried submits.
transactionSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

const voiceLogSchema = new Schema({
  userId: { type: id, ref: 'User', required: true },
  businessId: { type: id, ref: 'Business', required: true },
  transcript: String,
  transcriptLiteral: String,
  language: String,
  intent: String,
  parsedData: Schema.Types.Mixed,
  responseText: String,
  status: { type: String, enum: ['AWAITING_CONFIRMATION', 'CONFIRMING', 'COMPLETED', 'CANCELLED', 'ANSWERED', 'NEEDS_CLARIFICATION', 'FAILED'], required: true },
  error: String,
  transactionId: { type: id, ref: 'Transaction' },
  gnaniModels: [String],
  processingTime: Number, // ms, end to end on our server
  sttLatency: Number,
}, { timestamps: true });
voiceLogSchema.index({ businessId: 1, createdAt: -1 });

export const User = model('User', userSchema);
export const Business = model('Business', businessSchema);
export const Product = model('Product', productSchema);
export const Customer = model('Customer', customerSchema);
export const Transaction = model('Transaction', transactionSchema);
export const VoiceLog = model('VoiceLog', voiceLogSchema);
