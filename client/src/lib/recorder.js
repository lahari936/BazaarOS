// Records mono 16 kHz WAV in the browser. Gnani Prisma accepts WAV but not WebM/Opus
// (what MediaRecorder produces), so we capture raw PCM and encode WAV ourselves. No dependencies.
export const MAX_SECONDS = 28; // Prisma REST limit is 30 s

export class MicError extends Error {}

export async function startRecording({ onLevel } = {}) {
  if (!window.isSecureContext) throw new MicError('Microphone needs HTTPS (or localhost).');
  if (!navigator.mediaDevices?.getUserMedia) throw new MicError('This browser cannot record audio.');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    if (e.name === 'NotAllowedError') throw new MicError('Microphone permission denied. Allow mic access in your browser settings and retry.');
    if (e.name === 'NotFoundError') throw new MicError('No microphone found on this device.');
    throw new MicError(`Could not start microphone: ${e.message}`);
  }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  // ScriptProcessor is deprecated but universally supported (incl. older Android WebViews).
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(analyser);
  source.connect(proc);
  proc.connect(ctx.destination);

  const bins = new Uint8Array(analyser.frequencyBinCount);
  let raf;
  const tick = () => {
    analyser.getByteTimeDomainData(bins);
    let peak = 0;
    for (const v of bins) peak = Math.max(peak, Math.abs(v - 128) / 128);
    onLevel?.(peak);
    raf = requestAnimationFrame(tick);
  };
  tick();

  const cleanup = () => {
    cancelAnimationFrame(raf);
    proc.disconnect(); source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
  };
  return {
    stop() {
      const rate = ctx.sampleRate;
      cleanup();
      const len = chunks.reduce((a, c) => a + c.length, 0);
      const all = new Float32Array(len);
      let o = 0;
      for (const c of chunks) { all.set(c, o); o += c.length; }
      return { blob: encodeWav(downsample(all, rate, 16000), 16000), seconds: len / rate, peak: all.reduce((m, v) => Math.max(m, Math.abs(v)), 0) };
    },
    cancel: cleanup,
  };
}

export function downsample(buf, from, to) {
  if (from === to) return buf;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(buf.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const s = Math.floor(i * ratio);
    const e = Math.min(buf.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = s; j < e; j++) sum += buf[j];
    out[i] = sum / Math.max(1, e - s); // box filter: cheap anti-aliasing
  }
  return out;
}

export function encodeWav(samples, rate) {
  const v = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Blob([v], { type: 'audio/wav' });
}
