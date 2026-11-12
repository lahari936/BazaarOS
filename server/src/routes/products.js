import { Router } from 'express';
import { z } from 'zod';
import { Product, UNITS } from '../models.js';
import { HttpError, requireAuth, requireBusiness, validate } from '../middleware.js';

const r = Router();
r.use(requireAuth, requireBusiness);

const editable = z.object({
  name: z.string().trim().min(1).max(60),
  nameLocal: z.string().trim().max(60).optional(),
  aliases: z.array(z.string().trim().min(2).max(40)).max(10).optional(),
  category: z.string().trim().max(40).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  lowStockThreshold: z.coerce.number().min(0).optional(),
});
// Opening stock is set once at creation; afterwards stock only moves through purchases/sales.
const create = editable.extend({
  unit: z.enum(UNITS).default('kg'),
  quantity: z.coerce.number().min(0).default(0),
  averagePurchasePrice: z.coerce.number().min(0).default(0),
});

r.get('/', async (req, res) => {
  res.json(await Product.find({ businessId: req.business._id }).sort({ name: 1 }).lean());
});
r.post('/', async (req, res) => {
  res.status(201).json(await Product.create({ ...validate(create, req.body), businessId: req.business._id }));
});
r.put('/:id', async (req, res) => {
  const p = await Product.findOneAndUpdate({ _id: req.params.id, businessId: req.business._id }, validate(editable.partial(), req.body), { returnDocument: 'after', runValidators: true });
  if (!p) throw new HttpError(404, 'Product not found');
  res.json(p);
});
r.delete('/:id', async (req, res) => {
  const p = await Product.findOneAndDelete({ _id: req.params.id, businessId: req.business._id });
  if (!p) throw new HttpError(404, 'Product not found');
  res.json({ deleted: true }); // past transactions keep the product name snapshot
});

export default r;
