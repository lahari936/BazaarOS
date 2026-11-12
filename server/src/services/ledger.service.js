// The only code that mutates financial state. Every write is deterministic and validated;
// the AI/voice layer can only hand a confirmed command to executeCommand().
import { withTransaction } from '../config.js';
import { HttpError } from '../middleware.js';
import { Product, Customer, Transaction } from '../models.js';
import { round2 } from './intent.service.js';

const script = (s) => (/[ఀ-౿ऀ-ॿ]/.test(s) ? s : null);
const opt = (session) => (session ? { session } : {});

/**
 * Execute a validated command. Idempotent per (business, idempotencyKey): a repeat returns the
 * original transaction with replayed=true and changes nothing.
 * Without replica-set transactions (local standalone mongod) we run compensating undos on failure.
 */
export async function executeCommand(intent, data, { business, source = 'MANUAL', transcript, voiceLogId, idempotencyKey }) {
  const businessId = business._id;
  if (idempotencyKey) {
    const existing = await Transaction.findOne({ businessId, idempotencyKey });
    if (existing) return { transaction: existing, replayed: true };
  }
  const undo = [];
  try {
    return await withTransaction(async (session) => {
      const base = { businessId, source, transcript, voiceLogId, idempotencyKey, paymentMethod: data.paymentMethod || 'CASH' };
      const run = HANDLERS[intent];
      if (!run) throw new HttpError(400, `Cannot execute ${intent}`);
      const result = await run(data, { businessId, base, session, undo });
      return { ...result, replayed: false };
    });
  } catch (err) {
    for (const fn of undo.reverse()) await fn().catch((e) => console.error('[ledger] undo failed', e));
    if (err.code === 11000 && idempotencyKey) {
      const existing = await Transaction.findOne({ businessId, idempotencyKey });
      if (existing) return { transaction: existing, replayed: true };
    }
    throw err;
  }
}

async function findProduct(businessId, data, session) {
  if (!data.productId) return null;
  const p = await Product.findOne({ _id: data.productId, businessId }, null, opt(session));
  if (!p) throw new HttpError(404, 'Product not found');
  return p;
}

async function resolveCustomer(businessId, data, session, undo) {
  if (data.customerId) {
    const c = await Customer.findOne({ _id: data.customerId, businessId }, null, opt(session));
    if (!c) throw new HttpError(404, 'Customer not found');
    return c;
  }
  if (!data.customer) throw new HttpError(400, 'Customer is required');
  const existing = await Customer.findOne({ businessId, $or: [{ name: data.customer }, { nameLocal: data.customer }] }, null, opt(session)).collation({ locale: 'en', strength: 2 });
  if (existing) return existing;
  const [c] = await Customer.create([{ businessId, name: data.customer, nameLocal: script(data.customer) || data.customerLocal || undefined }], opt(session));
  if (!session) undo.push(() => Customer.deleteOne({ _id: c._id }));
  return c;
}

async function addCredit(customer, amount, session, undo) {
  const c = await Customer.findByIdAndUpdate(customer._id, { $inc: { totalCredit: amount, outstandingBalance: amount } }, { returnDocument: 'after', ...opt(session) });
  if (!session) undo.push(() => Customer.updateOne({ _id: customer._id }, { $inc: { totalCredit: -amount, outstandingBalance: -amount } }));
  return c;
}

async function saveTxn(doc, session) {
  const [t] = await Transaction.create([doc], opt(session));
  return t;
}

/** Stock out at weighted-average cost. Atomic guard: never lets quantity go negative. */
async function stockOut(businessId, data, session, undo) {
  const qty = round2(data.quantity);
  if (!(qty > 0)) throw new HttpError(400, 'Quantity must be positive');
  const before = await Product.findOneAndUpdate(
    { _id: data.productId, businessId, quantity: { $gte: qty } },
    { $inc: { quantity: -qty } },
    { returnDocument: 'before', ...opt(session) },
  );
  if (!before) {
    const p = await findProduct(businessId, data, session);
    throw new HttpError(409, `Only ${round2(p.quantity)} ${p.unit} of ${p.name} in stock`, { code: 'INSUFFICIENT_STOCK' });
  }
  if (!session) undo.push(() => Product.updateOne({ _id: before._id }, { $inc: { quantity: qty } }));
  const unitCost = before.averagePurchasePrice || 0;
  const cogs = round2(qty * unitCost);
  const item = { productId: before._id, name: before.name, quantity: qty, unit: before.unit, unitPrice: round2(data.totalAmount / qty), unitCost, cogs };
  return { item, cogs, product: { ...before.toObject(), quantity: round2(before.quantity - qty) } };
}

