import { useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { rs, dayLabel } from '../lib/format.js';
import { Card, ErrorBox, PageHeader, Spinner, cx, useFetch } from '../components/ui.jsx';

const PERIODS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', '7 days'], ['month', '30 days']];

const Line_ = ({ k, v, strong, minus, note }) => (
  <div className={cx('flex items-baseline justify-between gap-4 py-2.5', strong && 'font-bold')}>
    <div><div className="text-sm">{minus && <span className="text-muted">− </span>}{k}</div>{note && <div className="text-xs font-normal text-muted">{note}</div>}</div>
    <div className={cx('num', strong ? 'text-lg' : 'text-sm font-semibold', strong && v < 0 && 'text-danger')}>{rs(v)}</div>
  </div>
);

export default function Reports() {
  const [period, setPeriod] = useState('today');
  const [days, setDays] = useState(7);
  const p = useFetch(`/reports/profit?period=${period}`);
  const t = useFetch(`/reports/weekly?days=${days}`);
  const s = p.data;

  return (
    <div className="grid gap-5">
      <PageHeader title="Reports" subtitle="Profit uses weighted-average cost: stock you have not sold yet stays an asset." />
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(([k, l]) => <button key={k} onClick={() => setPeriod(k)} className={cx('min-h-10 rounded-xl px-4 text-sm font-semibold', period === k ? 'bg-primary text-white' : 'border border-line bg-surface')}>{l}</button>)}
      </div>
      {p.loading && !s ? <Spinner /> : p.error ? <ErrorBox error={p.error} onRetry={p.reload} /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-bold">Profit and loss</h2>
            <div className="mt-2 divide-y divide-line">
              <Line_ k="Sales revenue" v={s.revenue} note={s.creditSales ? `Includes ${rs(s.creditSales)} sold on credit` : null} />
              <Line_ k="Cost of goods sold" v={s.cogs} minus note="Units sold × average purchase cost" />
              <Line_ k="Gross profit" v={s.grossProfit} strong />
              <Line_ k="Operating expenses" v={s.expenses} minus />
              <Line_ k="Net profit" v={s.netProfit} strong />
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-bold">Cash and balances</h2>
            <div className="mt-2 divide-y divide-line">
              <Line_ k="Purchases" v={s.purchases} note="Money spent on stock (not an expense until sold)" />
              <Line_ k="Cash received" v={s.cashIn} note="Cash/UPI/card sales + customer repayments" />
              <Line_ k="Customer repayments" v={s.paymentsIn} />
              <Line_ k="Credit given (no goods)" v={s.creditGiven} />
              <Line_ k="Outstanding receivables (now)" v={s.receivables} strong />
              <Line_ k="Inventory value at cost (now)" v={s.inventoryValue} />
            </div>
          </Card>
        </div>
      )}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">Trend</h2>
          <div className="flex gap-2">{[7, 30].map((d) => <button key={d} onClick={() => setDays(d)} className={cx('min-h-9 rounded-lg px-3 text-sm font-semibold', days === d ? 'bg-primary text-white' : 'border border-line')}>{d === 7 ? 'Weekly' : 'Monthly'}</button>)}</div>
        </div>
        {t.loading && !t.data ? <Spinner /> : t.error ? <ErrorBox error={t.error} onRetry={t.reload} /> : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={t.data} margin={{ left: -10, right: 8 }}>
                <CartesianGrid stroke="#e5eadf" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(d) => dayLabel(d)} tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v, n) => [rs(v), n]} labelFormatter={dayLabel} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Sales" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Line dataKey="netProfit" name="Net profit" stroke="#14532d" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
