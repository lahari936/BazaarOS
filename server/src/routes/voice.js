// Voice pipeline: audio -> Gnani Prisma (STT) -> deterministic intent engine -> confirmation card
// -> user confirms -> ledger executes -> Gnani Timbre (TTS) speaks the result.
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { VoiceLog, Customer } from '../models.js';
import { HttpError, requireAuth, requireBusiness, validate, objectId } from '../middleware.js';
import { transcribe, MAX_BYTES, STT_LANGS } from '../services/prisma.service.js';
import { synthesize } from '../services/timbre.service.js';
import { parseCommand, validateCommand, TXN_INTENTS, round2 } from '../services/intent.service.js';
import { executeCommand } from '../services/ledger.service.js';
import { msg, unitName, periodName, rupees } from '../services/responses.js';
import { summarize, receivables, inventoryStats, periodRange } from '../services/reports.service.js';
import { loadCtx } from './transactions.js';

const r = Router();
r.use(requireAuth, requireBusiness);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

const local = (d, k) => d[`${k}Local`] || d[k];
function speechVars(cmd, extra = {}) {
  const d = cmd.data;
  return {
    product: local(d, 'product'), customer: local(d, 'customer'), qty: d.quantity, unit: unitName(cmd.language, d.unit),
    amount: rupees(d.totalAmount), unitPrice: d.unitPrice, category: d.category, ...extra,
  };
}

/** Read-only intents are answered straight from the database. */
async function answerQuery(cmd, business) {
  const L = cmd.language;
  const id = business._id;
  if (cmd.intent === 'INVENTORY_QUERY') {
    const inv = await inventoryStats(id);
    const p = cmd.data.productId && inv.products.find((x) => String(x._id) === cmd.data.productId);
    if (p) {
      const key = p.quantity <= p.lowStockThreshold ? 'stockOneLow' : 'stockOne';
      return { text: msg(L, key, { product: p.nameLocal || p.name, qty: round2(p.quantity), unit: unitName(L, p.unit) }), result: { product: p } };
    }
    let text = msg(L, 'stockAll', { count: inv.products.length });
    if (inv.low.length) text += msg(L, 'stockLow', { list: inv.low.map((x) => `${x.nameLocal || x.name} ${round2(x.quantity)} ${unitName(L, x.unit)}`).join(', ') });
    return { text, result: { products: inv.products, low: inv.low } };
  }
  const period = cmd.data.period || 'today';
  const { from, to } = periodRange(period);
  const [s, recv] = await Promise.all([summarize(id, from, to), receivables(id)]);
  const result = msg(L, s.netProfit < 0 ? 'profitNeg' : 'profitPos', { net: rupees(s.netProfit) });
  const vars = { period: periodName(L, period), revenue: rupees(s.revenue), cogs: rupees(s.cogs), expenses: rupees(s.expenses), purchases: rupees(s.purchases), cashIn: rupees(s.cashIn), receivables: rupees(recv.total), result };
  return { text: msg(L, cmd.intent === 'PROFIT_QUERY' ? 'profit' : 'report', vars), result: { ...s, receivables: recv.total, period } };
}

r.post('/process', upload.single('audio'), async (req, res) => {
  const started = Date.now();
  const { language, text: typed } = validate(z.object({ language: z.enum(STT_LANGS).default('te-IN'), text: z.string().trim().max(300).optional() }), req.body);
  const log = { userId: req.userId, businessId: req.business._id, language, gnaniModels: [] };

  let stt;
  try {
    if (req.file) {
      stt = await transcribe({ buffer: req.file.buffer, mimetype: req.file.mimetype, filename: req.file.originalname, language });
      log.gnaniModels.push(stt.model);
      log.sttLatency = stt.latencyMs;
    } else if (typed) {
      stt = { transcript: typed, literal: null, language }; // typed fallback: clearly labelled, no Prisma call
      log.gnaniModels.push('typed-input');
    } else throw new HttpError(400, 'No recording received', { code: 'EMPTY_AUDIO' });
  } catch (err) {
    await VoiceLog.create({ ...log, status: 'FAILED', error: err.message, processingTime: Date.now() - started });
    throw err;
  }
  log.transcript = stt.transcript;
  log.transcriptLiteral = stt.literal;
  if (!stt.transcript) {
    await VoiceLog.create({ ...log, status: 'FAILED', error: 'empty transcript', processingTime: Date.now() - started });
    throw new HttpError(422, 'Could not hear any words. Please speak closer to the mic and retry.', { code: 'EMPTY_TRANSCRIPT' });
  }

  const cmd = parseCommand(stt.transcript, await loadCtx(req.business._id, language));
  let status;
  let responseText;
  let result = null;
  if (TXN_INTENTS.includes(cmd.intent)) {
    const ready = !cmd.missingFields.length && !cmd.errors.length;
    status = ready ? 'AWAITING_CONFIRMATION' : 'NEEDS_CLARIFICATION';
    responseText = ready ? msg(language, `confirm_${cmd.intent}`, speechVars(cmd)) : cmd.clarificationQuestion;
  } else if (cmd.intent === 'UNKNOWN') {
    status = 'NEEDS_CLARIFICATION';
    responseText = cmd.clarificationQuestion;
  } else {
    ({ text: responseText, result } = await answerQuery(cmd, req.business));
    status = 'ANSWERED';
  }
  const saved = await VoiceLog.create({ ...log, intent: cmd.intent, parsedData: cmd, status, responseText, processingTime: Date.now() - started });
  res.json({
    voiceLogId: saved._id, status, transcript: stt.transcript, transcriptLiteral: stt.literal, language,
    command: cmd, responseText, result, gnaniModels: saved.gnaniModels, processingTime: saved.processingTime, sttLatency: saved.sttLatency,
  });
});

