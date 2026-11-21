// Night Shift: The Quiet Vault — synthesized sound, no audio files.
//
// Everything is a short WebAudio oscillator burst, so the game ships no
// assets and makes no network request. Guard footsteps pan left/right and
// fade with distance, so you can hear where a patrol is.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    return ctx;
  }

  // One short tone. opts: freq, freqEnd, dur, type, vol, pan (-1..1).
  function blip(opts) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    if (ac.state === "suspended") void ac.resume();
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(opts.freq, now);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), now + opts.dur);
    gain.gain.setValueAtTime(opts.vol || 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.dur);
    let out = gain;
    if (typeof opts.pan === "number" && ac.createStereoPanner) {
      const panner = ac.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
      gain.connect(panner);
      out = panner;
    }
    osc.connect(gain);
    out.connect(master);
    osc.start(now);
    osc.stop(now + opts.dur + 0.02);
  }

  function noiseBurst(dur, vol, pan) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    if (ac.state === "suspended") void ac.resume();
    const now = ac.currentTime;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let out = gain;
    if (typeof pan === "number" && ac.createStereoPanner) {
      const panner = ac.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      out = panner;
    }
    src.connect(gain);
    out.connect(master);
    src.start(now);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    // Soft player step, lower when sneaking.
    step(sneaking) {
      blip({ freq: sneaking ? 140 : 190, freqEnd: 90, dur: 0.07, type: "triangle", vol: sneaking ? 0.05 : 0.09 });
    },
    // A guard's step: pan and volume follow the guard relative to the player.
    guardStep(pan, distance) {
      const vol = Math.max(0.02, 0.22 * (1 - distance / 620));
      blip({ freq: 120, freqEnd: 70, dur: 0.09, type: "sine", vol, pan });
    },
    pickup() {
      blip({ freq: 660, dur: 0.09, vol: 0.18 });
      setTimeout(() => blip({ freq: 990, dur: 0.14, vol: 0.18 }), 70);
    },
    spotted() {
      blip({ freq: 220, freqEnd: 440, dur: 0.22, type: "square", vol: 0.16 });
    },
    alarm() {
      blip({ freq: 520, freqEnd: 780, dur: 0.3, type: "sawtooth", vol: 0.14 });
      setTimeout(() => blip({ freq: 780, freqEnd: 520, dur: 0.3, type: "sawtooth", vol: 0.14 }), 180);
    },
    caught() {
      noiseBurst(0.35, 0.25, 0);
      blip({ freq: 160, freqEnd: 60, dur: 0.4, type: "sawtooth", vol: 0.2 });
    },
    exitOpen() {
      blip({ freq: 523, dur: 0.12, vol: 0.16 });
      setTimeout(() => blip({ freq: 659, dur: 0.12, vol: 0.16 }), 100);
      setTimeout(() => blip({ freq: 784, dur: 0.22, vol: 0.16 }), 200);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => blip({ freq: f, dur: 0.25, vol: 0.18 }), i * 130));
    },
    lose() {
      [392, 330, 262, 196].forEach((f, i) =>
        setTimeout(() => blip({ freq: f, dur: 0.3, type: "triangle", vol: 0.16 }), i * 160));
    },
  };
}
