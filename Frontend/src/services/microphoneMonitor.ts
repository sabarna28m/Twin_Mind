export interface MicHandle {
  getVolume: () => number;
  stop: () => void;
}

export async function startMicrophoneMonitor(): Promise<MicHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const buf = new Uint8Array(analyser.frequencyBinCount);
  let volume = 0;
  let alive = true;

  (function tick() {
    if (!alive) return;
    analyser.getByteFrequencyData(buf);
    volume = buf.reduce((s, v) => s + v, 0) / buf.length;
    requestAnimationFrame(tick);
  })();

  return {
    getVolume: () => volume,
    stop: () => {
      alive = false;
      stream.getTracks().forEach(t => t.stop());
      ctx.close().catch(() => {});
    },
  };
}
