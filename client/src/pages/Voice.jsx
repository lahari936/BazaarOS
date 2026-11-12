import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, Square, Loader2, Check, Pencil, X, Volume2, RotateCw, Keyboard, AlertTriangle, CheckCircle2, History, Send } from 'lucide-react';
import { api, errMsg } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { startRecording, MicError, MAX_SECONDS } from '../lib/recorder.js';
import { rs, qty, when, INTENT_LABEL, LANGS } from '../lib/format.js';
import { Badge, Button, Card, Field, Input, Select, cx, useFetch } from '../components/ui.jsx';

const PHASE = {
  IDLE: { label: 'Ready', tone: 'gray' },
  LISTENING: { label: 'Listening', tone: 'red' },
  PROCESSING: { label: 'Processing', tone: 'blue' },
  AWAITING_CONFIRMATION: { label: 'Awaiting confirmation', tone: 'amber' },
  NEEDS_CLARIFICATION: { label: 'Needs details', tone: 'amber' },
  SAVING: { label: 'Saving', tone: 'blue' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  ANSWERED: { label: 'Completed', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'gray' },
  FAILED: { label: 'Failed', tone: 'red' },
};
const TXN = ['PURCHASE', 'SALE', 'EXPENSE', 'CUSTOMER_CREDIT', 'CUSTOMER_PAYMENT'];
const WARN = {
  NEW_PRODUCT: 'New product: it will be added to your inventory.',
  NEW_CUSTOMER: 'New customer: a Khata will be opened for them.',
  RECEIVABLE_ONLY: 'No product named, so this is recorded as money owed only, not as sales revenue.',
  MULTIPLE_AMOUNTS: 'More than one amount was heard. Please check the total.',
};
const EXAMPLES = {
  'te-IN': ['ఈరోజు 20 కిలోల టమాటాలు 400 రూపాయలకు కొన్నాను', '5 కిలోల టమాటాలు 150 రూపాయలకు అమ్మాను', 'రవి 200 రూపాయలు అప్పుగా తీసుకున్నాడు', 'ఈరోజు ఎంత లాభం వచ్చింది?'],
  'hi-IN': ['आज 10 किलो प्याज 300 रुपये में खरीदा', '3 किलो आलू 105 रुपये में बेचे', 'रवि ने 100 रुपये लौटाए', 'आज कितना मुनाफ़ा हुआ?'],
  'en-IN': ['Bought 10 kg onions for 280 rupees', 'Sold 2 kg carrots for 100 rupees on UPI', 'Paid 80 rupees for auto', 'How many tomatoes are left?'],
};

export default function Voice() {
  const { business } = useAuth();
  const [lang, setLang] = useState(() => localStorage.getItem('bz_lang') || business.preferredLanguage || 'te-IN');
  const [phase, setPhase] = useState('IDLE');
  const [error, setError] = useState(null);
  const [cur, setCur] = useState(null); // response of /voice/process
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [draftIntent, setDraftIntent] = useState(null);
  const [turns, setTurns] = useState([]);
  const [secs, setSecs] = useState(0);
  const [levels, setLevels] = useState(() => Array(36).fill(0));
  const [speaking, setSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState(null);
  const [typed, setTyped] = useState('');
  const [showType, setShowType] = useState(false);
  const rec = useRef(null);
  const lastAudio = useRef(null);
  const timer = useRef(null);
  const audioEl = useRef(null);
  const lastLevel = useRef(0);
  const products = useFetch('/products');
  const customers = useFetch('/customers');
  const history = useFetch('/voice/history?limit=15');

  useEffect(() => { try { localStorage.setItem('bz_lang', lang); } catch { /* private mode */ } }, [lang]);
  useEffect(() => () => { rec.current?.cancel(); clearInterval(timer.current); audioEl.current?.pause(); }, []);

  const say = async (text, language = lang) => {
    if (!text) return;
    setTtsError(null); setSpeaking(true);
    try {
      const { data } = await api.post('/voice/synthesize', { text, language }, { responseType: 'blob' });
      audioEl.current?.pause();
      const a = new Audio(URL.createObjectURL(data));
      audioEl.current = a;
      a.onended = () => setSpeaking(false);
      await a.play();
    } catch (e) {
      setSpeaking(false);
      setTtsError(e.response?.data instanceof Blob ? 'Voice reply unavailable right now.' : errMsg(e));
    }
  };
  const addTurn = (t) => setTurns((x) => [...x, { id: Math.random(), at: new Date(), ...t }]);

  async function start() {
    setError(null); setCur(null); setEditing(false); setTtsError(null);
    audioEl.current?.pause();
    try {
      rec.current = await startRecording({
        onLevel: (v) => {
          const now = performance.now();
          if (now - lastLevel.current < 60) return;
          lastLevel.current = now;
          setLevels((l) => [...l.slice(1), v]);
        },
      });
    } catch (e) {
      setPhase('FAILED');
      setError(e instanceof MicError ? e.message : `Microphone error: ${e.message}`);
      return;
    }
    setPhase('LISTENING'); setSecs(0);
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setSecs(s);
      if (s >= MAX_SECONDS) stop();
    }, 200);
  }

  function stop() {
    clearInterval(timer.current);
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    const { blob, seconds, peak } = r.stop();
    setLevels(Array(36).fill(0));
    if (seconds < 0.6) { setPhase('FAILED'); setError('Recording too short. Tap the mic, speak, then tap again to stop.'); return; }
    if (peak < 0.01) { setPhase('FAILED'); setError('We could not hear anything. Check that your microphone is not muted.'); return; }
    lastAudio.current = blob;
    send({ audio: blob });
  }

  async function send({ audio, text }) {
    setPhase('PROCESSING'); setError(null);
    const fd = new FormData();
    fd.append('language', lang);
    if (audio) fd.append('audio', audio, 'recording.wav');
    if (text) fd.append('text', text);
    try {
      const { data } = await api.post('/voice/process', fd);
      setCur(data);
      setDraft(data.command.data || {});
      setDraftIntent(data.command.intent);
      setPhase(data.status);
      setEditing(data.status === 'NEEDS_CLARIFICATION' && TXN.includes(data.command.intent));
      addTurn({ role: 'user', text: data.transcript, typed: !audio });
      addTurn({ role: 'bot', text: data.responseText });
      say(data.responseText);
      if (data.status === 'ANSWERED') history.reload();
    } catch (e) {
      setPhase('FAILED');
      setError(errMsg(e));
    }
  }

  async function confirm() {
    setPhase('SAVING'); setError(null);
    try {
      const { data } = await api.post('/voice/confirm', { voiceLogId: cur.voiceLogId, intent: draftIntent, data: draft });
      setCur((c) => ({ ...c, done: data }));
      setEditing(false);
      setPhase('COMPLETED');
      addTurn({ role: 'bot', text: data.responseText, ok: true });
      say(data.responseText);
      products.reload(); customers.reload(); history.reload();
    } catch (e) {
      const cmd = e.response?.data?.command;
      if (cmd) { setCur((c) => ({ ...c, command: cmd })); setDraft(cmd.data); setEditing(true); }
      setPhase(cmd ? 'NEEDS_CLARIFICATION' : 'AWAITING_CONFIRMATION');
      setError(errMsg(e));
    }
  }

  async function cancel() {
    try {
      const { data } = await api.post('/voice/cancel', { voiceLogId: cur.voiceLogId });
      addTurn({ role: 'bot', text: data.responseText });
      setPhase('CANCELLED'); setCur(null); setEditing(false);
      history.reload();
    } catch (e) { setError(errMsg(e)); }
  }

  const listening = phase === 'LISTENING';
  const busy = phase === 'PROCESSING' || phase === 'SAVING';
  const cmd = cur?.command;
  const canConfirm = cur && TXN.includes(draftIntent) && ['AWAITING_CONFIRMATION', 'NEEDS_CLARIFICATION'].includes(phase);

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="grid content-start gap-4 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">Voice Assistant</h1>
          <div className="flex rounded-xl border border-line bg-surface p-1" role="radiogroup" aria-label="Language">
            {LANGS.map((l) => (
              <button key={l.code} role="radio" aria-checked={lang === l.code} disabled={listening || busy} onClick={() => setLang(l.code)} className={cx('min-h-9 rounded-lg px-3 text-sm font-semibold', lang === l.code ? 'bg-primary text-white' : 'text-muted')}>{l.label}</button>
            ))}
          </div>
        </div>

        <Card className="flex flex-col items-center px-4 py-8">
          <Badge tone={PHASE[phase].tone} className="mb-6 px-3 py-1 text-sm">
            {busy && <Loader2 className="size-3.5 animate-spin" />}{PHASE[phase].label.toUpperCase()}
          </Badge>
          <button
            onClick={listening ? stop : start}
            disabled={busy}
            aria-label={listening ? 'Stop recording' : 'Start recording'}
            className={cx('relative isolate grid size-32 place-items-center rounded-full text-white shadow-xl transition active:scale-95 disabled:opacity-60', listening ? 'ring-pulse bg-danger' : 'bg-primary hover:bg-primary-dark')}
          >
            {busy ? <Loader2 className="size-12 animate-spin" /> : listening ? <Square className="size-11 fill-white" /> : <Mic className="size-14" />}
          </button>
          <div className="mt-6 flex h-12 w-full max-w-sm items-center justify-center gap-[3px]" aria-hidden>
            {levels.map((v, i) => <span key={i} className={cx('w-1.5 rounded-full transition-[height] duration-75', listening ? 'bg-danger/80' : 'bg-line')} style={{ height: `${Math.max(6, Math.min(48, v * 140))}px` }} />)}
          </div>
          <div className="num mt-2 text-sm font-semibold text-muted">
            {listening ? `${secs.toFixed(1)}s / ${MAX_SECONDS}s · tap to stop` : busy ? (phase === 'SAVING' ? 'Saving to your books…' : 'Gnani Prisma is transcribing…') : 'Tap the mic and speak'}
          </div>
        </Card>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1">{error}</div>
            {phase === 'FAILED' && lastAudio.current && <button onClick={() => send({ audio: lastAudio.current })} className="inline-flex items-center gap-1 font-semibold"><RotateCw className="size-3.5" />Retry</button>}
          </div>
        )}

        {cur && (
          <Card className="overflow-hidden">
            <div className="border-b border-line bg-bg px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">You said {cur.gnaniModels?.[0] && cur.gnaniModels[0] !== 'typed-input' ? `· ${cur.gnaniModels[0]}` : '· typed'}{cur.sttLatency ? ` · ${(cur.sttLatency / 1000).toFixed(1)}s` : ''}</div>
              <div className="mt-1 text-lg font-semibold leading-snug">“{cur.transcript}”</div>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={cmd.intent === 'UNKNOWN' ? 'red' : 'green'} className="px-2.5 py-1 text-sm">{INTENT_LABEL[draftIntent] || draftIntent}</Badge>
                {cmd.requiresConfirmation && phase !== 'COMPLETED' && <span className="text-xs text-muted">Nothing is saved until you confirm.</span>}
              </div>

              {editing ? (
                <EditForm intent={draftIntent} setIntent={setDraftIntent} draft={draft} setDraft={setDraft} products={products.data || []} customers={customers.data || []} />
              ) : (
                <Summary intent={draftIntent} d={cur.done ? { ...draft } : cmd.data} result={cur.result} />
              )}

              {cmd.missingFields?.length > 0 && phase !== 'COMPLETED' && <p className="mt-3 text-sm font-semibold text-amber-800">Missing: {cmd.missingFields.join(', ').replace('totalAmount', 'amount')}</p>}
              {phase !== 'COMPLETED' && cmd.errors?.map((e) => <p key={e} className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{e}</p>)}
              {phase !== 'COMPLETED' && cmd.warnings?.filter((w) => WARN[w]).map((w) => <p key={w} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{WARN[w]}</p>)}

              <div className="mt-4 flex items-start gap-3 rounded-xl bg-mint/60 p-3">
                <button onClick={() => say(cur.done?.responseText || cur.responseText)} aria-label="Play reply" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-white">
                  {speaking ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
                </button>
                <div className="text-[15px] font-medium text-primary">{cur.done?.responseText || cur.responseText}</div>
              </div>
              {ttsError && <p className="mt-1 text-xs text-muted">{ttsError}</p>}

              {canConfirm && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Button onClick={confirm} loading={phase === 'SAVING'} className="min-h-12"><Check className="size-4" />Confirm</Button>
                  <Button variant="outline" onClick={() => setEditing((e) => !e)} disabled={busy} className="min-h-12"><Pencil className="size-4" />{editing ? 'Done' : 'Edit'}</Button>
                  <Button variant="outline" onClick={cancel} disabled={busy} className="min-h-12 text-danger"><X className="size-4" />Cancel</Button>
                </div>
              )}
              {cmd.intent === 'UNKNOWN' && cmd.reason === 'BUY_OR_SELL' && phase === 'NEEDS_CLARIFICATION' && !editing && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => { setDraftIntent('PURCHASE'); setEditing(true); }}>It was a purchase</Button>
                  <Button variant="secondary" onClick={() => { setDraftIntent('SALE'); setEditing(true); }}>It was a sale</Button>
                </div>
              )}
              {phase === 'COMPLETED' && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-secondary">
                  <CheckCircle2 className="size-5" />Saved{cur.done?.replayed ? ' (already recorded earlier, not duplicated)' : ''}.
                  <Link to="/app/transactions" className="text-primary underline">View in transactions</Link>
                </div>
              )}
            </div>
          </Card>
        )}

        <div>
          <button onClick={() => setShowType((s) => !s)} className="inline-flex items-center gap-2 text-sm font-semibold text-muted"><Keyboard className="size-4" />{showType ? 'Hide typing' : 'Cannot speak right now? Type instead'}</button>
          {showType && (
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { send({ text: typed.trim() }); setTyped(''); } }}>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={EXAMPLES[lang][1]} disabled={busy} aria-label="Type a command" />
              <Button type="submit" disabled={busy || !typed.trim()} aria-label="Send"><Send className="size-4" /></Button>
            </form>
          )}
          {showType && <p className="mt-1 text-xs text-muted">Typed commands skip speech recognition and go straight to the same rules and confirmation.</p>}
        </div>
      </div>

      <div className="grid content-start gap-4 lg:col-span-2">
        <Card className="p-4">
          <h2 className="font-bold">Try saying</h2>
          <ul className="mt-2 grid gap-1.5">
            {EXAMPLES[lang].map((x) => <li key={x} className="rounded-xl bg-bg px-3 py-2 text-sm">“{x}”</li>)}
          </ul>
        </Card>
        <Card>
          <div className="border-b border-line px-4 py-3 font-bold">This conversation</div>
          {turns.length ? (
            <div className="grid max-h-96 gap-2 overflow-y-auto p-4">
              {turns.map((t) => (
                <div key={t.id} className={cx('max-w-[90%] rounded-2xl px-3 py-2 text-sm', t.role === 'user' ? 'ml-auto bg-primary text-white' : t.ok ? 'bg-mint text-primary' : 'bg-bg')}>
                  {t.text}{t.typed && <span className="ml-1 text-[10px] opacity-70">(typed)</span>}
                </div>
              ))}
            </div>
          ) : <p className="p-4 text-sm text-muted">Your commands and replies appear here.</p>}
        </Card>
        <Card>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 font-bold"><History className="size-4" />Voice history</div>
          <div className="divide-y divide-line">
            {(history.data || []).map((h) => (
              <div key={h._id} className="px-4 py-2.5">
                <div className="truncate text-sm">{h.transcript || <span className="text-muted">({h.error || 'no transcript'})</span>}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <Badge tone={PHASE[h.status]?.tone}>{PHASE[h.status]?.label || h.status}</Badge>
                  {h.intent && <span>{INTENT_LABEL[h.intent]}</span>}·<span>{when(h.createdAt)}</span>
                </div>
              </div>
            ))}
            {history.data?.length === 0 && <p className="p-4 text-sm text-muted">No voice commands yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  if (v == null || v === '' || v === false) return null;
  return <div className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-muted">{k}</span><span className="num text-right font-semibold">{v}</span></div>;
}