r.post('/confirm', async (req, res) => {
  const body = validate(z.object({ voiceLogId: objectId, intent: z.enum(TXN_INTENTS).optional(), data: z.record(z.string(), z.any()).optional() }), req.body);
  const filter = { _id: body.voiceLogId, businessId: req.business._id };
  const current = await VoiceLog.findOne(filter);
  if (!current) throw new HttpError(404, 'Voice command not found');
  const replay = () => res.json({ status: 'COMPLETED', replayed: true, transactionId: current.transactionId, responseText: current.responseText });
  if (current.status === 'COMPLETED') return replay();
  if (current.status === 'CANCELLED') throw new HttpError(409, 'This command was cancelled. Speak again to record it.');

  // Atomic claim: only one confirm request can move the log into CONFIRMING.
  const prevStatus = current.status;
  const claimed = await VoiceLog.findOneAndUpdate({ ...filter, status: { $in: ['AWAITING_CONFIRMATION', 'NEEDS_CLARIFICATION'] } }, { $set: { status: 'CONFIRMING' } }, { returnDocument: 'after' });
  if (!claimed) {
    const now = await VoiceLog.findOne(filter);
    if (now?.status === 'COMPLETED') return res.json({ status: 'COMPLETED', replayed: true, transactionId: now.transactionId, responseText: now.responseText });
    throw new HttpError(409, 'This command is already being saved', { code: 'IN_PROGRESS' });
  }
  const release = (extra = {}) => VoiceLog.updateOne(filter, { $set: { status: prevStatus, ...extra } });

  const language = claimed.language || 'te-IN';
  const intent = body.intent || claimed.intent;
  if (!TXN_INTENTS.includes(intent)) { await release(); throw new HttpError(400, 'Choose what kind of entry this is (purchase, sale, …)'); }
  const cmd = validateCommand(intent, { ...(claimed.parsedData?.data || {}), ...(body.data || {}) }, await loadCtx(req.business._id, language));
  if (cmd.errors.length || cmd.missingFields.length) {
    await release({ parsedData: cmd, intent });
    throw new HttpError(400, cmd.errors[0] || cmd.clarificationQuestion, { command: cmd, code: 'NEEDS_CLARIFICATION' });
  }
  let result;
  try {
    result = await executeCommand(intent, cmd.data, { business: req.business, source: 'VOICE', transcript: claimed.transcript, voiceLogId: claimed._id, idempotencyKey: `voice:${claimed._id}` });
  } catch (err) {
    await release({ error: err.message, parsedData: cmd, intent });
    throw err;
  }
  const stock = result.product ? round2(result.product.quantity) : null;
  let outstanding = result.customer?.outstandingBalance;
  if (outstanding == null && result.transaction.customerId) outstanding = (await Customer.findById(result.transaction.customerId))?.outstandingBalance;
  const responseText = msg(language, `done_${intent}`, speechVars(cmd, { stock, outstanding: rupees(outstanding), customer: result.customer ? result.customer.nameLocal || result.customer.name : local(cmd.data, 'customer') }));
  await VoiceLog.updateOne(filter, { $set: { status: 'COMPLETED', intent, parsedData: cmd, transactionId: result.transaction._id, responseText, error: null } });
  res.json({ status: 'COMPLETED', replayed: result.replayed, transaction: result.transaction, product: result.product, customer: result.customer, responseText });
});

r.post('/cancel', async (req, res) => {
  const { voiceLogId } = validate(z.object({ voiceLogId: objectId }), req.body);
  const log = await VoiceLog.findOneAndUpdate({ _id: voiceLogId, businessId: req.business._id, status: { $in: ['AWAITING_CONFIRMATION', 'NEEDS_CLARIFICATION'] } }, { $set: { status: 'CANCELLED' } }, { returnDocument: 'after' });
  if (!log) throw new HttpError(409, 'Nothing to cancel');
  res.json({ status: 'CANCELLED', responseText: msg(log.language, 'cancelled') });
});

r.post('/synthesize', async (req, res) => {
  const { text, language } = validate(z.object({ text: z.string().trim().min(1).max(600), language: z.enum(STT_LANGS).default('te-IN') }), req.body);
  const wav = await synthesize(text, language);
  res.set({ 'Content-Type': 'audio/wav', 'Content-Length': wav.length, 'X-Gnani-Model': 'timbre-v2.5', 'Cache-Control': 'no-store' }).send(wav);
});

r.get('/history', async (req, res) => {
  const { limit } = validate(z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }), req.query);
  res.json(await VoiceLog.find({ businessId: req.business._id }).sort({ createdAt: -1 }).limit(limit).lean());
});

export default r;
