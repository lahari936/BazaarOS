import { ShoppingCart, TrendingUp, Wallet, HandCoins, BookUser, Mic } from 'lucide-react';
import { rs, qty, when, TYPE_LABEL, sign } from '../lib/format.js';
import { Badge, cx } from './ui.jsx';

const ICON = { PURCHASE: ShoppingCart, SALE: TrendingUp, EXPENSE: Wallet, CREDIT: BookUser, PAYMENT_IN: HandCoins };
const TONE = { PURCHASE: 'bg-sky-100 text-sky-700', SALE: 'bg-mint text-primary', EXPENSE: 'bg-amber-100 text-amber-700', CREDIT: 'bg-violet-100 text-violet-700', PAYMENT_IN: 'bg-mint text-primary' };

export function describe(t) {
  const item = t.items?.[0];
  if (item) return `${item.name} · ${qty(item.quantity)} ${item.unit}`;
  if (t.type === 'EXPENSE') return t.category || 'Expense';
  return t.customerId?.name || TYPE_LABEL[t.type];
}

export default function TxnRow({ t, onClick }) {
  const Icon = ICON[t.type] || Wallet;
  const credit = t.paymentMethod === 'CREDIT';
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg">
      <div className={cx('grid size-10 shrink-0 place-items-center rounded-xl', TONE[t.type])}><Icon className="size-[18px]" /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{describe(t)}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>{TYPE_LABEL[t.type]}</span>·<span>{when(t.createdAt)}</span>
          {t.customerId?.name && t.items?.length > 0 && <>·<span>{t.customerId.name}</span></>}
          {t.source === 'VOICE' && <Badge tone="green" className="py-0"><Mic className="size-3" />Voice</Badge>}
          {credit && <Badge tone="amber" className="py-0">Unpaid</Badge>}
        </div>
      </div>
      <div className={cx('num text-sm font-bold', ['SALE', 'PAYMENT_IN'].includes(t.type) ? 'text-secondary' : 'text-ink')}>{sign(t)}{rs(t.amount)}</div>
    </button>
  );
}
