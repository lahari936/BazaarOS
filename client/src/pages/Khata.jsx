import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, BookUser, ArrowLeft, Phone, HandCoins, NotebookPen } from 'lucide-react';
import { api, errMsg, newKey } from '../lib/api.js';
import { rs } from '../lib/format.js';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, cx, useFetch } from '../components/ui.jsx';
import TxnRow from '../components/TxnRow.jsx';

export default function Khata() {
  const { id } = useParams();
  return id ? <Ledger id={id} /> : <List />;
}

function List() {
  const { data, loading, error, reload } = useFetch('/customers');
  const [add, setAdd] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const total = (data || []).reduce((a, c) => a + c.outstandingBalance, 0);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.post('/customers', { name: add.name, nameLocal: add.nameLocal || undefined, phone: add.phone || undefined }); setAdd(null); reload(); }
    catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  };
  return (
    <div>
      <PageHeader title="Customer Khata" subtitle={data ? `${data.length} customers · ${rs(total, false)} to collect` : ''} action={<Button onClick={() => setAdd({ name: '', nameLocal: '', phone: '' })}><Plus className="size-4" />Add customer</Button>} />
      {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : !data.length ? (
        <Card><Empty icon={BookUser} title="No customers yet">Add one, or say “రవి 200 రూపాయలు అప్పుగా తీసుకున్నాడు” in the Voice Assistant.</Empty></Card>
      ) : (
        <Card className="divide-y divide-line">
          {data.map((c) => (
            <button key={c._id} onClick={() => nav(`/app/khata/${c._id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-mint font-bold text-primary">{(c.nameLocal || c.name)[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{c.name}{c.nameLocal && <span className="font-normal text-muted"> · {c.nameLocal}</span>}</div>
                <div className="text-xs text-muted">Credit {rs(c.totalCredit, false)} · Paid {rs(c.totalPaid, false)}</div>
              </div>
              <div className="text-right">
                <div className={cx('num font-bold', c.outstandingBalance > 0 ? 'text-danger' : 'text-secondary')}>{rs(c.outstandingBalance, false)}</div>
                <div className="text-[11px] text-muted">{c.outstandingBalance > 0 ? 'owes you' : 'settled'}</div>
              </div>
            </button>
          ))}
        </Card>
      )}
      <Modal open={!!add} title="Add customer" onClose={() => setAdd(null)}>
        {add && (
          <form onSubmit={save} className="grid gap-3">
            <Field label="Name"><Input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} required /></Field>
            <Field label="Name in Telugu / Hindi" hint="Helps voice matching, e.g. రవి"><Input value={add.nameLocal} onChange={(e) => setAdd({ ...add, nameLocal: e.target.value })} /></Field>
            <Field label="Phone (optional)"><Input type="tel" value={add.phone} onChange={(e) => setAdd({ ...add, phone: e.target.value })} /></Field>
            <ErrorBox error={err} />
            <Button type="submit" loading={busy}>Add</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

function Ledger({ id }) {
  const { data, loading, error, reload } = useFetch(`/customers/${id}`);
  const [action, setAction] = useState(null); // 'payment' | 'credit'
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { customer: c, ledger } = data;
  return (
    <div>
      <Link to="/app/khata" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft className="size-4" />All customers</Link>
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">{c.name} {c.nameLocal && <span className="text-lg font-semibold text-muted">{c.nameLocal}</span>}</h1>
            {c.phone && <a href={`tel:${c.phone}`} className="mt-1 inline-flex items-center gap-1 text-sm text-primary"><Phone className="size-3.5" />{c.phone}</a>}
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase text-muted">Outstanding</div>
            <div className={cx('num text-3xl font-extrabold', c.outstandingBalance > 0 ? 'text-danger' : 'text-secondary')}>{rs(c.outstandingBalance)}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-bg p-3"><div className="text-muted">Total credit</div><div className="num font-bold">{rs(c.totalCredit)}</div></div>
          <div className="rounded-xl bg-bg p-3"><div className="text-muted">Total paid</div><div className="num font-bold">{rs(c.totalPaid)}</div></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => setAction('payment')} disabled={c.outstandingBalance <= 0}><HandCoins className="size-4" />Record payment</Button>
          <Button variant="outline" onClick={() => setAction('credit')}><NotebookPen className="size-4" />Add credit</Button>
        </div>
      </Card>
      <Card>
        <div className="border-b border-line px-4 py-3 font-bold">Ledger</div>
        {ledger.length ? <div className="divide-y divide-line">{ledger.map((t) => <TxnRow key={t._id} t={t} />)}</div> : <Empty title="No entries yet" />}
      </Card>
      {action && <MoneyForm kind={action} customer={c} onClose={() => setAction(null)} onSaved={() => { setAction(null); reload(); }} />}
    </div>
  );
}

function MoneyForm({ kind, customer, onClose, onSaved }) {
  const pay = kind === 'payment';
  const [d, setD] = useState({ amount: pay ? customer.outstandingBalance : '', paymentMethod: 'CASH', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [key] = useState(newKey);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api.post(`/customers/${customer._id}/${kind}`, { amount: Number(d.amount), paymentMethod: pay ? d.paymentMethod : undefined, note: d.note || undefined }, { headers: { 'Idempotency-Key': key } });
      onSaved();
    } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  };
  return (
    <Modal open title={pay ? `Payment from ${customer.name}` : `Credit to ${customer.name}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <Field label="Amount (₹)" hint={pay ? `Outstanding ${rs(customer.outstandingBalance)}` : 'Money owed without a product. For goods on credit, record a credit sale instead.'}>
          <Input type="number" min="0.01" step="any" max={pay ? customer.outstandingBalance : undefined} value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} required />
        </Field>
        {pay ? (
          <Field label="Paid by"><Select value={d.paymentMethod} onChange={(e) => setD({ ...d, paymentMethod: e.target.value })}>{['CASH', 'UPI', 'CARD'].map((m) => <option key={m}>{m}</option>)}</Select></Field>
        ) : <Field label="Note (optional)"><Input value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} /></Field>}
        <ErrorBox error={err} />
        <Button type="submit" loading={busy}>{pay ? 'Record payment' : 'Add credit'}</Button>
        {!pay && <Badge tone="amber" className="justify-center py-1">Counts as a receivable, not as sales revenue</Badge>}
      </form>
    </Modal>
  );
}
