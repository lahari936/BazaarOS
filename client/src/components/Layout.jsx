import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Mic, Package, ReceiptText, BookUser, BarChart3, Settings, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { cx, Modal } from './ui.jsx';

export const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/voice', label: 'Voice Assistant', icon: Mic },
  { to: '/app/inventory', label: 'Inventory', icon: Package },
  { to: '/app/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/app/khata', label: 'Customer Khata', icon: BookUser },
  { to: '/app/reports', label: 'Reports', icon: BarChart3 },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export function Logo({ light }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-9" />
      <div className="leading-tight">
        <div className={cx('text-[17px] font-extrabold tracking-tight', light ? 'text-white' : 'text-primary')}>Bazaar OS</div>
        <div className={cx('text-[11px]', light ? 'text-green-100/80' : 'text-muted')}>Your business. Your language.</div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { business, user, signOut } = useAuth();
  const [more, setMore] = useState(false);
  const { pathname } = useLocation();
  const onVoice = pathname.startsWith('/app/voice');

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <div className="px-2 py-2"><Logo /></div>
        <div className="mx-2 mt-4 rounded-xl bg-bg px-3 py-2.5">
          <div className="truncate text-sm font-semibold">{business?.shopName}</div>
          <div className="truncate text-xs text-muted">{user?.name}</div>
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-primary text-white' : 'text-ink/80 hover:bg-bg')}>
              <Icon className="size-[18px]" />{label}
            </NavLink>
          ))}
        </nav>
        <button onClick={signOut} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-bg"><LogOut className="size-[18px]" />Sign out</button>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <span className="max-w-[40%] truncate text-xs font-semibold text-muted">{business?.shopName}</span>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav: the mic is the centre, biggest target. */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
          {[NAV[0], NAV[2]].map((n) => <Tab key={n.to} {...n} />)}
          <NavLink to="/app/voice" aria-label="Voice assistant" className="flex flex-col items-center">
            <span className={cx('-mt-7 grid size-16 place-items-center rounded-full border-4 border-bg shadow-lg', onVoice ? 'bg-secondary' : 'bg-primary')}><Mic className="size-7 text-white" /></span>
            <span className="mt-0.5 text-[11px] font-semibold text-primary">Speak</span>
          </NavLink>
          <Tab {...NAV[4]} label="Khata" />
          <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium text-muted"><Menu className="size-5" />More</button>
        </div>
      </nav>
      <Modal open={more} title="More" onClose={() => setMore(false)}>
        <div className="grid gap-1">
          {[NAV[3], NAV[5], NAV[6]].map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMore(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium hover:bg-bg"><Icon className="size-5 text-primary" />{label}</NavLink>
          ))}
          <button onClick={signOut} className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium text-danger hover:bg-bg"><LogOut className="size-5" />Sign out</button>
        </div>
      </Modal>
    </div>
  );
}

function Tab({ to, label, icon: Icon, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted')}>
      <Icon className="size-5" />{label.split(' ')[0]}
    </NavLink>
  );
}
