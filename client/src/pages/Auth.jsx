import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Logo } from '../components/Layout.jsx';
import { Button, Card, ErrorBox, Field, Input } from '../components/ui.jsx';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { user, business, signIn } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const [form, setForm] = useState({ name: '', email: demo ? 'demo@bazaaros.test' : '', password: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (user) return <Navigate to={business ? '/app' : '/onboarding'} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const body = isLogin ? { email: form.email, password: form.password } : { ...form, phone: form.phone || undefined };
      const { data } = await api.post(`/auth/${isLogin ? 'login' : 'register'}`, body);
      signIn(data);
      nav(data.business ? '/app' : '/onboarding', { replace: true });
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-6"><Logo /></Link>
      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-muted">{isLogin ? 'Sign in to your shop.' : 'Takes a minute. Your shop comes next.'}</p>
        {demo && <p className="mt-3 rounded-xl bg-mint px-3 py-2 text-sm text-primary">Demo shop: <b>Sri Lakshmi Vegetables</b>. The demo password is in the project README.</p>}
        <form onSubmit={submit} className="mt-6 grid gap-4">
          {!isLogin && <Field label="Your name"><Input value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" /></Field>}
          <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></Field>
          {!isLogin && <Field label="Phone (optional)"><Input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></Field>}
          <Field label="Password" hint={!isLogin && 'At least 8 characters'}><Input type="password" value={form.password} onChange={set('password')} required minLength={isLogin ? 1 : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} /></Field>
          <ErrorBox error={error} />
          <Button type="submit" loading={busy} className="min-h-12">{isLogin ? 'Sign in' : 'Create account'}</Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted">
          {isLogin ? <>New here? <Link to="/register" className="font-semibold text-primary">Create an account</Link></> : <>Have an account? <Link to="/login" className="font-semibold text-primary">Sign in</Link></>}
        </p>
      </Card>
    </div>
  );
}
