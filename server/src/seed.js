// Seeds (or resets) the demo shop "Sri Lakshmi Vegetables". Only touches the demo account.
// History is synthetic and marked source=SEED; today's data is left empty for the live demo.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from './config.js';
import { User, Business, Product, Customer, Transaction, VoiceLog } from './models.js';

export const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@bazaaros.test';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'lakshmi-demo-2026';

await connectDb();
let user = await User.findOne({ email: DEMO_EMAIL });
if (!user) user = await User.create({ name: 'Lakshmi', email: DEMO_EMAIL, phone: '9000000000', passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) });
let biz = await Business.findOne({ ownerId: user._id });
if (!biz) biz = await Business.create({ ownerId: user._id, shopName: 'Sri Lakshmi Vegetables', businessType: 'vegetables', preferredLanguage: 'te-IN', location: 'Kukatpally Rythu Bazaar, Hyderabad' });
const businessId = biz._id;
await Promise.all([Product, Customer, Transaction, VoiceLog].map((M) => M.deleteMany({ businessId })));

const products = await Product.insertMany([
  { name: 'Tomatoes', nameLocal: 'టమాటాలు', aliases: ['टमाटर'], quantity: 12, unit: 'kg', averagePurchasePrice: 18, sellingPrice: 30, lowStockThreshold: 5 },
  { name: 'Potatoes', nameLocal: 'బంగాళదుంపలు', aliases: ['आलू', 'ఆలుగడ్డ'], quantity: 40, unit: 'kg', averagePurchasePrice: 22, sellingPrice: 35, lowStockThreshold: 10 },
  { name: 'Onions', nameLocal: 'ఉల్లిపాయలు', aliases: ['प्याज'], quantity: 25, unit: 'kg', averagePurchasePrice: 28, sellingPrice: 40, lowStockThreshold: 8 },
  { name: 'Green Chillies', nameLocal: 'పచ్చిమిర్చి', aliases: ['मिर्च'], quantity: 3, unit: 'kg', averagePurchasePrice: 40, sellingPrice: 80, lowStockThreshold: 5 },
  { name: 'Carrots', nameLocal: 'క్యారెట్లు', aliases: ['गाजर'], quantity: 8, unit: 'kg', averagePurchasePrice: 30, sellingPrice: 50, lowStockThreshold: 4 },
].map((p) => ({ ...p, businessId, category: 'Vegetables' })));
const P = Object.fromEntries(products.map((p) => [p.name, p]));

const customers = await Customer.insertMany([
  { name: 'Ravi', nameLocal: 'రవి', phone: '9000000001' },
  { name: 'Lakshmamma', nameLocal: 'లక్ష్మమ్మ', phone: '9000000002' },
  { name: 'Suresh', nameLocal: 'సురేష్' },
  { name: 'Anitha', nameLocal: 'అనిత', phone: '9000000004' },
].map((c) => ({ ...c, businessId })));
const C = Object.fromEntries(customers.map((c) => [c.name, c]));

const DAY = 864e5;
const at = (daysAgo, hour) => new Date(Date.now() - daysAgo * DAY - (Date.now() % DAY) + (hour - 5.5) * 3600e3);
const sale = (d, h, name, qty, price, extra = {}) => {
  const p = P[name];
  const cogs = Math.round(qty * p.averagePurchasePrice * 100) / 100;
  return { type: 'SALE', createdAt: at(d, h), amount: qty * price, cogs, items: [{ productId: p._id, name, quantity: qty, unit: 'kg', unitPrice: price, unitCost: p.averagePurchasePrice, cogs }], ...extra };
};
const buy = (d, h, name, qty, price) => ({ type: 'PURCHASE', createdAt: at(d, h), amount: qty * price, items: [{ productId: P[name]._id, name, quantity: qty, unit: 'kg', unitPrice: price }] });
const credit = (d, h, who, amt) => ({ type: 'CREDIT', createdAt: at(d, h), amount: amt, customerId: C[who]._id, paymentMethod: 'CREDIT', paymentStatus: 'UNPAID' });
const paid = (d, h, who, amt) => ({ type: 'PAYMENT_IN', createdAt: at(d, h), amount: amt, customerId: C[who]._id });
const expense = (d, h, category, amt, note) => ({ type: 'EXPENSE', createdAt: at(d, h), amount: amt, category, note });

const txns = [];
for (let d = 7; d >= 1; d--) {
  txns.push(buy(d, 6, 'Tomatoes', 15 + (d % 3) * 5, 18), buy(d, 6, 'Onions', 10, 28));
  txns.push(sale(d, 9, 'Tomatoes', 8 + (d % 4), 30), sale(d, 11, 'Onions', 6 + (d % 3), 40), sale(d, 17, 'Potatoes', 5 + (d % 5), 35, { paymentMethod: 'UPI' }));
  if (d % 2) txns.push(sale(d, 18, 'Carrots', 3, 50), sale(d, 19, 'Green Chillies', 1, 80));
  txns.push(expense(d, 7, 'Transport', 80 + (d % 3) * 20, 'Auto to Bowenpally market'));
}
txns.push(expense(5, 20, 'Rent', 1500, 'Stall rent'));
txns.push(sale(6, 12, 'Tomatoes', 4, 30, { paymentMethod: 'CREDIT', paymentStatus: 'UNPAID', customerId: C.Lakshmamma._id }));
txns.push(credit(4, 13, 'Lakshmamma', 200), paid(2, 10, 'Lakshmamma', 100));
txns.push(credit(3, 16, 'Anitha', 90), credit(5, 16, 'Ravi', 150), paid(1, 9, 'Ravi', 150));
await Transaction.insertMany(txns.map((t) => ({ paymentMethod: 'CASH', paymentStatus: 'PAID', ...t, businessId, source: 'SEED' })));

// Khata balances derived from the seeded ledger so they always agree.
for (const c of customers) {
  const rows = txns.filter((t) => String(t.customerId) === String(c._id));
  const totalCredit = rows.filter((t) => t.paymentMethod === 'CREDIT').reduce((a, t) => a + t.amount, 0);
  const totalPaid = rows.filter((t) => t.type === 'PAYMENT_IN').reduce((a, t) => a + t.amount, 0);
  await Customer.updateOne({ _id: c._id }, { totalCredit, totalPaid, outstandingBalance: totalCredit - totalPaid });
}
console.log(`Seeded "${biz.shopName}": ${products.length} products, ${customers.length} customers, ${txns.length} transactions. Login: ${DEMO_EMAIL}`);
await mongoose.disconnect();
