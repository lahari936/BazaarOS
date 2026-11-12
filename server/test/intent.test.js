import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../src/services/intent.service.js';

const products = [
  { _id: 'p1', name: 'Tomatoes', nameLocal: 'టమాటాలు', unit: 'kg', quantity: 30, averagePurchasePrice: 18 },
  { _id: 'p2', name: 'Onions', nameLocal: 'ఉల్లిపాయలు', unit: 'kg', quantity: 2, averagePurchasePrice: 25 },
];
const customers = [{ _id: 'c1', name: 'Ravi', nameLocal: 'రవి', outstandingBalance: 300 }];
const ctx = { products, customers, language: 'te-IN' };
const p = (t, c = ctx) => parseCommand(t, c);

test('demo 1: Telugu purchase', () => {
  const r = p('ఈరోజు 20 కిలోల టమాటాలు 400 రూపాయలకు కొన్నాను');
  assert.equal(r.intent, 'PURCHASE');
  assert.equal(r.data.productId, 'p1');
  assert.equal(r.data.quantity, 20);
  assert.equal(r.data.unit, 'kg');
  assert.equal(r.data.totalAmount, 400);
  assert.equal(r.data.unitPrice, 20);
  assert.deepEqual(r.missingFields, []);
  assert.equal(r.requiresConfirmation, true);
});

test('demo 2: Telugu sale', () => {
  const r = p('5 కిలోల టమాటాలు 150 రూపాయలకు అమ్మాను');
  assert.equal(r.intent, 'SALE');
  assert.equal(r.data.quantity, 5);
  assert.equal(r.data.totalAmount, 150);
  assert.equal(r.data.paymentMethod, 'CASH');
  assert.deepEqual(r.errors, []);
});

test('demo 3: Telugu customer credit (known customer, no goods = receivable only)', () => {
  const r = p('రవి 200 రూపాయలు అప్పుగా తీసుకున్నాడు');
  assert.equal(r.intent, 'CUSTOMER_CREDIT');
  assert.equal(r.data.customerId, 'c1');
  assert.equal(r.data.totalAmount, 200);
  assert.ok(r.warnings.includes('RECEIVABLE_ONLY'));
});

test('demo 4: Telugu profit query', () => {
  const r = p('ఈరోజు ఎంత లాభం వచ్చింది?');
  assert.equal(r.intent, 'PROFIT_QUERY');
  assert.equal(r.data.period, 'today');
  assert.equal(r.requiresConfirmation, false);
});

test('missing price is asked, never invented', () => {
  const r = p('10 కిలోల టమాటాలు కొన్నాను');
  assert.equal(r.intent, 'PURCHASE');
  assert.deepEqual(r.missingFields, ['totalAmount']);
  assert.ok(r.clarificationQuestion);
});

test('insufficient stock blocks sale', () => {
  const r = p('5 కిలోల ఉల్లిపాయలు 200 రూపాయలకు అమ్మాను');
  assert.equal(r.intent, 'SALE');
  assert.equal(r.errors.length, 1);
});

test('unit price is multiplied deterministically', () => {
  const r = parseCommand('sold 4 kg tomatoes at 30 rupees per kg', { ...ctx, language: 'en-IN' });
  assert.equal(r.intent, 'SALE');
  assert.equal(r.data.totalAmount, 120);
});

test('grams convert to kg', () => {
  const r = parseCommand('500 ग्राम टमाटर 20 रुपये में बेचे', { ...ctx, language: 'hi-IN' });
  assert.equal(r.intent, 'SALE');
  assert.equal(r.data.quantity, 0.5);
});

test('Hindi credit to new customer', () => {
  const r = parseCommand('सुरेश ने 300 रुपये उधार लिए', { ...ctx, language: 'hi-IN' });
  assert.equal(r.intent, 'CUSTOMER_CREDIT');
  assert.equal(r.data.customer, 'सुरेश');
  assert.equal(r.data.isNewCustomer, true);
});

test('customer payment and overpayment guard', () => {
  const ok = p('రవి 100 రూపాయలు తిరిగి ఇచ్చాడు');
  assert.equal(ok.intent, 'CUSTOMER_PAYMENT');
  assert.deepEqual(ok.errors, []);
  const over = p('రవి 500 రూపాయలు ఇచ్చాడు');
  assert.equal(over.intent, 'CUSTOMER_PAYMENT');
  assert.equal(over.errors.length, 1);
  const hi = parseCommand('रवि ने 100 रुपये दिए', { ...ctx, language: 'hi-IN' });
  assert.equal(hi.intent, 'CUSTOMER_PAYMENT');
});

test('vendor borrowing is not a receivable', () => {
  const r = p('నేను అప్పు తీసుకున్నాను 500 రూపాయలు');
  assert.equal(r.intent, 'UNKNOWN');
  assert.equal(r.reason, 'VENDOR_OWES');
});

test('expense with category', () => {
  const r = p('ఆటో కి 80 రూపాయలు ఖర్చు');
  assert.equal(r.intent, 'EXPENSE');
  assert.equal(r.data.category, 'Transport');
  assert.equal(r.data.totalAmount, 80);
  const e = parseCommand('paid 2000 rupees rent', { ...ctx, language: 'en-IN' });
  assert.equal(e.intent, 'EXPENSE');
  assert.equal(e.data.category, 'Rent');
});

test('inventory query and report', () => {
  assert.equal(p('టమాటాలు ఎన్ని కిలోలు ఉన్నాయి?').intent, 'INVENTORY_QUERY');
  assert.equal(p('ఈరోజు రిపోర్ట్ చెప్పు').intent, 'DAILY_REPORT');
  assert.equal(parseCommand('how much did I sell this week', { ...ctx, language: 'en-IN' }).data.period, 'week');
});

test('code-mixed English/Telugu purchase of new product', () => {
  const r = p('today 10 kg carrots 300 rupees ki konnanu');
  assert.equal(r.intent, 'PURCHASE');
  assert.equal(r.data.product, 'Carrots');
  assert.equal(r.data.isNewProduct, true);
  assert.equal(r.data.totalAmount, 300);
});

test('ambiguous buy/sell asks', () => {
  const r = p('10 కిలోల టమాటాలు 200 రూపాయలు');
  assert.equal(r.intent, 'UNKNOWN');
  assert.equal(r.reason, 'BUY_OR_SELL');
});
