// Sound, fully synthesised with WebAudio — no audio files, no network.
// Engine hum, police siren, gunshots, punches, pickups and mission jingles.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass || 1200;
    const g = c.createGain();
    g.gain.value = vol || 0.2;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; if (muted) this.stopEngine(); return muted; },
    get muted() { return muted; },
    shoot() { noise(0.12, 0.25, 900); blip(160, 0.08, 'square', 0.1, 60); },
    punch() { noise(0.08, 0.18, 500); },
    pickup() { blip(660, 0.1, 'sine', 0.1, 990); },
    crash() { noise(0.25, 0.3, 700); },
    mission() { blip(523, 0.12, 'sine', 0.12); setTimeout(() => blip(659, 0.12, 'sine', 0.12), 110); setTimeout(() => blip(784, 0.22, 'sine', 0.12), 220); },
    busted() { blip(220, 0.5, 'sawtooth', 0.1, 110); },
    wasted() { blip(330, 0.7, 'sawtooth', 0.1, 55); },
    click() { blip(880, 0.05, 'sine', 0.06); },
    // Continuous engine hum whose pitch follows speed (0..1).
    engine(speed01, on) {
      if (muted || !on) { this.stopEngine(); return; }
      const c = ensure();
      if (!c) return;
      if (!engineOsc) {
        engineOsc = c.createOscillator();
        engineGain = c.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0.02;
        const f = c.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 500;
        engineOsc.connect(f).connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, c.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.015 + speed01 * 0.03, c.currentTime, 0.1);
    },
    stopEngine() {
      if (engineOsc) { try { engineOsc.stop(); } catch {} engineOsc = null; engineGain = null; }
    },
    // Two-tone siren while any police chase is active.
    siren(active, dt) {
      if (muted || !active) {
        if (sirenOsc) { try { sirenOsc.stop(); } catch {} sirenOsc = null; sirenGain = null; }
        return;
      }
      const c = ensure();
      if (!c) return;
      if (!sirenOsc) {
        sirenOsc = c.createOscillator();
        sirenGain = c.createGain();
        sirenOsc.type = 'triangle';
        sirenGain.gain.value = 0.03;
        sirenOsc.connect(sirenGain).connect(c.destination);
        sirenOsc.start();
      }
      sirenTimer += dt;
      const high = Math.floor(sirenTimer / 0.45) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(high ? 950 : 700, c.currentTime, 0.05);
    },
  };
}
