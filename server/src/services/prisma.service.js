// Gnani Prisma v2.5 speech-to-text. Docs: https://docs.gnani.ai/api/STT/speech-to-text
import { config } from '../config.js';
import { HttpError } from '../middleware.js';

const URL = 'https://api.vachana.ai/stt/v3';
export const STT_LANGS = ['te-IN', 'hi-IN', 'en-IN'];
// Prisma accepts WAV, MP3, OGG, FLAC, AAC, M4A (not WebM). The web client records WAV.
const ALLOWED = /^audio\/(wav|x-wav|wave|vnd\.wave|mpeg|mp3|ogg|flac|x-flac|aac|mp4|x-m4a|m4a)$/;
export const MAX_BYTES = 5 * 1024 * 1024;

export async function transcribe({ buffer, mimetype, filename = 'audio.wav', language }) {
  if (!buffer?.length || buffer.length < 1000) throw new HttpError(400, 'Recording is empty. Hold the mic and speak.', { code: 'EMPTY_AUDIO' });
  if (!ALLOWED.test(mimetype)) throw new HttpError(415, `Unsupported audio type ${mimetype}`, { code: 'UNSUPPORTED_AUDIO' });
  if (!STT_LANGS.includes(language)) throw new HttpError(400, 'language must be te-IN, hi-IN or en-IN');

  const form = new FormData();
  form.append('audio_file', new Blob([buffer], { type: mimetype }), filename);
  form.append('language_code', language);
  form.append('format', 'transcribe'); // inverse text normalisation: "ఇరవై" -> "20"

  const started = Date.now();
  let res;
  try {
    // Gnani allows one active request per key; retry once on 429.
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(URL, { method: 'POST', headers: { 'X-API-Key-ID': config.gnaniKey }, body: form, signal: AbortSignal.timeout(20000) });
      if (res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 800));
    }
  } catch (e) {
    const timeout = e.name === 'TimeoutError';
    throw new HttpError(502, timeout ? 'Speech service timed out. Please retry.' : 'Could not reach speech service. Check internet and retry.', { code: timeout ? 'STT_TIMEOUT' : 'STT_NETWORK' });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const msg = body.error?.message || body.detail?.message || (Array.isArray(body.detail) ? body.detail[0]?.msg : null) || `HTTP ${res.status}`;
    const code = body.error?.type || body.detail?.error_code || 'STT_FAILED';
    throw new HttpError(res.status === 429 ? 429 : 502, `Speech recognition failed: ${msg}`, { code });
  }
  return {
    transcript: (body.transcript || '').trim(),
    literal: body.output?.literal || null,
    language: body.detected_language_code || language, // v2.5 does not detect, so echo the hint
    model: body.model || 'prisma-v2.5',
    requestId: body.request_id,
    latencyMs: Date.now() - started,
  };
}
