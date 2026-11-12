import { Router } from 'express';
import { z } from 'zod';
import { Customer, Transaction, PAYMENT_METHODS } from '../models.js';
import { HttpError, requireAuth, requireBusiness, validate } from '../middleware.js';
import { runManual } from './transactions.js';

const r = Router();
r.use(requireAuth, requireBusiness);

const body = z.object({
  name: z.string().trim().min(1).max(60),
  nameLocal: z.string().trim().max(60).optional(),
  phone: z.string().trim().regex(/^[+\d\s-]{0,15}$/, 'invalid phone').optional(),
});

r.get('/', async (req, res) => {
  res.json(await Customer.find({ businessId: req.business._id }).sort({ outstandingBalance: -1, name: 1 }).lean());
});
r.post('/', async (req, res) => {
  res.status(201).json(await Customer.create({ ...validate(body, req.body), businessId: req.business._id }));
});
r.put('/:id', async (req, res) => {
  const c = await Customer.findOneAndUpdate({ _id: req.params.id, businessId: req.business._id }, validate(body.partial(), req.body), { returnDocument: 'after', runValidators: true });
  if (!c) throw new HttpError(404, 'Customer not found');
  res.json(c);
});
r.get('/:id', async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, businessId: req.business._id }).lean();
  if (!customer) throw new HttpError(404, 'Customer not found');
  const ledger = await Transaction.find({ businessId: req.business._id, customerId: customer._id }).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ customer, ledger });
});

const money = z.object({ amount: z.coerce.number().positive().max(10_000_000), paymentMethod: z.enum(PAYMENT_METHODS).default('CASH'), note: z.string().trim().max(200).optional() });

r.post('/:id/payment', async (req, res) => {
  const b = validate(money, req.body);
  const result = await runManual(req, 'CUSTOMER_PAYMENT', { customerId: req.params.id, totalAmount: b.amount, paymentMethod: b.paymentMethod });
  res.status(result.replayed ? 200 : 201).json(result);
});
r.post('/:id/credit', async (req, res) => {
  const b = validate(money, req.body);
  const result = await runManual(req, 'CUSTOMER_CREDIT', { customerId: req.params.id, totalAmount: b.amount, note: b.note });
  res.status(result.replayed ? 200 : 201).json(result);
});

export default r;
