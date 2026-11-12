import { useState } from 'react';
import { Plus, Package, Pencil, Trash2, Search } from 'lucide-react';
import { api, errMsg } from '../lib/api.js';
import { rs, qty, UNITS } from '../lib/format.js';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, useFetch } from '../components/ui.jsx';

const blank = { name: '', nameLocal: '', category: 'Vegetables', unit: 'kg', quantity: '', averagePurchasePrice: '', sellingPrice: '', lowStockThreshold: 5 };

export default function Inventory() {
  const { data, loading, error, reload } = useFetch('/products');
  const [edit, setEdit] = useState(null); // product or blank
  const [del, setDel] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setFormErr(null);
    const isNew = !edit._id;
    const body = { name: edit.name, nameLocal: edit.nameLocal || undefined, category: edit.category, sellingPrice: Number(edit.sellingPrice) || 0, lowStockThreshold: Number(edit.lowStockThreshold) || 0 };
    if (isNew) Object.assign(body, { unit: edit.unit, quantity: Number(edit.quantity) || 0, averagePurchasePrice: Number(edit.averagePurchasePrice) || 0 });
    try {
      await (isNew ? api.post('/products', body) : api.put(`/products/${edit._id}`, body));
      setEdit(null); reload();
    } catch (err) { setFormErr(errMsg(err)); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.delete(`/products/${del._id}`); setDel(null); reload(); } catch (err) { setFormErr(errMsg(err)); } finally { setBusy(false); }
  };
  const list = (data || []).filter((p) => !q || `${p.name} ${p.nameLocal || ''} ${p.category}`.toLowerCase().includes(q.toLowerCase()));
  const value = (data || []).reduce((a, p) => a + p.quantity * p.averagePurchasePrice, 0);

  return (
    <div>
      <PageHeader title="Inventory" subtitle={data ? `${data.length} products · stock value ${rs(value, false)} at cost` : ''} action={<Button onClick={() => { setFormErr(null); setEdit(blank); }}><Plus className="size-4" />Add product</Button>} />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="pl-9" />
      </div>
      {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : !list.length ? (
        <Card><Empty icon={Package} title={q ? 'No match' : 'No products yet'}>{q ? 'Try another name.' : 'Add products here, or just speak a purchase: new products are created automatically after you confirm.'}</Empty></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const low = p.quantity <= p.lowStockThreshold;
            const margin = p.sellingPrice && p.averagePurchasePrice ? p.sellingPrice - p.averagePurchasePrice : null;
            return (
              <Card key={p._id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-bold">{p.name}</div>
                    <div className="truncate text-sm text-muted">{p.nameLocal || p.category}</div>
                  </div>
                  {p.quantity <= 0 ? <Badge tone="red">Out of stock</Badge> : low ? <Badge tone="amber">Low stock</Badge> : <Badge tone="green">In stock</Badge>}
                </div>
                <div className="num mt-3 text-3xl font-extrabold">{qty(p.quantity)} <span className="text-base font-semibold text-muted">{p.unit}</span></div>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-bg p-2.5 text-xs">
                  <div><div className="text-muted">Avg cost</div><div className="num font-semibold">{rs(p.averagePurchasePrice)}</div></div>
                  <div><div className="text-muted">Sells at</div><div className="num font-semibold">{p.sellingPrice ? rs(p.sellingPrice) : '—'}</div></div>
                  <div><div className="text-muted">Margin</div><div className="num font-semibold">{margin != null ? rs(margin) : '—'}</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>Alert below {p.lowStockThreshold} {p.unit}</span>
                  <span className="flex gap-1">
                    <button onClick={() => { setFormErr(null); setEdit(p); }} className="rounded-lg p-2 hover:bg-bg" aria-label={`Edit ${p.name}`}><Pencil className="size-4" /></button>
                    <button onClick={() => { setFormErr(null); setDel(p); }} className="rounded-lg p-2 text-danger hover:bg-red-50" aria-label={`Delete ${p.name}`}><Trash2 className="size-4" /></button>
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!edit} title={edit?._id ? `Edit ${edit.name}` : 'Add product'} onClose={() => setEdit(null)}>
        {edit && (
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label="Name (English)"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></Field>
            <Field label="Local name" hint="Telugu / Hindi, used for voice"><Input value={edit.nameLocal || ''} onChange={(e) => setEdit({ ...edit, nameLocal: e.target.value })} placeholder="టమాటాలు" /></Field>
            <Field label="Category"><Input value={edit.category || ''} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></Field>
            <Field label="Unit" hint={edit._id && 'Fixed after creation'}>
              <Select value={edit.unit} disabled={!!edit._id} onChange={(e) => setEdit({ ...edit, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select>
            </Field>
            {!edit._id && <>
              <Field label="Opening stock" hint="Later changes come from purchases and sales"><Input type="number" min="0" step="any" value={edit.quantity} onChange={(e) => setEdit({ ...edit, quantity: e.target.value })} /></Field>
              <Field label="Cost per unit (₹)"><Input type="number" min="0" step="any" value={edit.averagePurchasePrice} onChange={(e) => setEdit({ ...edit, averagePurchasePrice: e.target.value })} /></Field>
            </>}
            <Field label="Selling price per unit (₹)"><Input type="number" min="0" step="any" value={edit.sellingPrice} onChange={(e) => setEdit({ ...edit, sellingPrice: e.target.value })} /></Field>
            <Field label="Low-stock alert at"><Input type="number" min="0" step="any" value={edit.lowStockThreshold} onChange={(e) => setEdit({ ...edit, lowStockThreshold: e.target.value })} /></Field>
            <div className="sm:col-span-2"><ErrorBox error={formErr} /></div>
            <Button type="submit" loading={busy} className="sm:col-span-2">Save</Button>
          </form>
        )}
      </Modal>
      <Modal open={!!del} title="Delete product?" onClose={() => setDel(null)}>
        <p className="text-sm text-muted">Delete <b className="text-ink">{del?.name}</b> ({qty(del?.quantity)} {del?.unit} in stock)? Past transactions keep their record. This cannot be undone.</p>
        <ErrorBox error={formErr} />
        <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setDel(null)}>Keep</Button><Button variant="danger" loading={busy} onClick={remove}>Delete</Button></div>
      </Modal>
    </div>
  );
}
