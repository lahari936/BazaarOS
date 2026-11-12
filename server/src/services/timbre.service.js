// Gnani Timbre v2.5 text-to-speech. Docs: https://docs.gnani.ai/api/TTS/tts-inference
import { config } from '../config.js';
import { HttpError } from '../middleware.js';

const URL = 'https://api.vachana.ai/api/v1/tts/inference';
export const VOICES = { 'te-IN': 'Lavanya', 'hi-IN': 'Nalini', 'en-IN': 'Kaveri' };

/** Returns a WAV Buffer. Throws HttpError on failure (callers decide whether that is fatal). */
export async function synthesize(text, language = 'te-IN') {
  text = String(text || '').trim();
  if (!text) throw new HttpError(400, 'Nothing to speak');
  if (text.length > 600) text = text.slice(0, 600);
  const voice = VOICES[language] || VOICES['en-IN'];
  let res;
  try {
    const body = JSON.stringify({
      text, voice, model: 'timbre-v2.5', language: VOICES[language] ? language : 'en-IN', speed: 1.0,
      audio_config: { sample_rate: 22050, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' },
    });
    // Gnani allows one active request per key; retry once on 429.
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key-ID': config.gnaniKey }, body, signal: AbortSignal.timeout(20000) });
      if (res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 800));
    }
  } catch (e) {
    throw new HttpError(502, e.name === 'TimeoutError' ? 'Voice reply timed out' : 'Could not reach voice service', { code: 'TTS_NETWORK' });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new HttpError(res.status === 429 ? 429 : 502, `Voice reply failed: ${body.message || body.detail?.message || res.status}`, { code: 'TTS_FAILED' });
  }
  return Buffer.from(await res.arrayBuffer());
}
