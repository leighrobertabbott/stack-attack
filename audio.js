import { makeMusic } from './music.js';

export function makeAudio() {
  let audio, master, bus, music;
  let muted = false, world = 'shore', mode = 'menu';
  const frequency = (note) => 440 * 2 ** ((note - 69) / 12);

  function tone(hz, start, duration, type = 'sine', volume = .12, bend = 0) {
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, start);
    if (bend) osc.frequency.exponentialRampToValueAtTime(Math.max(35, hz + bend),start + duration);
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .016);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    osc.connect(gain);
    gain.connect(bus);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start(start);
    osc.stop(start + duration + .014);
  }

  return {
    theme(name) {
      world = name;
      music?.select(name);
    },
    open() {
      const Driver = window.AudioContext || window.webkitAudioContext;
      if (!Driver || muted) return;
      if (!audio) {
        audio = new Driver();
        master = audio.createGain();
        master.gain.value = .80;
        master.connect(audio.destination);
        bus = audio.createGain();
        bus.gain.value = .49;
        bus.connect(master);
        music = makeMusic(audio, master);
        music.select(world);
      }
      audio.resume().catch(()=>{});
    },
    mute(value) {
      muted = value;
      if (master) {
        const now = audio.currentTime;
        master.gain.setTargetAtTime(value ? 0 : .80, now, .038);
        music.update(mode, !muted && audio.state === 'running');
      }
    },
    effect(name, height = 0) {
      if (!audio || muted || audio.state !== 'running') return;
      const t = audio.currentTime;
      if (name === 'eat' || name === 'gag' || name === 'splat' || name === 'kettle' || name === 'hat') {
        music.duck(.39, .37);
      } else if (name === 'clear' || name === 'rush') {
        music.duck(.58, .25);
      }
      if (name === 'collect') {
        const hz = frequency(67 + height % 13);
        tone(hz,t,.12,'triangle',.18,130);
        tone(hz * 1.5,t+.033,.12,'sine',.08);
      } else if (name === 'rush' || name === 'combo') {
        const notes = name === 'rush' ? [72,76,79,84,88] : [74,79,86];
        for (const [i,note] of notes.entries()) {
          tone(frequency(note),t+i*.048,.26,'triangle',.14);
        }
      } else if (name === 'coin') {
        tone(950,t,.10,'sine',.18,180);
        tone(1427,t+.055,.18,'triangle',.11);
      } else if (name === 'digestCut') {
        tone(633,t,.074,'triangle',.15,440);
        tone(190+Math.min(height,48)*2.4,t+.012,.13,'sine',.14,-72);
      } else if (name === 'digestFloat') {
        tone(404,t,.24,'sine',.12,350);
      } else if (name === 'digestBubble') {
        tone(515,t,.097,'sine',.21,-360);
        tone(875,t+.022,.14,'triangle',.085,300);
      } else if (name === 'digestPop') {
        const base=frequency(68+height*4);
        for (let i=0;i<3;i++) tone(base*(1+i*.21),t+i*.035,.13,'sine',.11,130);
      } else if (name === 'digestStep') {
        tone(322+height*128,t,.18,'sine',.13,220);
        tone(621+height*97,t+.059,.22,'triangle',.075,170);
      } else if (name === 'digestClear') {
        music.duck(.59,.32);
        for(const [i,note] of [69,72,76,81,88].entries()) tone(frequency(note),t+i*.055,.29,'triangle',.14);
      } else if (name === 'flip') {
        tone(235,t,.18,'triangle',.11,540);
      } else if (name === 'air') {
        tone(804,t,.12,'sine',.12,265);
        tone(1281,t+.043,.13,'triangle',.069);
      } else if (name === 'ticket') {
        for(const [i,note] of [76,79,83,88].entries()) tone(frequency(note),t+i*.05,.22,'triangle',.11);
      } else if (name === 'shield') {
        tone(303,t,.16,'triangle',.13,-113);
        tone(518,t+.03,.15,'sine',.11,85);
      } else if (name === 'hit') {
        tone(175,t,.25,'sawtooth',.10,-120);
      } else if (name === 'clear') {
        const stabs = [[0, [65,69,74]], [.135, [67,71,76]], [.33, [65,72,77,81]]];
        for (const [delay, chord] of stabs) {
          tone(frequency(chord[0] - 24), t+delay, .20, 'triangle', .17, -11);
          for (const note of chord) tone(frequency(note), t+delay, .27, 'triangle', .039, 9);
        }
      } else if (name === 'gag') {
        tone(188,t,.28,'triangle',.19,-112);
        tone(113,t+.23,.24,'sine',.14,-59);
      } else if (name === 'splat') {
        for(const [i,note] of [138,184,88,122,71].entries()) tone(note,t+i*.063,.19,'triangle',.12,-46);
      } else if (name === 'kettle') {
        tone(296,t,.56,'sine',.20,756);
        tone(425,t+.18,.42,'triangle',.069,513);
      } else if (name === 'hat') {
        tone(126,t,.22,'triangle',.22,-63);
        tone(488,t+.033,.24,'sine',.14,420);
        tone(292,t+.10,.33,'sawtooth',.061,-148);
      } else if (name === 'eat') {
        tone(99,t,.17,'triangle',.19,-40);
        tone(130,t+.13,.20,'triangle',.17,-60);
        tone(115,t+.27,.18,'triangle',.15,-56);
      } else if (name === 'start') {
        tone(height ? 430 : 780,t,.15,'triangle',.22);
      }
    },
    update(nextMode) {
      mode = nextMode;
      if (audio) music.update(mode, !muted && audio.state === 'running');
    },
  };
}