const HANDLERS = {
  async PURCHASE(data, { businessId, base, session, undo }) {
    const qty = round2(data.quantity);
    const cost = round2(data.totalAmount);
    if (!(qty > 0 && cost > 0)) throw new HttpError(400, 'Quantity and amount must be positive');
    if (base.paymentMethod === 'CREDIT') throw new HttpError(400, 'Supplier credit is not supported yet. Use cash, UPI or card.');
    let product = await findProduct(businessId, data, session);
    if (!product) {
      if (!data.product) throw new HttpError(400, 'Product is required');
      product = await Product.findOne({ businessId, name: data.product }, null, opt(session)).collation({ locale: 'en', strength: 2 });
      if (!product) {
        [product] = await Product.create([{
          businessId, name: data.product, nameLocal: data.productLocal || undefined, unit: data.unit || 'kg',
          category: data.category || 'Vegetables', sellingPrice: data.sellingPrice || 0,
        }], opt(session));
        if (!session) undo.push(() => Product.deleteOne({ _id: product._id }));
      }
    }
    // Weighted average cost, computed atomically inside MongoDB (both fields read the pre-update doc).
    const updated = await Product.findOneAndUpdate(
      { _id: product._id, businessId },
      [{ $set: {
        averagePurchasePrice: { $round: [{ $divide: [{ $add: [{ $multiply: ['$quantity', '$averagePurchasePrice'] }, cost] }, { $add: ['$quantity', qty] }] }, 4] },
        quantity: { $round: [{ $add: ['$quantity', qty] }, 3] },
      } }],
      { returnDocument: 'after', updatePipeline: true, ...opt(session) },
    );
    if (!session) undo.push(() => Product.updateOne({ _id: product._id }, { $set: { quantity: product.quantity, averagePurchasePrice: product.averagePurchasePrice } }));
    const transaction = await saveTxn({ ...base, type: 'PURCHASE', amount: cost, items: [{ productId: product._id, name: product.name, quantity: qty, unit: product.unit, unitPrice: round2(cost / qty) }] }, session);
    return { transaction, product: updated };
  },

  async SALE(data, ctx) {
    const { businessId, base, session, undo } = ctx;
    const amount = round2(data.totalAmount);
    if (!(amount > 0)) throw new HttpError(400, 'Amount must be positive');
    if (!data.productId) throw new HttpError(400, 'Pick a product from inventory');
    const credit = base.paymentMethod === 'CREDIT';
    const customer = credit || data.customerId ? await resolveCustomer(businessId, data, session, undo) : null;
    const { item, cogs, product } = await stockOut(businessId, data, session, undo);
    const updatedCustomer = credit ? await addCredit(customer, amount, session, undo) : customer;
    const transaction = await saveTxn({ ...base, type: 'SALE', amount, cogs, items: [item], customerId: customer?._id, paymentStatus: credit ? 'UNPAID' : 'PAID' }, session);
    return { transaction, product, customer: updatedCustomer };
  },

  async EXPENSE(data, { base, session }) {
    const amount = round2(data.totalAmount);
    if (!(amount > 0)) throw new HttpError(400, 'Amount must be positive');
    if (base.paymentMethod === 'CREDIT') throw new HttpError(400, 'Expenses must be cash, UPI or card');
    const transaction = await saveTxn({ ...base, type: 'EXPENSE', amount, category: data.category || 'Other', note: data.description }, session);
    return { transaction };
  },

  // Credit sale if goods are named (revenue + COGS, unpaid). Otherwise a receivable only, NOT revenue.
  async CUSTOMER_CREDIT(data, ctx) {
    if (data.productId) return HANDLERS.SALE({ ...data, paymentMethod: 'CREDIT' }, { ...ctx, base: { ...ctx.base, paymentMethod: 'CREDIT' } });
    const { businessId, base, session, undo } = ctx;
    const amount = round2(data.totalAmount);
    if (!(amount > 0)) throw new HttpError(400, 'Amount must be positive');
    const customer = await resolveCustomer(businessId, data, session, undo);
    const updated = await addCredit(customer, amount, session, undo);
    const transaction = await saveTxn({ ...base, type: 'CREDIT', amount, customerId: customer._id, paymentMethod: 'CREDIT', paymentStatus: 'UNPAID', note: data.note }, session);
    return { transaction, customer: updated };
  },

  async CUSTOMER_PAYMENT(data, { businessId, base, session, undo }) {
    const amount = round2(data.totalAmount);
    if (!(amount > 0)) throw new HttpError(400, 'Amount must be positive');
    if (base.paymentMethod === 'CREDIT') throw new HttpError(400, 'Payment method cannot be credit');
    if (!data.customerId) throw new HttpError(400, 'Pick an existing customer');
    const updated = await Customer.findOneAndUpdate(
      { _id: data.customerId, businessId, outstandingBalance: { $gte: amount - 0.005 } },
      { $inc: { totalPaid: amount, outstandingBalance: -amount } },
      { returnDocument: 'after', ...opt(session) },
    );
    if (!updated) {
      const c = await Customer.findOne({ _id: data.customerId, businessId });
      if (!c) throw new HttpError(404, 'Customer not found');
      throw new HttpError(400, `${c.name} owes only ₹${round2(c.outstandingBalance)}`, { code: 'OVERPAYMENT' });
    }
    if (!session) undo.push(() => Customer.updateOne({ _id: updated._id }, { $inc: { totalPaid: -amount, outstandingBalance: amount } }));
    if (updated.outstandingBalance < 0.005 && updated.outstandingBalance !== 0) await Customer.updateOne({ _id: updated._id }, { $set: { outstandingBalance: 0 } }, opt(session));
    const transaction = await saveTxn({ ...base, type: 'PAYMENT_IN', amount, customerId: updated._id, paymentStatus: 'PAID' }, session);
    return { transaction, customer: updated };
  },
};
