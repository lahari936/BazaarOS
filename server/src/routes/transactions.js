import { Router } from 'express';
import { z } from 'zod';
import { Transaction, Product, Customer, TXN_TYPES, PAYMENT_METHODS } from '../models.js';
import { HttpError, requireAuth, requireBusiness, validate, objectId } from '../middleware.js';
import { validateCommand } from '../services/intent.service.js';
import { executeCommand } from '../services/ledger.service.js';

const r = Router();
r.use(requireAuth, requireBusiness);

export async function loadCtx(businessId, language = 'en-IN') {
  const [products, customers] = await Promise.all([Product.find({ businessId }).lean(), Customer.find({ businessId }).lean()]);
  return { products, customers, language };
}

/** Validate + execute, shared by manual transactions and Khata routes. Throws 400 with the reason. */
export async function runManual(req, intent, data) {
  const cmd = validateCommand(intent, data, await loadCtx(req.business._id));
  if (cmd.errors.length || cmd.missingFields.length) throw new HttpError(400, cmd.errors[0] || `Missing: ${cmd.missingFields.join(', ')}`, { command: cmd });
  const key = req.get('Idempotency-Key');
  const result = await executeCommand(intent, cmd.data, { business: req.business, source: 'MANUAL', idempotencyKey: key ? `manual:${key.slice(0, 80)}` : undefined });
  return { ...result, command: cmd };
}

r.get('/', async (req, res) => {
  const q = validate(z.object({
    type: z.enum(TXN_TYPES).optional(),
    source: z.enum(['VOICE', 'MANUAL', 'SEED']).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    customerId: objectId.optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }), req.query);
  const filter = { businessId: req.business._id };
  for (const k of ['type', 'source', 'paymentMethod', 'customerId']) if (q[k]) filter[k] = q[k];
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = new Date(`${q.from}T00:00:00+05:30`);
    if (q.to) filter.createdAt.$lt = new Date(+new Date(`${q.to}T00:00:00+05:30`) + 864e5);
  }
  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).populate('customerId', 'name nameLocal').lean(),
    Transaction.countDocuments(filter),
  ]);
  res.json({ items, total, page: q.page, pages: Math.ceil(total / q.limit) });
});

r.post('/', async (req, res) => {
  const body = validate(z.object({
    type: z.enum(['PURCHASE', 'SALE', 'EXPENSE']),
    productId: objectId.optional(),
    product: z.string().trim().max(60).optional(),
    unit: z.string().optional(),
    quantity: z.coerce.number().positive().optional(),
    totalAmount: z.coerce.number().positive(),
    paymentMethod: z.enum(PAYMENT_METHODS).default('CASH'),
    customerId: objectId.optional(),
    customer: z.string().trim().max(60).optional(),
    category: z.string().trim().max(40).optional(),
    description: z.string().trim().max(200).optional(),
  }), req.body);
  const { type, ...data } = body;
  if (type === 'PURCHASE' && !data.productId && data.product) data.isNewProduct = true;
  const result = await runManual(req, type, data);
  res.status(result.replayed ? 200 : 201).json(result);
});

r.get('/:id', async (req, res) => {
  const t = await Transaction.findOne({ _id: req.params.id, businessId: req.business._id }).populate('customerId', 'name nameLocal phone').populate('voiceLogId', 'transcript language intent gnaniModels processingTime').lean();
  if (!t) throw new HttpError(404, 'Transaction not found');
  res.json(t);
});

export default r;
