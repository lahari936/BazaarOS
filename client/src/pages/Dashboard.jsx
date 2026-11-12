import { Link } from 'react-router-dom';
import { Mic, TrendingUp, ShoppingCart, PiggyBank, Wallet, BookUser, Package, AlertTriangle, ArrowRight, Info } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { rs, qty, dayLabel } from '../lib/format.js';
import { Card, ErrorBox, Spinner, Empty, Badge, cx, useFetch } from '../components/ui.jsx';
import TxnRow from '../components/TxnRow.jsx';

const SEV = { danger: 'border-red-200 bg-red-50 text-red-800', warning: 'border-amber-200 bg-amber-50 text-amber-900', info: 'border-line bg-bg text-ink' };

export function Stat({ label, value, icon: Icon, tone = 'text-primary bg-mint', note, negative }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        {Icon && <div className={cx('rounded-lg p-1.5', tone)}><Icon className="size-4" /></div>}
      </div>
      <div className={cx('num mt-2 text-2xl font-extrabold tracking-tight', negative && 'text-danger')}>{value}</div>
      {note && <div className="mt-0.5 text-xs text-muted">{note}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const { business, user } = useAuth();
  const { data, loading, error, reload } = useFetch('/dashboard');
  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  const { today, receivables, inventory, recent, week, alerts } = data;
  const max = Math.max(1, ...week.map((d) => d.revenue));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Namaskaram, {user?.name?.split(' ')[0]}</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{business.shopName}</h1>
        </div>
      </div>

      <Link to="/app/voice" className="group flex items-center gap-4 rounded-3xl bg-primary p-5 text-white shadow-lg transition hover:bg-primary-dark">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white/15 ring-8 ring-white/5"><Mic className="size-8" /></span>
        <span className="flex-1">
          <span className="block text-lg font-bold">Tap and speak</span>
          <span className="block text-sm text-green-100/90">“5 కిలోల టమాటాలు 150 రూపాయలకు అమ్మాను”</span>
        </span>
        <ArrowRight className="size-5 opacity-70 transition group-hover:translate-x-1" />
      </Link>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today's sales" value={rs(today.revenue, false)} icon={TrendingUp} note={today.creditSales ? `${rs(today.creditSales, false)} on credit` : `${today.transactions} entries`} />
        <Stat label="Today's purchases" value={rs(today.purchases, false)} icon={ShoppingCart} tone="text-sky-700 bg-sky-100" note="Added to stock, not a loss" />
        <Stat label="Gross profit" value={rs(today.grossProfit, false)} icon={PiggyBank} negative={today.grossProfit < 0} note={`Sales − cost of goods (${rs(today.cogs, false)})`} />
        <Stat label="Net profit" value={rs(today.netProfit, false)} icon={Wallet} negative={today.netProfit < 0} note={`After ${rs(today.expenses, false)} expenses`} />
        <Stat label="Customers owe you" value={rs(receivables.total, false)} icon={BookUser} tone="text-violet-700 bg-violet-100" note={`${receivables.debtors} customer${receivables.debtors === 1 ? '' : 's'}`} />
        <Stat label="Cash received" value={rs(today.cashIn, false)} icon={Wallet} note="Cash + UPI sales and repayments" />
        <Stat label="Products" value={inventory.totalProducts} icon={Package} note={`Stock value ${rs(inventory.value, false)}`} />
        <Stat label="Low stock" value={inventory.lowStock.length} icon={AlertTriangle} tone={inventory.lowStock.length ? 'text-amber-700 bg-amber-100' : 'text-primary bg-mint'} note={inventory.lowStock.map((p) => p.name).join(', ') || 'All stocked'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-bold">Recent activity</h2>
            <Link to="/app/transactions" className="text-sm font-semibold text-primary">View all</Link>
          </div>
          {recent.length ? <div className="divide-y divide-line">{recent.map((t) => <TxnRow key={t._id} t={t} />)}</div> : <Empty icon={Mic} title="No entries yet">Speak your first purchase to get started.</Empty>}
        </Card>

        <div className="grid content-start gap-5 lg:col-span-2">
          <Card className="p-4">
            <div className="flex items-center justify-between"><h2 className="font-bold">Last 7 days</h2><Link to="/app/reports" className="text-sm font-semibold text-primary">Reports</Link></div>
            <div className="mt-4 flex h-32 items-end gap-2" role="img" aria-label="Daily sales for the last 7 days">
              {week.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${dayLabel(d.day)}: sales ${rs(d.revenue, false)}, net ${rs(d.netProfit, false)}`}>
                  <div className="flex w-full flex-1 items-end"><div className="w-full rounded-t-md bg-secondary/80" style={{ height: `${(d.revenue / max) * 100}%`, minHeight: d.revenue ? 4 : 2 }} /></div>
                  <div className="text-[10px] text-muted">{dayLabel(d.day).split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="font-bold">Alerts</h2>
            <div className="mt-3 grid gap-2">
              {alerts.length ? alerts.map((a, i) => (
                <div key={i} className={cx('rounded-xl border px-3 py-2.5 text-sm', SEV[a.severity])}>
                  <div className="flex items-center gap-2 font-semibold">{a.severity === 'info' ? <Info className="size-4" /> : <AlertTriangle className="size-4" />}{a.title}</div>
                  <div className="mt-0.5 text-xs opacity-80">{a.detail}</div>
                </div>
              )) : <p className="text-sm text-muted">Nothing needs attention.</p>}
            </div>
          </Card>
          {inventory.lowStock.length > 0 && (
            <Card className="p-4">
              <h2 className="font-bold">Restock soon</h2>
              <div className="mt-2 flex flex-wrap gap-2">{inventory.lowStock.map((p) => <Badge key={p._id} tone={p.quantity <= 0 ? 'red' : 'amber'}>{p.name}: {qty(p.quantity)} {p.unit}</Badge>)}</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
