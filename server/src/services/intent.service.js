// Deterministic intent extraction ("rules" provider). Pure functions: no DB, no network.
// The engine only *proposes* a command; ledger.service executes it after the user confirms.
// To plug in an LLM (e.g. Evon) later, produce the same {intent, data} shape and pass it
// through validateCommand(), which stays the single source of truth for business rules.
import { WORDS, UNIT_WORDS, CURRENCY_WORDS, PER_WORDS, HALF_WORDS, EXPENSE_CATEGORIES, PRODUCT_LEXICON, STOPWORDS } from './lexicon.js';
import { msg, unitName } from './responses.js';

export const INTENTS = ['PURCHASE', 'SALE', 'EXPENSE', 'CUSTOMER_CREDIT', 'CUSTOMER_PAYMENT', 'INVENTORY_QUERY', 'PROFIT_QUERY', 'DAILY_REPORT', 'UNKNOWN'];
export const TXN_INTENTS = ['PURCHASE', 'SALE', 'EXPENSE', 'CUSTOMER_CREDIT', 'CUSTOMER_PAYMENT'];

const LATIN = /^[a-z]/;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const formHit = (text, form) => (LATIN.test(form) ? new RegExp(`(^|[^a-z])${esc(form)}`).test(text) : text.includes(form));
const has = (text, list) => list.some((f) => formHit(text, f));
const tokenIs = (tok, list) => !!tok && list.some((f) => tok.startsWith(f.trim()));
const unitOf = (tok) => tok && Object.keys(UNIT_WORDS).find((u) => tokenIs(tok, UNIT_WORDS[u]));
const isNum = (tok) => /^\d+(\.\d+)?$/.test(tok || '');
export const round2 = (n) => Math.round(n * 100) / 100;

