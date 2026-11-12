// All numbers come from MongoDB aggregations over the ledger.
// Gross profit = revenue - COGS (weighted-average cost captured on each sale).
// Net profit = gross profit - operating expenses. Purchases are NOT subtracted: unsold stock is an asset.
import { Transaction, Customer, Product } from '../models.js';
import { round2 } from './intent.service.js';

export const TZ = 'Asia/Kolkata';
const IST_MS = 330 * 60 * 1000;
const DAY = 864e5;

export const startOfDayIST = (d = new Date()) => new Date(Math.floor((d.getTime() + IST_MS) / DAY) * DAY - IST_MS);

export function periodRange(period = 'today', now = new Date()) {
  const today = startOfDayIST(now);
  switch (period) {
    case 'yesterday': return { from: new Date(today - DAY), to: today };
    case 'week': return { from: new Date(today - 6 * DAY), to: new Date(+today + DAY) };
    case 'month': return { from: new Date(today - 29 * DAY), to: new Date(+today + DAY) };
    default: return { from: today, to: new Date(+today + DAY) };
  }
}

export async function summarize(businessId, from, to) {
  const rows = await Transaction.aggregate([
    { $match: { businessId, createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: { type: '$type', credit: { $eq: ['$paymentMethod', 'CREDIT'] } }, amount: { $sum: '$amount' }, cogs: { $sum: '$cogs' }, count: { $sum: 1 } } },
  ]);
  const s = { revenue: 0, cashSales: 0, creditSales: 0, cogs: 0, purchases: 0, expenses: 0, creditGiven: 0, paymentsIn: 0, transactions: 0 };
  for (const r of rows) {
    s.transactions += r.count;
    if (r._id.type === 'SALE') {
      s.revenue += r.amount; s.cogs += r.cogs;
      if (r._id.credit) s.creditSales += r.amount; else s.cashSales += r.amount;
    }
    if (r._id.type === 'PURCHASE') s.purchases += r.amount;
    if (r._id.type === 'EXPENSE') s.expenses += r.amount;
    if (r._id.type === 'CREDIT') s.creditGiven += r.amount;
    if (r._id.type === 'PAYMENT_IN') s.paymentsIn += r.amount;
  }
  s.grossProfit = s.revenue - s.cogs;
  s.netProfit = s.grossProfit - s.expenses;
  s.cashIn = s.cashSales + s.paymentsIn; // credit sales are receivables, never cash
  for (const k of Object.keys(s)) s[k] = round2(s[k]);
  return { from, to, ...s };
}

export async function receivables(businessId) {
  const [r] = await Customer.aggregate([{ $match: { businessId } }, { $group: { _id: null, total: { $sum: '$outstandingBalance' }, debtors: { $sum: { $cond: [{ $gt: ['$outstandingBalance', 0.005] }, 1, 0] } } } }]);
  return { total: round2(r?.total || 0), debtors: r?.debtors || 0 };
}

export async function inventoryStats(businessId) {
  const products = await Product.find({ businessId }).sort({ name: 1 }).lean();
  const low = products.filter((p) => p.quantity <= p.lowStockThreshold);
  const value = round2(products.reduce((a, p) => a + p.quantity * p.averagePurchasePrice, 0));
  return { products, low, value };
}

/** Daily series (IST days) for charts. */
export async function trend(businessId, days = 7) {
  const to = new Date(+startOfDayIST() + DAY);
  const from = new Date(+to - days * DAY);
  const rows = await Transaction.aggregate([
    { $match: { businessId, createdAt: { $gte: from, $lt: to } } },
    { $group: {
      _id: { day: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: TZ } }, type: '$type' },
      amount: { $sum: '$amount' }, cogs: { $sum: '$cogs' },
    } },
  ]);
  const series = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(+from + i * DAY + IST_MS).toISOString().slice(0, 10);
    const get = (type, f = 'amount') => rows.find((r) => r._id.day === day && r._id.type === type)?.[f] || 0;
    const revenue = get('SALE');
    const cogs = get('SALE', 'cogs');
    const expenses = get('EXPENSE');
    series.push({ day, revenue: round2(revenue), cogs: round2(cogs), purchases: round2(get('PURCHASE')), expenses: round2(expenses), grossProfit: round2(revenue - cogs), netProfit: round2(revenue - cogs - expenses) });
  }
  return series;
}

export async function alerts(businessId) {
  const out = [];
  const { products } = await inventoryStats(businessId);
  for (const p of products) {
    if (p.quantity <= 0) out.push({ type: 'OUT_OF_STOCK', severity: 'danger', productId: p._id, title: `${p.name} is out of stock`, detail: 'Restock before the next sale.' });
    else if (p.quantity <= p.lowStockThreshold) out.push({ type: 'LOW_STOCK', severity: 'warning', productId: p._id, title: `${p.name} running low`, detail: `${round2(p.quantity)} ${p.unit} left (alert at ${p.lowStockThreshold}).` });
  }
  const debtors = await Customer.find({ businessId, outstandingBalance: { $gt: 0.005 } }).sort({ outstandingBalance: -1 }).limit(10).lean();
  if (debtors.length) {
    const last = await Transaction.aggregate([
      { $match: { businessId, customerId: { $in: debtors.map((d) => d._id) } } },
      { $group: {
        _id: '$customerId',
        at: { $max: { $cond: [{ $eq: ['$type', 'PAYMENT_IN'] }, '$createdAt', null] } },
        firstCredit: { $min: { $cond: [{ $eq: ['$paymentMethod', 'CREDIT'] }, '$createdAt', null] } },
      } },
    ]);
    for (const c of debtors) {
      const row = last.find((l) => String(l._id) === String(c._id));
      const paidAt = row?.at;
      const since = paidAt || row?.firstCredit || c.createdAt;
      const days = Math.floor((Date.now() - since) / DAY);
      out.push({
        type: 'PENDING_PAYMENT', severity: days > 7 ? 'warning' : 'info', customerId: c._id,
        title: `${c.name} owes ₹${round2(c.outstandingBalance)}`,
        detail: paidAt ? `Last payment ${days} day(s) ago.` : `No payment recorded in ${days} day(s).`,
      });
    }
  }
  // Unusually high expenses: today vs average of previous 14 days.
  const today = startOfDayIST();
  const [t] = await Transaction.aggregate([{ $match: { businessId, type: 'EXPENSE', createdAt: { $gte: today } } }, { $group: { _id: null, s: { $sum: '$amount' } } }]);
  const [h] = await Transaction.aggregate([{ $match: { businessId, type: 'EXPENSE', createdAt: { $gte: new Date(today - 14 * DAY), $lt: today } } }, { $group: { _id: null, s: { $sum: '$amount' } } }]);
  const todayExp = t?.s || 0;
  const avg = (h?.s || 0) / 14;
  if (todayExp > 100 && avg > 0 && todayExp > 2 * avg) {
    out.push({ type: 'HIGH_EXPENSE', severity: 'warning', title: `High expenses today: ₹${round2(todayExp)}`, detail: `About ${round2(todayExp / avg)}x your 14-day daily average of ₹${round2(avg)}.` });
  }
  const rank = { danger: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
