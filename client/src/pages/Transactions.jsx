import { useMemo, useState } from 'react';
import { Plus, ReceiptText, Mic } from 'lucide-react';
import { api, errMsg, newKey } from '../lib/api.js';
import { rs, qty, when, TYPE_LABEL } from '../lib/format.js';
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Badge, useFetch } from '../components/ui.jsx';
import TxnRow from '../components/TxnRow.jsx';

export default function Transactions() {
  const [f, setF] = useState({ type: '', source: '', from: '', to: '', page: 1 });
  const url = useMemo(() => `/transactions?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`, [f]);
  const { data, loading, error, reload } = useFetch(url);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, page: 1 });

  return (
    <div>
      <PageHeader title="Transactions" subtitle={data ? `${data.total} entries` : ''} action={<Button onClick={() => setForm({ type: 'SALE' })}><Plus className="size-4" />New entry</Button>} />
      <Card className="mb-4 grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
        <Field label="Type"><Select value={f.type} onChange={set('type')}><option value="">All</option>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Source"><Select value={f.source} onChange={set('source')}><option value="">All</option><option value="VOICE">Voice</option><option value="MANUAL">Manual</option><option value="SEED">Demo data</option></Select></Field>
        <Field label="From"><Input type="date" value={f.from} onChange={set('from')} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={set('to')} /></Field>
      </Card>
      <Card>
        {loading && !data ? <Spinner /> : error ? <div className="p-4"><ErrorBox error={error} onRetry={reload} /></div> : !data.items.length ? (
          <Empty icon={ReceiptText} title="No transactions">Change the filters, or record one by voice.</Empty>
        ) : (
          <>
            <div className="divide-y divide-line">{data.items.map((t) => <TxnRow key={t._id} t={t} onClick={() => setDetail(t._id)} />)}</div>
            {data.pages > 1 && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
                <Button variant="outline" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>Previous</Button>
                <span className="text-muted">Page {data.page} of {data.pages}</span>
                <Button variant="outline" disabled={f.page >= data.pages} onClick={() => setF({ ...f, page: f.page + 1 })}>Next</Button>
              </div>
            )}
          </>
        )}
      </Card>
      {detail && <Detail id={detail} onClose={() => setDetail(null)} />}
      {form && <EntryForm initial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
    </div>
  );
}

const R = ({ k, v }) => (v == null || v === '' ? null : <div className="flex justify-between gap-4 py-2 text-sm"><span className="text-muted">{k}</span><span className="num text-right font-semibold">{v}</span></div>);

function Detail({ id, onClose }) {
  const { data, loading, error } = useFetch(`/transactions/${id}`);
  return (
    <Modal open title="Transaction" onClose={onClose}>
      {loading ? <Spinner /> : error ? <ErrorBox error={error} /> : (
        <div className="divide-y divide-line">
          <R k="Type" v={TYPE_LABEL[data.type]} />
          <R k="When" v={when(data.createdAt)} />
          <R k="Amount" v={rs(data.amount)} />
          {data.items.map((i) => <R key={i.name} k={i.name} v={`${qty(i.quantity)} ${i.unit} × ${rs(i.unitPrice)}`} />)}
          {data.type === 'SALE' && <R k="Cost of goods (avg cost)" v={rs(data.cogs)} />}
          {data.type === 'SALE' && <R k="Gross profit" v={rs(data.amount - data.cogs)} />}
          <R k="Category" v={data.category} />
          <R k="Customer" v={data.customerId?.name} />
          <R k="Payment" v={`${data.paymentMethod}${data.paymentStatus === 'UNPAID' ? ' · unpaid (receivable)' : ''}`} />
          <R k="Source" v={data.source === 'VOICE' ? <Badge tone="green"><Mic className="size-3" />Voice</Badge> : data.source} />
          {data.transcript && <div className="py-2 text-sm"><div className="text-muted">Transcript</div><div className="mt-1 font-medium">“{data.transcript}”</div></div>}
          {data.voiceLogId?.gnaniModels && <R k="Gnani models" v={data.voiceLogId.gnaniModels.join(', ')} />}
          <R k="Note" v={data.note} />
        </div>
      )}
    </Modal>
  );
}