export function normalize(raw) {
  return ` ${String(raw || '')
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/₹\s*/g, ' ₹ ')
    .replace(/(\d)(?=[^\d\s.])/g, '$1 ')
    .replace(/([^\d\s.₹])(?=\d)/g, '$1 ')
    .replace(/[,!।|"“”()]/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

/** Classify every number in the utterance as quantity, amount, unit price or unknown. */
export function extractNumbers(text) {
  const toks = text.trim().split(' ');
  const out = { quantities: [], amounts: [], unitPrices: [], bare: [] };
  toks.forEach((tok, i) => {
    const prev = toks[i - 1];
    const next = toks[i + 1];
    if (HALF_WORDS.includes(tok) && unitOf(next)) return out.quantities.push({ value: 0.5, unit: unitOf(next) });
    if (!isNum(tok)) return;
    const value = Number(tok);
    const near = toks.slice(Math.max(0, i - 2), i + 4).join(' ');
    const isMoney = prev === '₹' || tokenIs(next, CURRENCY_WORDS);
    if (isMoney) {
      const after = tokenIs(next, CURRENCY_WORDS) ? toks[i + 2] : next;
      const perUnit = has(` ${near} `, PER_WORDS) || (unitOf(prev) && !isNum(toks[i - 2]) && prev !== '₹') || (unitOf(after) && !isNum(toks[i + 3]));
      return (perUnit ? out.unitPrices : out.amounts).push(value);
    }
    const u = unitOf(next);
    if (u) return out.quantities.push({ value, unit: u });
    out.bare.push(value);
  });
  return out;
}

function productForms(p) {
  const forms = [p.name, p.nameLocal, ...(p.aliases || [])].filter(Boolean).map((s) => s.toLowerCase());
  // singular stems: "tomatoes" -> "tomato", Telugu plural "టమాటాలు" -> "టమాటా"
  forms.push(...forms.map((f) => f.replace(/(es|s)$/, '').replace(/లు$/, '')));
  const lex = PRODUCT_LEXICON.find((l) => l.name.toLowerCase() === p.name.toLowerCase());
  if (lex) forms.push(...lex.forms);
  return [...new Set(forms.filter((f) => f.length >= 3))];
}

/** Longest matching spoken form wins. Returns an inventory product, or a lexicon suggestion, or null. */
export function matchProduct(text, products = []) {
  let best = null;
  for (const p of products) for (const f of productForms(p)) if (formHit(text, f) && (!best || f.length > best.len)) best = { len: f.length, product: p };
  if (best) return { product: best.product, isNew: false };
  for (const l of PRODUCT_LEXICON) for (const f of l.forms) if (formHit(text, f) && (!best || f.length > best.len)) best = { len: f.length, product: l };
  return best ? { product: best.product, isNew: true } : null;
}

export function matchCustomer(text, customers = []) {
  let best = null;
  for (const c of customers) {
    for (const f of [c.name, c.nameLocal, ...(c.aliases || [])].filter(Boolean).map((s) => s.toLowerCase())) {
      if (f.length >= 2 && formHit(text, f) && (!best || f.length > best.len)) best = { len: f.length, customer: c };
    }
  }
  return best?.customer || null;
}

const FILLER = new Set(['gave', 'took', 'taken', 'given', 'to', 'on', 'from', 'has', 'have', 'for', 'the', 'a', 'of', 'owes', 'debt', 'back', 'ne', 'ko', 'ने', 'को', 'से', 'జీ', 'జి']);

/** Guess a new customer's name: the first word that is not a number, keyword, unit or product. */
export function guessName(text) {
  const all = [...Object.values(WORDS).flat(), ...Object.values(UNIT_WORDS).flat(), ...CURRENCY_WORDS, ...PRODUCT_LEXICON.flatMap((p) => p.forms)];
  for (let tok of text.trim().split(' ')) {
    if (!tok || tok === '₹' || isNum(tok) || STOPWORDS.has(tok) || FILLER.has(tok) || all.some((f) => f.trim().length > 1 && tok.startsWith(f.trim()))) continue;
    tok = tok.replace(/(గారికి|గారు|కి|కు|తో)$/, '').replace(/'s$/, '');
    if (tok.length >= 2 && /^[\p{L}\p{M}]+$/u.test(tok)) return LATIN.test(tok) ? tok[0].toUpperCase() + tok.slice(1) : tok;
  }
  return null;
}

function classify(text, nums, product, customer) {
  const anyMoney = nums.amounts.length || nums.unitPrices.length;
  if (has(text, WORDS.vendorOwes)) return { intent: 'UNKNOWN', reason: 'VENDOR_OWES' };
  if (has(text, WORDS.profit)) return { intent: 'PROFIT_QUERY' };
  if (has(text, WORDS.question) && !anyMoney && !nums.quantities.length) {
    if (product && !product.isNew && !has(text, WORDS.report)) return { intent: 'INVENTORY_QUERY' };
    if (has(text, WORDS.stock) && !has(text, WORDS.report)) return { intent: 'INVENTORY_QUERY' };
    return { intent: 'DAILY_REPORT' };
  }
  const credit = has(text, WORDS.credit);
  const sale = has(text, WORDS.sale);
  const purchase = has(text, WORDS.purchase);
  const expense = has(text, WORDS.expense);
  const hindiGave = /(दिए|दिया|दी)/.test(text) && / ने /.test(text) && !/(मैंने|हमने)/.test(text);
  const repay = has(text, WORDS.repay) || hindiGave;

  if (expense && !credit && !customer && !sale && !(purchase && product)) return { intent: 'EXPENSE' };
  if (repay && !sale && !purchase) return { intent: 'CUSTOMER_PAYMENT' };
  if (credit) return { intent: 'CUSTOMER_CREDIT' };
  if (sale) return { intent: 'SALE' };
  if (purchase) return { intent: 'PURCHASE' };
  if (product && (anyMoney || nums.quantities.length)) return { intent: 'UNKNOWN', reason: 'BUY_OR_SELL' };
  return { intent: 'UNKNOWN' };
}

const period = (text) => (has(text, WORDS.yesterday) ? 'yesterday' : has(text, WORDS.week) ? 'week' : has(text, WORDS.month) ? 'month' : 'today');
const payMethod = (text) => (has(text, WORDS.upi) ? 'UPI' : has(text, WORDS.card) ? 'CARD' : 'CASH');

/** transcript -> structured command (not yet executed). ctx = { products, customers, language } */
export function parseCommand(transcript, { products = [], customers = [], language = 'te-IN' } = {}) {
  const text = normalize(transcript);
  const nums = extractNumbers(text);
  const pm = matchProduct(text, products);
  const customer = matchCustomer(text, customers);
  const { intent, reason } = classify(text, nums, pm, customer);

  const data = {};
  if (pm) {
    data.product = pm.product.name;
    data.productLocal = pm.product.nameLocal || null;
    data.productId = pm.isNew ? null : String(pm.product._id);
    data.isNewProduct = pm.isNew;
    data.unit = pm.product.unit;
    if (pm.isNew) data.category = pm.product.category;
  }
  let q = nums.quantities[0];
  let amount = nums.amounts.length === 1 ? nums.amounts[0] : null;
  const warnings = [];
  if (nums.amounts.length > 1) warnings.push('MULTIPLE_AMOUNTS');
  // A single unlabeled number is the missing half of quantity/amount: never both.
  if (nums.bare.length === 1) {
    if (amount != null && !q) q = { value: nums.bare[0], unit: data.unit || null };
    else if (q && amount == null && !nums.unitPrices.length) amount = nums.bare[0];
    else if (!q && amount == null && !['PURCHASE', 'SALE'].includes(intent)) amount = nums.bare[0];
  }
  if (q) { data.quantity = q.value; data.spokenUnit = q.unit || data.unit || null; }
  if (amount != null) data.totalAmount = amount;
  if (nums.unitPrices.length) data.unitPrice = nums.unitPrices[0];

  if (['PURCHASE', 'SALE', 'EXPENSE', 'CUSTOMER_PAYMENT'].includes(intent)) data.paymentMethod = payMethod(text);
  if (intent === 'SALE' && has(text, WORDS.credit)) data.paymentMethod = 'CREDIT';
  if (intent === 'EXPENSE') {
    data.category = EXPENSE_CATEGORIES.find(([, forms]) => has(text, forms))?.[0] || 'Other';
    data.description = String(transcript).trim().slice(0, 120);
    delete data.product; delete data.productId; delete data.isNewProduct; delete data.unit; delete data.productLocal;
  }
  if (['CUSTOMER_CREDIT', 'CUSTOMER_PAYMENT', 'SALE'].includes(intent)) {
    if (customer) { data.customer = customer.name; data.customerLocal = customer.nameLocal || null; data.customerId = String(customer._id); }
    else if (intent !== 'SALE') {
      const name = guessName(text);
      if (name) { data.customer = name; data.customerId = null; data.isNewCustomer = true; }
    }
  }
  if (['PROFIT_QUERY', 'DAILY_REPORT'].includes(intent)) data.period = period(text);

  const cmd = validateCommand(intent, data, { products, customers, language });
  if (reason) {
    cmd.reason = reason;
    cmd.clarificationQuestion = msg(language, reason === 'VENDOR_OWES' ? 'vendorOwes' : 'buyOrSell');
  } else if (intent === 'UNKNOWN') cmd.clarificationQuestion = msg(language, 'unknown');
  cmd.warnings.push(...warnings);
  return cmd;
}

const CONVERT = { 'g>kg': 0.001, 'kg>g': 1000, 'dozen>piece': 12, 'piece>dozen': 1 / 12 };

/**
 * Re-checks a command against business rules. Runs on the parser output AND on user edits
 * before confirmation, so edited cards obey the same rules. Never invents values.
 */
export function validateCommand(intent, input, { products = [], customers = [], language = 'te-IN' } = {}) {
  const data = { ...input };
  const missing = [];
  const nm = (o) => (language === 'en-IN' ? o.name : o.nameLocal || o.name);
  const errors = [];
  const warnings = [];
  const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  ['quantity', 'totalAmount', 'unitPrice'].forEach((k) => { if (k in data) data[k] = num(data[k]); });

  const product = data.productId ? products.find((p) => String(p._id) === String(data.productId)) : null;
  if (data.productId && !product) errors.push(msg(language, 'productGone'));
  if (product) { data.product = product.name; data.productLocal = product.nameLocal || null; data.unit = product.unit; data.isNewProduct = false; }
  const customer = data.customerId ? customers.find((c) => String(c._id) === String(data.customerId)) : null;
  if (data.customerId && !customer) errors.push(msg(language, 'customerGone'));
  if (customer) { data.customer = customer.name; data.customerLocal = customer.nameLocal || null; data.isNewCustomer = false; }

  const needsGoods = intent === 'PURCHASE' || intent === 'SALE' || (intent === 'CUSTOMER_CREDIT' && (data.product || data.quantity));
  if (needsGoods) {
    if (!data.product) missing.push('product');
    if (!data.quantity) missing.push('quantity');
    if (data.quantity != null && data.quantity <= 0) errors.push(msg(language, 'badQuantity'));
    // Convert spoken unit to the product's stock unit (500 g of a kg item -> 0.5)
    if (data.quantity && data.spokenUnit && data.unit && data.spokenUnit !== data.unit) {
      const f = CONVERT[`${data.spokenUnit}>${data.unit}`];
      if (f) { data.quantity = round2(data.quantity * f); data.spokenUnit = data.unit; }
      else errors.push(msg(language, 'unitMismatch', { product: (language === 'en-IN' ? data.product : data.productLocal || data.product), unit: unitName(language, data.unit), spoken: unitName(language, data.spokenUnit) }));
    }
    if (!data.unit && data.spokenUnit) data.unit = data.spokenUnit;
    if (data.isNewProduct && intent !== 'PURCHASE' && data.product) errors.push(msg(language, 'unknownProduct', { product: (language === 'en-IN' ? data.product : data.productLocal || data.product) }));
    if (data.isNewProduct && intent === 'PURCHASE' && data.product) warnings.push('NEW_PRODUCT');
  }
  if (data.totalAmount == null && data.unitPrice && data.quantity) data.totalAmount = round2(data.unitPrice * data.quantity); // deterministic, from spoken unit price
  if (TXN_INTENTS.includes(intent)) {
    if (data.totalAmount == null) missing.push('totalAmount');
    else if (data.totalAmount <= 0) errors.push(msg(language, 'badAmount'));
    else data.totalAmount = round2(data.totalAmount);
  }
  if (data.totalAmount && data.quantity) data.unitPrice = round2(data.totalAmount / data.quantity);

  if (intent === 'SALE' || (intent === 'CUSTOMER_CREDIT' && product)) {
    if (product && data.quantity > product.quantity) {
      errors.push(msg(language, 'insufficientStock', { product: nm(product), stock: round2(product.quantity), unit: unitName(language, product.unit) }));
    }
  }
  if (intent === 'SALE' && data.paymentMethod === 'CREDIT' && !data.customer) missing.push('customer');
  if (intent === 'CUSTOMER_CREDIT' || intent === 'CUSTOMER_PAYMENT') {
    if (!data.customer) missing.push('customer');
    if (data.isNewCustomer && data.customer) warnings.push('NEW_CUSTOMER');
  }
  if (intent === 'CUSTOMER_PAYMENT') {
    if (data.isNewCustomer) errors.push(msg(language, 'paymentUnknownCustomer', { customer: data.customer }));
    if (customer && data.totalAmount > customer.outstandingBalance + 0.005) {
      errors.push(msg(language, 'overpayment', { customer: nm(customer), outstanding: round2(customer.outstandingBalance) }));
    }
  }
  if (intent === 'EXPENSE' && !data.category) data.category = 'Other';
  if (intent === 'CUSTOMER_CREDIT' && !data.product) warnings.push('RECEIVABLE_ONLY');

  const first = missing[0];
  return {
    intent,
    language,
    requiresConfirmation: TXN_INTENTS.includes(intent),
    data,
    missingFields: missing,
    errors,
    warnings,
    clarificationQuestion: errors[0] || (first ? msg(language, `ask_${first}`, { unit: unitName(language, data.unit || 'kg') }) : null),
  };
}