function Summary({ intent, d, result }) {
  if (['PROFIT_QUERY', 'DAILY_REPORT'].includes(intent) && result) {
    return (
      <div className="mt-3 divide-y divide-line">
        <Row k="Sales revenue" v={rs(result.revenue)} />
        <Row k="Cost of goods sold" v={rs(result.cogs)} />
        <Row k="Gross profit" v={rs(result.grossProfit)} />
        <Row k="Operating expenses" v={rs(result.expenses)} />
        <Row k="Net profit" v={rs(result.netProfit)} />
        {intent === 'DAILY_REPORT' && <><Row k="Purchases (added to stock)" v={rs(result.purchases)} /><Row k="Cash received" v={rs(result.cashIn)} /><Row k="Customers owe you" v={rs(result.receivables)} /></>}
      </div>
    );
  }
  if (intent === 'INVENTORY_QUERY' && result) {
    const list = result.product ? [result.product] : result.products;
    return <div className="mt-3 divide-y divide-line">{list.map((p) => <Row key={p._id} k={p.name} v={`${qty(p.quantity)} ${p.unit}`} />)}</div>;
  }
  return (
    <div className="mt-3 divide-y divide-line">
      <Row k="Product" v={d.product && `${d.product}${d.productLocal && d.productLocal !== d.product ? ` (${d.productLocal})` : ''}`} />
      <Row k="Quantity" v={d.quantity != null && `${qty(d.quantity)} ${d.unit || ''}`} />
      <Row k="Total amount" v={d.totalAmount != null && rs(d.totalAmount)} />
      <Row k="Unit price" v={d.unitPrice != null && d.quantity ? `${rs(d.unitPrice)} / ${d.unit || 'unit'}` : null} />
      <Row k="Customer" v={d.customer && `${d.customer}${d.customerLocal && d.customerLocal !== d.customer ? ` (${d.customerLocal})` : ''}`} />
      <Row k="Category" v={intent === 'EXPENSE' && d.category} />
      <Row k="Payment" v={d.paymentMethod && (d.paymentMethod === 'CREDIT' ? 'Credit (unpaid)' : d.paymentMethod)} />
    </div>
  );
}

