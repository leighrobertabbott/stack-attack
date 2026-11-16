import { backing } from './music/fallback.js';

const core = 'toast-rush';
const soundtrack = {
  shore: core,
  reef: 'dino-shuffle',
  harbor: 'midnight-munch',
  peak: 'matchday-strut',
  cloud: 'midnight-munch',
  wizard: 'midnight-munch',
  home: 'breakfast-break',
  buck: 'breakfast-break',
  liverpool: 'matchday-strut',
  jungle: 'dino-shuffle',
  future: 'flux-funk',
};
const volume = { menu: .34, countdown: .46, running: .74, feeding: .21, digestion: .55, result: .30 };

export function makeMusic(context, destination) {
  const mix = context.createGain();
  mix.gain.value = 0;
  mix.connect(destination);
  const decoded = new Map();
  const inFlight = new Map();
  let id = core;
  let mode;
  let enabled = false;
  let voice = null;
  let request = null;
  let fallback;
  let position = 0;
  let unavailable = false;

  function getFallback() {
    fallback ??= Promise.resolve().then(() => {
      const buffer = Uint8Array.from(atob(backing), character => character.charCodeAt(0)).buffer;
      return context.decodeAudioData(buffer);
    });
    return fallback;
  }

  async function load(id) {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 2400);
    try {
      const url = new URL('./music/' + id + '.mp3', import.meta.url);
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Soundtrack unavailable');
      const data = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(data);
      decoded.set(id, buffer);
      if (decoded.size > 2) decoded.delete(decoded.keys().next().value);
      return buffer;
    } catch {
      return getFallback();
    } finally {
      clearTimeout(deadline);
    }
  }

  function getTrack(id) {
    if (decoded.has(id)) {
      const buffer = decoded.get(id);
      decoded.delete(id);
      decoded.set(id, buffer);
      return Promise.resolve(buffer);
    }
    if (inFlight.has(id)) return inFlight.get(id);
    const task = load(id).finally(() => inFlight.delete(id));
    inFlight.set(id, task);
    return task;
  }

  function stop(remember) {
    request = null;
    if (!voice) return;
    const { source, gain, began, duration } = voice;
    const now = context.currentTime;
    if (remember) position = (position + Math.max(0, now - began)) % duration;
    voice = null;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, .027);
    source.stop(now + .14);
  }

  function play() {
    if (!enabled || !volume[mode] || voice || request || unavailable) return;
    const track = getTrack(id);
    request = track;
    track.then(buffer => {
      if (request !== track || !enabled || !volume[mode]) return;
      request = null;
      const source = context.createBufferSource();
      const gain = context.createGain();
      const now = context.currentTime;
      const began = now + .006;
      const duration = buffer.duration;
      position %= duration;
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(1, began, .067);
      source.connect(gain);
      gain.connect(mix);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (voice?.source === source) voice = null;
      };
      source.start(began, position);
      voice = { source, gain, began, duration };
    }).catch(() => {
      if (request !== track) return;
      request = null;
      unavailable = true;
    });
  }

  function target(gain, time = context.currentTime, ease = .13) {
    mix.gain.setTargetAtTime(gain, time, ease);
  }

  return {
    select(world) {
      stop(false);
      id = soundtrack[world] ?? core;
      position = 0;
      unavailable = false;
    },
    update(nextMode, audible) {
      if (nextMode !== mode || audible !== enabled) {
        mode = nextMode;
        enabled = audible;
        const now = context.currentTime;
        mix.gain.cancelScheduledValues(now);
        target(enabled ? volume[mode] ?? 0 : 0, now);
        if (!enabled || !volume[mode]) stop(true);
      }
      play();
    },
    duck(strength, length) {
      if (!voice || !enabled || !volume[mode]) return;
      const now = context.currentTime;
      const normal = volume[mode];
      mix.gain.cancelScheduledValues(now);
      target(normal * strength, now, .034);
      target(normal, now + length, .20);
    },
  };
}
