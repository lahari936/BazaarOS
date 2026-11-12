const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const rs = (n, decimals = true) => (decimals ? inr : inr0).format(Number(n) || 0);
export const qty = (n) => String(Math.round((Number(n) || 0) * 100) / 100);
export const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
export const dayLabel = (iso) => new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
export const todayIST = () => new Date(Date.now() + 330 * 60e3).toISOString().slice(0, 10);

export const TYPE_LABEL = { PURCHASE: 'Purchase', SALE: 'Sale', EXPENSE: 'Expense', CREDIT: 'Credit given', PAYMENT_IN: 'Payment received' };
export const INTENT_LABEL = {
  PURCHASE: 'Purchase', SALE: 'Sale', EXPENSE: 'Expense', CUSTOMER_CREDIT: 'Customer credit', CUSTOMER_PAYMENT: 'Customer payment',
  INVENTORY_QUERY: 'Stock check', PROFIT_QUERY: 'Profit query', DAILY_REPORT: 'Daily report', UNKNOWN: 'Not understood',
};
export const LANGS = [
  { code: 'te-IN', label: 'తెలుగు', name: 'Telugu' },
  { code: 'hi-IN', label: 'हिंदी', name: 'Hindi' },
  { code: 'en-IN', label: 'English', name: 'English' },
];
export const UNITS = ['kg', 'g', 'dozen', 'piece', 'litre', 'bunch', 'packet'];
/** Money direction for a transaction row: + cash/receivable in, - money out. */
export const sign = (t) => (['SALE', 'PAYMENT_IN'].includes(t.type) ? '+' : t.type === 'CREDIT' ? '' : '−');