function EditForm({ intent, setIntent, draft, setDraft, products, customers }) {
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const goods = ['PURCHASE', 'SALE', 'CUSTOMER_CREDIT'].includes(intent);
  const who = ['CUSTOMER_CREDIT', 'CUSTOMER_PAYMENT'].includes(intent) || (intent === 'SALE' && draft.paymentMethod === 'CREDIT');
  const pickProduct = (id) => {
    if (id === '__new') return set({ productId: null, isNewProduct: true, product: draft.isNewProduct ? draft.product : '' });
    const p = products.find((x) => x._id === id);
    set(p ? { productId: p._id, product: p.name, productLocal: p.nameLocal, unit: p.unit, isNewProduct: false, spokenUnit: p.unit } : { productId: null, product: null, isNewProduct: false });
  };
  const pickCustomer = (id) => {
    if (id === '__new') return set({ customerId: null, isNewCustomer: true, customer: draft.isNewCustomer ? draft.customer : '' });
    const c = customers.find((x) => x._id === id);
    set(c ? { customerId: c._id, customer: c.name, customerLocal: c.nameLocal, isNewCustomer: false } : { customerId: null, customer: null });
  };
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label="Type">
        <Select value={TXN.includes(intent) ? intent : ''} onChange={(e) => setIntent(e.target.value)}>
          {!TXN.includes(intent) && <option value="">Choose…</option>}
          {TXN.map((i) => <option key={i} value={i}>{INTENT_LABEL[i]}</option>)}
        </Select>
      </Field>
      {goods && (
        <Field label={intent === 'CUSTOMER_CREDIT' ? 'Product (optional)' : 'Product'}>
          <Select value={draft.isNewProduct ? '__new' : draft.productId || ''} onChange={(e) => pickProduct(e.target.value)}>
            <option value="">{intent === 'CUSTOMER_CREDIT' ? 'No product (money only)' : 'Choose…'}</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.name} · {qty(p.quantity)} {p.unit}</option>)}
            {intent === 'PURCHASE' && <option value="__new">+ New product</option>}
          </Select>
        </Field>
      )}
      {goods && draft.isNewProduct && intent === 'PURCHASE' && (
        <Field label="New product name"><Input value={draft.product || ''} onChange={(e) => set({ product: e.target.value })} /></Field>
      )}
      {goods && (draft.productId || draft.isNewProduct) && (
        <Field label={`Quantity${draft.unit ? ` (${draft.unit})` : ''}`}><Input type="number" inputMode="decimal" min="0" step="any" value={draft.quantity ?? ''} onChange={(e) => set({ quantity: e.target.value, spokenUnit: draft.unit })} /></Field>
      )}
      <Field label="Total amount (₹)"><Input type="number" inputMode="decimal" min="0" step="any" value={draft.totalAmount ?? ''} onChange={(e) => set({ totalAmount: e.target.value, unitPrice: null })} /></Field>
      {who && (
        <Field label="Customer">
          <Select value={draft.isNewCustomer ? '__new' : draft.customerId || ''} onChange={(e) => pickCustomer(e.target.value)}>
            <option value="">Choose…</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}{c.outstandingBalance ? ` · owes ${rs(c.outstandingBalance, false)}` : ''}</option>)}
            {intent !== 'CUSTOMER_PAYMENT' && <option value="__new">+ New customer</option>}
          </Select>
        </Field>
      )}
      {who && draft.isNewCustomer && <Field label="New customer name"><Input value={draft.customer || ''} onChange={(e) => set({ customer: e.target.value })} /></Field>}
      {intent === 'EXPENSE' && (
        <Field label="Category">
          <Select value={draft.category || 'Other'} onChange={(e) => set({ category: e.target.value })}>
            {['Transport', 'Rent', 'Electricity', 'Wages', 'Other'].map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
      )}
      {intent !== 'CUSTOMER_CREDIT' && (
        <Field label="Payment">
          <Select value={draft.paymentMethod || 'CASH'} onChange={(e) => set({ paymentMethod: e.target.value })}>
            {['CASH', 'UPI', 'CARD', ...(intent === 'SALE' ? ['CREDIT'] : [])].map((m) => <option key={m} value={m}>{m === 'CREDIT' ? 'Credit (unpaid)' : m}</option>)}
          </Select>
        </Field>
      )}
    </div>
  );
}
