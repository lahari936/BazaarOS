import { useState } from 'react';
import { Cpu, LogOut } from 'lucide-react';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { LANGS } from '../lib/format.js';
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select } from '../components/ui.jsx';

export default function Settings() {
  const { business, user, setBusiness, signOut } = useAuth();
  const [f, setF] = useState({ shopName: business.shopName, preferredLanguage: business.preferredLanguage, location: business.location || '', businessType: business.businessType || '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null); setMsg(null);
    try { const { data } = await api.put('/business', f); setBusiness(data); setMsg('Saved'); }
    catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  };
  return (
    <div className="grid max-w-2xl gap-5">
      <PageHeader title="Settings" />
      <Card className="p-5">
        <h2 className="font-bold">Shop</h2>
        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Shop name"><Input value={f.shopName} onChange={(e) => setF({ ...f, shopName: e.target.value })} required /></Field>
          <Field label="Voice language"><Select value={f.preferredLanguage} onChange={(e) => setF({ ...f, preferredLanguage: e.target.value })}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.name})</option>)}</Select></Field>
          <Field label="Business type"><Input value={f.businessType} onChange={(e) => setF({ ...f, businessType: e.target.value })} /></Field>
          <Field label="Location"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
          <div className="sm:col-span-2"><ErrorBox error={err} /></div>
          <div className="flex items-center gap-3 sm:col-span-2"><Button type="submit" loading={busy}>Save changes</Button>{msg && <span className="text-sm font-semibold text-secondary">{msg}</span>}</div>
        </form>
      </Card>
      <Card className="p-5">
        <h2 className="font-bold">Account</h2>
        <p className="mt-2 text-sm text-muted">{user.name} · {user.email}</p>
        <Button variant="outline" onClick={signOut} className="mt-3 text-danger"><LogOut className="size-4" />Sign out</Button>
      </Card>
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-bold"><Cpu className="size-4" />AI models in use</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          <li><b>Gnani Prisma v2.5</b>: speech to text (Telugu, Hindi, English), called from the server.</li>
          <li><b>Gnani Timbre v2.5</b>: spoken replies (voices Lavanya, Nalini and Kaveri).</li>
          <li><b>Intent engine</b>: deterministic rules on the server. It proposes an entry; nothing is saved until you confirm.</li>
        </ul>
      </Card>
    </div>
  );
}