export function EntryForm({ initial, onClose, onSaved }) {
  const products = useFetch('/products');
  const customers = useFetch('/customers');
  const [d, setD] = useState({ paymentMethod: 'CASH', category: 'Transport', ...initial });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [key] = useState(newKey); // same key on retry = no duplicate entry
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const product = products.data?.find((p) => p._id === d.productId);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const body = { type: d.type, totalAmount: Number(d.totalAmount), paymentMethod: d.paymentMethod };
    if (d.type !== 'EXPENSE') {
      Object.assign(body, { quantity: Number(d.quantity) });
      if (d.productId === '__new') Object.assign(body, { product: d.newName, unit: d.unit || 'kg' });
      else body.productId = d.productId;
    } else Object.assign(body, { category: d.category, description: d.description || undefined });
    if (d.type === 'SALE' && d.paymentMethod === 'CREDIT') body.customerId = d.customerId;
    try { await api.post('/transactions', body, { headers: { 'Idempotency-Key': key } }); onSaved(); }
    catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  };
  return (
    <Modal open title="New entry" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          {['PURCHASE', 'SALE', 'EXPENSE'].map((t) => <Button key={t} type="button" variant={d.type === t ? 'primary' : 'outline'} onClick={() => setD({ ...d, type: t, paymentMethod: 'CASH' })}>{TYPE_LABEL[t]}</Button>)}
        </div>
        {d.type !== 'EXPENSE' ? (
          <>
            <Field label="Product">
              <Select value={d.productId || ''} onChange={set('productId')} required>
                <option value="">Choose…</option>
                {products.data?.map((p) => <option key={p._id} value={p._id}>{p.name} · {qty(p.quantity)} {p.unit} in stock</option>)}
                {d.type === 'PURCHASE' && <option value="__new">+ New product</option>}
              </Select>
            </Field>
            {d.productId === '__new' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Product name"><Input value={d.newName || ''} onChange={set('newName')} required /></Field>
                <Field label="Unit"><Select value={d.unit || 'kg'} onChange={set('unit')}>{['kg', 'g', 'dozen', 'piece', 'litre', 'bunch', 'packet'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Quantity${product ? ` (${product.unit})` : ''}`}><Input type="number" min="0" step="any" value={d.quantity || ''} onChange={set('quantity')} required /></Field>
              <Field label="Total amount (₹)"><Input type="number" min="0" step="any" value={d.totalAmount || ''} onChange={set('totalAmount')} required /></Field>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Select value={d.category} onChange={set('category')}>{['Transport', 'Rent', 'Electricity', 'Wages', 'Other'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Amount (₹)"><Input type="number" min="0" step="any" value={d.totalAmount || ''} onChange={set('totalAmount')} required /></Field>
            <div className="col-span-2"><Field label="Note"><Input value={d.description || ''} onChange={set('description')} /></Field></div>
          </div>
        )}
        <Field label="Payment">
          <Select value={d.paymentMethod} onChange={set('paymentMethod')}>
            {['CASH', 'UPI', 'CARD', ...(d.type === 'SALE' ? ['CREDIT'] : [])].map((m) => <option key={m} value={m}>{m === 'CREDIT' ? 'Credit (customer pays later)' : m}</option>)}
          </Select>
        </Field>
        {d.type === 'SALE' && d.paymentMethod === 'CREDIT' && (
          <Field label="Customer" hint="Credit sales count as revenue but not as cash received.">
            <Select value={d.customerId || ''} onChange={set('customerId')} required>
              <option value="">Choose…</option>{customers.data?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <ErrorBox error={err} />
        <Button type="submit" loading={busy}>Save entry</Button>
      </form>
    </Modal>
  );
}
