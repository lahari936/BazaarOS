import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { LANGS } from '../lib/format.js';
import { Button, Card, ErrorBox, Field, Input, Select, cx } from '../components/ui.jsx';

export default function Onboarding() {
  const { business, setBusiness } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ shopName: '', businessType: 'vegetables', preferredLanguage: 'te-IN', location: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (business) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { data } = await api.post('/business', { ...form, location: form.location || undefined });
      setBusiness(data);
      nav('/app/inventory', { replace: true });
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg p-6 sm:p-8">
        <div className="inline-flex rounded-2xl bg-mint p-3 text-primary"><Store className="size-6" /></div>
        <h1 className="mt-4 text-2xl font-extrabold">Set up your shop</h1>
        <p className="mt-1 text-sm text-muted">You can change any of this later in Settings.</p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <Field label="Shop name"><Input value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} required minLength={2} placeholder="e.g. Sri Lakshmi Vegetables" /></Field>
          <Field label="What do you sell?">
            <Select value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>
              <option value="vegetables">Vegetables</option><option value="fruits">Fruits</option><option value="kirana">Kirana / general store</option><option value="other">Other</option>
            </Select>
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-medium">Language you will speak</span>
            <div className="grid grid-cols-3 gap-2">
              {LANGS.map((l) => (
                <button type="button" key={l.code} onClick={() => setForm({ ...form, preferredLanguage: l.code })} className={cx('min-h-12 rounded-xl border text-sm font-semibold', form.preferredLanguage === l.code ? 'border-primary bg-primary text-white' : 'border-line bg-surface')}>{l.label}</button>
              ))}
            </div>
          </div>
          <Field label="Location (optional)"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Market, city" /></Field>
          <ErrorBox error={error} />
          <Button type="submit" loading={busy} className="min-h-12">Create shop</Button>
        </form>
      </Card>
    </div>
  );
}
