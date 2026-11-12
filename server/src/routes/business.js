// Business profile, dashboard, reports and alerts.
import { Router } from 'express';
import { z } from 'zod';
import { Business, Transaction } from '../models.js';
import { HttpError, requireAuth, requireBusiness, validate } from '../middleware.js';
import { summarize, receivables, inventoryStats, trend, alerts, periodRange, startOfDayIST } from '../services/reports.service.js';

const r = Router();
const businessBody = z.object({
  shopName: z.string().trim().min(2).max(80),
  businessType: z.string().trim().max(40).optional(),
  preferredLanguage: z.enum(['te-IN', 'hi-IN', 'en-IN']).optional(),
  location: z.string().trim().max(120).optional(),
});

r.post('/business', requireAuth, async (req, res) => {
  const body = validate(businessBody, req.body);
  if (await Business.exists({ ownerId: req.userId })) throw new HttpError(409, 'You already have a shop');
  res.status(201).json(await Business.create({ ...body, ownerId: req.userId }));
});
r.get('/business', requireAuth, requireBusiness, (req, res) => res.json(req.business));
r.put('/business', requireAuth, requireBusiness, async (req, res) => {
  Object.assign(req.business, validate(businessBody.partial(), req.body));
  res.json(await req.business.save());
});

r.get('/dashboard', requireAuth, requireBusiness, async (req, res) => {
  const id = req.business._id;
  const { from, to } = periodRange('today');
  const [today, recv, inv, recent, week, alertList] = await Promise.all([
    summarize(id, from, to), receivables(id), inventoryStats(id),
    Transaction.find({ businessId: id }).sort({ createdAt: -1 }).limit(8).populate('customerId', 'name nameLocal').lean(),
    trend(id, 7), alerts(id),
  ]);
  res.json({
    today, receivables: recv, recent, week, alerts: alertList.slice(0, 5),
    inventory: { totalProducts: inv.products.length, value: inv.value, lowStock: inv.low },
  });
});

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
r.get('/reports/daily', requireAuth, requireBusiness, async (req, res) => {
  const { date } = validate(z.object({ date: day.optional() }), req.query);
  const from = date ? new Date(`${date}T00:00:00+05:30`) : startOfDayIST();
  res.json(await summarize(req.business._id, from, new Date(+from + 864e5)));
});
r.get('/reports/profit', requireAuth, requireBusiness, async (req, res) => {
  const q = validate(z.object({ period: z.enum(['today', 'yesterday', 'week', 'month']).optional(), from: day.optional(), to: day.optional() }), req.query);
  const range = q.from && q.to ? { from: new Date(`${q.from}T00:00:00+05:30`), to: new Date(+new Date(`${q.to}T00:00:00+05:30`) + 864e5) } : periodRange(q.period);
  const [summary, recv, inv] = await Promise.all([summarize(req.business._id, range.from, range.to), receivables(req.business._id), inventoryStats(req.business._id)]);
  res.json({ ...summary, receivables: recv.total, inventoryValue: inv.value });
});
r.get('/reports/weekly', requireAuth, requireBusiness, async (req, res) => {
  const { days } = validate(z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }), req.query);
  res.json(await trend(req.business._id, days));
});
r.get('/alerts', requireAuth, requireBusiness, async (req, res) => res.json(await alerts(req.business._id)));

export default r;
