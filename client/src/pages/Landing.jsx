import { Link, Navigate } from 'react-router-dom';
import { Mic, Package, BookUser, BarChart3, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Logo } from '../components/Layout.jsx';

const STEPS = [
  { say: 'ఈరోజు 20 కిలోల టమాటాలు 400 రూపాయలకు కొన్నాను', means: 'Purchase · Tomatoes · 20 kg · ₹400 (₹20/kg)', icon: Package },
  { say: 'रवि ने 200 रुपये उधार लिए', means: 'Customer credit · Ravi · ₹200 receivable', icon: BookUser },
  { say: 'How much profit did I make today?', means: 'Profit report, spoken back in your language', icon: BarChart3 },
];

export default function Landing() {
  const { user, business, loading } = useAuth();
  if (!loading && user) return <Navigate to={business ? '/app' : '/onboarding'} replace />;
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex gap-2">
          <Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-black/5">Sign in</Link>
          <Link to="/register" className="hidden rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white sm:block">Get started</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-2 lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-primary">
            <Mic className="size-3.5" />Telugu · Hindi · English · code-mixed
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Run your shop by <span className="text-secondary">speaking</span>, not typing.
          </h1>
          <p className="mt-4 max-w-lg text-lg text-muted">
            Bazaar OS turns what vendors already say out loud into a stock register, a sales ledger, a customer khata and a daily profit report.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/register" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-white hover:bg-primary-dark">Create your shop <ArrowRight className="size-4" /></Link>
            <Link to="/login?demo=1" className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 font-semibold hover:bg-bg">Try the demo shop</Link>
          </div>
          <ul className="mt-8 grid gap-2 text-sm text-ink/80">
            {['Speech recognised by Gnani Prisma, replies spoken by Gnani Timbre', 'Nothing is saved until you confirm it', 'Weighted-average costing, so profit counts unsold stock as stock'].map((t) => (
              <li key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-secondary" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl bg-primary p-5 text-white shadow-xl sm:p-7">
          <div className="text-sm font-semibold text-green-200">Say it the way you say it</div>
          <div className="mt-4 grid gap-3">
            {STEPS.map(({ say, means, icon: Icon }) => (
              <div key={say} className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-white/15 p-2"><Mic className="size-4" /></div>
                  <div className="text-[15px] font-semibold leading-snug">“{say}”</div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-primary">
                  <Icon className="size-4 shrink-0" />{means}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {[
            [Mic, 'Voice first', 'Hold the mic, speak a sale, purchase, expense or credit. Review the card. Confirm.'],
            [Package, 'Live inventory', 'Stock goes up on purchase and down on sale, at weighted-average cost.'],
            [BookUser, 'Customer khata', 'Credit sales become receivables, not cash. Payments reduce the balance.'],
            [ShieldCheck, 'Safe by design', 'AI proposes, rules validate, you confirm. No double entries from repeat taps.'],
          ].map(([Icon, t, d]) => (
            <div key={t}>
              <div className="inline-flex rounded-xl bg-mint p-2.5 text-primary"><Icon className="size-5" /></div>
              <div className="mt-3 font-bold">{t}</div>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="px-4 py-6 text-center text-xs text-muted">Built for the Great Indian AI Internship Challenge · Speech by Gnani AI</footer>
    </div>
  );
}
