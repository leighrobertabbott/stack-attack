"""Compose and render the six original Stack Attack instrumentals.

The score is MIDI events, rendered with an installed General MIDI soundfont.
The deployed game plays the finished mixes and has no MIDI dependencies.
"""

import argparse
import base64
import ctypes
import ctypes.util
from dataclasses import dataclass
from pathlib import Path
import subprocess
import wave

import numpy as np
from scipy.signal import sosfilt, butter


ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
BARS = 16


@dataclass(frozen=True)
class Score:
    slug: str
    title: str
    bpm: int
    seed: int
    chords: tuple
    bass: tuple
    hook: tuple
    lead_program: int
    break_steps: tuple
    swing: float


MINOR9 = (15, 19, 22, 26)
MAJOR9 = (16, 19, 23, 26)
THIRTEEN = (16, 22, 26, 33)
SHARP9 = (16, 22, 27, 31)

SCORES = (
    Score("toast-rush", "Toast Rush", 112, 1977,
          ((40, MINOR9), (45, THIRTEEN), (38, MAJOR9), (40, SHARP9)),
          ((0,0,2.4),(3,12,1.2),(5,7,1.8),(8,10,1.4),(10,12,1.1),(12,0,2.1),(15,10,.7)),
          ((1,31,1.5),(4,34,1.25),(7,36,2.1),(11,31,1.25),(13,27,1.2)),
          61,(0,3,7,10,14),.093),
    Score("midnight-munch", "Midnight Munch", 102, 71,
          ((37, MINOR9), (40, MAJOR9), (42, THIRTEEN), (44, SHARP9)),
          ((0,0,3),(4,7,1.6),(7,12,1.0),(9,10,2),(12,7,1.9),(15,2,.8)),
          ((2,27,2.1),(6,31,2.7),(10,34,1.25),(12,33,1.2),(15,26,.75)),
          65,(0,6,9,13),.107),
    Score("breakfast-break", "Breakfast Break", 108, 613,
          ((41, MINOR9), (46, MINOR9), (37, MAJOR9), (36, SHARP9)),
          ((0,0,2.8),(4,7,1.2),(6,12,1.3),(8,3,1.6),(11,7,1.2),(13,0,1.8),(15,10,.6)),
          ((0,29,1.1),(3,31,1.65),(6,27,1.3),(9,36,2),(13,34,1.42)),
          7,(0,5,8,11,15),.132),
    Score("matchday-strut", "Matchday Strut", 116, 362,
          ((43, MINOR9), (48, THIRTEEN), (39, MAJOR9), (38, SHARP9)),
          ((0,0,2),(3,7,1.1),(5,10,1.6),(7,12,.8),(9,0,2.1),(12,5,1.1),(14,7,1.2)),
          ((1,31,1.3),(4,34,1.2),(6,36,1.5),(9,36,1.7),(12,34,1.4),(14,31,1.1)),
          56,(0,4,6,8,11,14),.070),
    Score("dino-shuffle", "Dino Shuffle", 105, 991,
          ((45, MINOR9), (38, THIRTEEN), (43, MAJOR9), (40, SHARP9)),
          ((0,0,2.6),(3,12,1.0),(5,7,2),(8,0,1.9),(11,10,1.2),(13,7,1.5),(15,5,.6)),
          ((1,31,1.45),(4,34,1.4),(7,27,1.7),(10,33,1.3),(12,31,1.1),(15,26,.6)),
          12,(0,3,8,10,14),.119),
    Score("flux-funk", "Flux Funk", 121, 88,
          ((38, MINOR9), (43, MINOR9), (46, MAJOR9), (45, SHARP9)),
          ((0,0,1.7),(2,12,1.1),(4,0,1.8),(7,10,.8),(8,0,1.8),(10,12,1.2),(12,7,1.8),(15,12,.64)),
          ((0,34,1.2),(3,38,1.5),(6,41,1.55),(9,36,1.2),(12,38,1.3),(14,34,1.1)),
          62,(0,4,8,12),.048),
)


class MidiRenderer:
    def __init__(self, soundfont):
        library = ctypes.util.find_library("fluidsynth")
        self.lib = ctypes.CDLL(library or "libfluidsynth.so.3")
        pointer = ctypes.c_void_p
        integer = ctypes.c_int
        double = ctypes.c_double
        float_pointer = ctypes.POINTER(ctypes.c_float)

        def bind(name, result, *arguments):
            fn = getattr(self.lib, name)
            fn.restype = result
            fn.argtypes = arguments
            return fn

        self.delete_settings = bind("delete_fluid_settings", None, pointer)
        self.delete_synth = bind("delete_fluid_synth", None, pointer)
        self.note_on = bind("fluid_synth_noteon", integer, pointer, integer, integer, integer)
        self.note_off = bind("fluid_synth_noteoff", integer, pointer, integer, integer)
        self.control = bind("fluid_synth_cc", integer, pointer, integer, integer, integer)
        self.select = bind("fluid_synth_program_select", integer, pointer, integer, integer, integer, integer)
        self.write = bind("fluid_synth_write_float", integer, pointer, integer, float_pointer, integer, integer,
                          float_pointer, integer, integer)
        self.settings = bind("new_fluid_settings", pointer)()
        set_num = bind("fluid_settings_setnum", integer, pointer, ctypes.c_char_p, double)
        set_int = bind("fluid_settings_setint", integer, pointer, ctypes.c_char_p, integer)
        set_num(self.settings, b"synth.sample-rate", RATE)
        set_num(self.settings, b"synth.gain", .58)
        set_int(self.settings, b"synth.polyphony", 128)
        set_int(self.settings, b"synth.chorus.active", 0)
        set_int(self.settings, b"synth.reverb.active", 0)
        self.synth = bind("new_fluid_synth", pointer, pointer)(self.settings)
        load = bind("fluid_synth_sfload", integer, pointer, ctypes.c_char_p, integer)
        self.soundfont = load(self.synth, str(soundfont).encode(), 1)
        if self.soundfont < 0:
            raise RuntimeError(f"Could not read soundfont {soundfont}")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.delete_synth(self.synth)
        self.delete_settings(self.settings)

    def render(self, events, samples, lead):
        programs = {
            0:(36, 64, 107), 1:(7, 41, 80), 2:(4, 77, 84), 3:(28, 92, 77),
            4:(lead, 60, 81), 5:(61, 83, 83), 6:(11, 26, 58), 9:(0, 64, 110),
        }
        for channel, (program, pan, volume) in programs.items():
            bank = 128 if channel == 9 else 0
            self.select(self.synth, channel, self.soundfont, bank, program)
            self.control(self.synth, channel, 10, pan)
            self.control(self.synth, channel, 7, volume)
        pcm = np.zeros((samples, 2), dtype=np.float32)
        cursor = 0

        def advance(target):
            if target <= 0:
                return
            data = pcm[cursor:].ctypes.data_as(ctypes.POINTER(ctypes.c_float))
            self.write(self.synth, target, data, 0, 2, data, 1, 2)

        for position, channel, note, velocity in events:
            position = min(samples, max(cursor, position))
            advance(position - cursor)
            cursor = position
            if velocity:
                self.note_on(self.synth, channel, note, velocity)
            else:
                self.note_off(self.synth, channel, note)
        advance(samples - cursor)
        return pcm


def compose(score, bars):
    rng = np.random.default_rng(score.seed)
    events, kicks, claps = [], [], []
    tick = 60 / score.bpm / 4

    def at(bar, step):
        return (bar * 16 + step + (score.swing if step % 2 else 0)) * tick

    def play(channel, note, start, duration, velocity, exact=False):
        when = max(0, int((start + (0 if exact else rng.uniform(-.005, .005))) * RATE))
        force = int(np.clip(velocity + rng.uniform(-4, 4), 1, 127))
        events.append((when, channel, int(note), force))
        events.append((when + int(duration * RATE), channel, int(note), 0))

    for bar in range(bars):
        root, voicing = score.chords[bar % 4]
        chorus = bar % 8 in (2, 3, 6, 7)
        turnaround = bar % 4 == 3
        stripped = bar == 8
        for step in score.break_steps:
            if stripped and step not in (0, 8):
                continue
            start = at(bar, step)
            strength = 104 if step in (0, 8) else 91
            play(9,36,start,.093,strength,exact=step==0)
            kicks.append((start,strength / 109))
        for step in (4, 12):
            start = at(bar,step) + .011
            play(9,38,start,.10,109)
            play(9,39,start+.015,.096,65)
            claps.append(start+.006)
        if not stripped:
            for step in (3, 10, 15):
                play(9,40,at(bar,step)-.004,.063,28+(step==15)*8)
        for step in range(16):
            if (step+bar*2) % 11 == 9:
                continue
            opened = step in ((6, 14) if score.slug == "flux-funk" else (10, 14))
            play(9,46 if opened else 42,at(bar,step),.13 if opened else .044,
                 73 if opened else (64 if step % 4 == 2 else 42 if step % 2 else 55))
        if turnaround:
            for step, note in ((13,45),(14,47),(15,50)):
                play(9,note,at(bar,step),.098,66+3*(step-13))
        if bar % 8 == 0:
            play(9,49,at(bar,0),.65,73)
        if score.slug == 'dino-shuffle':
            for step, note in ((1,64),(5,63),(7,62),(9,64),(13,63),(15,62)):
                play(9,note,at(bar,step),.103,70 if step % 4 == 1 else 49)
        elif score.slug in ('matchday-strut', 'flux-funk'):
            play(9,54,at(bar,6),.128,56)
            play(9,56 if score.slug == 'matchday-strut' else 54,at(bar,14),.175,62)
        elif score.slug == 'breakfast-break':
            play(9,70,at(bar,6),.12,52)
            play(9,75,at(bar,11),.08,40)

        for step, interval, length in score.bass:
            if stripped and step not in (0, 8, 12):
                continue
            play(0,root+interval,at(bar,step),length*tick,
                 (112 if step in (0, 8) else 91) - (6 if interval >= 10 else 0))
        if turnaround:
            following = score.chords[(bar+1)%4][0]
            play(0,following-1,at(bar,15)+tick*.42,.049,69)

        skanks = (2, 5, 8, 11, 14) if chorus else (2, 6, 9, 13)
        if score.slug == "breakfast-break":
            skanks = (1, 4, 7, 10, 14)
        for step in skanks:
            for voice, interval in enumerate(voicing):
                if voice == 0 and step % 3:
                    continue
                play(1,root+interval,at(bar,step)+voice*.0035,tick*(1.25 if chorus else .93),
                     (80 if step in (5, 9, 14) else 65)-voice*3)
        if not stripped:
            for step in (1, 4, 7, 10, 13, 15):
                for n in (voicing[1], voicing[-1]):
                    play(3,root+n,at(bar,step)-.007,tick*.58,48+(step%3)*6)
        for step in (0, 9):
            for voice, interval in enumerate(voicing):
                play(2,root+interval,at(bar,step)+voice*.006,tick*(4.2 if step==0 else 4),
                     64-voice*3+(5 if chorus else 0))

        if bar % 2 == 0 or chorus:
            phrase = score.hook if (bar % 2 == 0 or bar % 8 == 3) else score.hook[2:]
            for step, interval, length in phrase:
                transposition = -12 if score.lead_program in (65, 7) and root+interval>79 else 0
                pitch = root+interval+transposition
                play(4,pitch,at(bar,step),tick*length,81+(step%4)*3)
                if chorus and (step%3!=0 or score.slug=='matchday-strut'):
                    play(5,pitch-7,at(bar,step)+.006,tick*length*.90,72)
                if chorus and step in (1,4,7,12,14):
                    play(5,pitch-12,at(bar,step)+.010,tick*length,67)
        if score.slug in ("midnight-munch","dino-shuffle") or (bar % 4 == 3):
            for step, voice in ((5,2),(7,0),(11,3),(15,1)):
                play(6,root+voicing[voice]+12,at(bar,step),tick*.89,48+12*(step==15))
    events.sort(key=lambda event:(event[0], bool(event[3])))
    return events, kicks, claps


def master(score, bars, soundfont):
    samples = round(RATE * bars * 4 * 60 / score.bpm)
    events, kicks, claps = compose(score, bars)
    with MidiRenderer(soundfont) as renderer:
        audio = renderer.render(events, samples, score.lead_program)

    # Blend a short synthesized kick and handclap beneath the sampled kit.
    t = np.arange(round(RATE * .225)) / RATE
    kick = np.sin(2 * np.pi * (49*t + 73*.021*(1-np.exp(-t/.021)))) * np.exp(-t*17)
    kick *= np.minimum(1, t/.0014) * .091
    rng=np.random.default_rng(score.seed)
    noise=sosfilt(butter(2,[900,6900],btype="bandpass",fs=RATE,output="sos"),rng.normal(0,1,len(t)))
    envelope=sum(np.exp(-np.maximum(0,t-delay)*rate)*(t>=delay)
                 for delay,rate in ((0,170),(.009,155),(.018,48)))
    clap=noise*envelope*.038

    def layer(waveform, time, gain, stereo):
        start=round(time*RATE)
        length=min(len(waveform),samples-start)
        if length>0:
            audio[start:start+length] += waveform[:length,None]*gain*stereo

    for time, gain in kicks:
        layer(kick,time,gain,(1,1))
    for bar, time in enumerate(claps):
        layer(clap,time,1,(1.12,.88) if bar%2 else (.88,1.12))

    filtered=sosfilt(butter(2,32,fs=RATE,btype="highpass",output="sos"),audio,axis=0)
    # A small stereo room with wrapped tails keeps the boundary loopable.
    room=filtered.copy()
    for delay, strength in ((.019,.075),(.034,.058),(.051,.035),(.083,.018)):
        room += np.roll(filtered[:,::-1],round(delay*RATE),axis=0)*strength
    rms=np.sqrt(np.mean(room**2))
    shaped=np.tanh(room*.155/max(rms,1e-6))
    shaped *= min(1,.88/max(np.max(np.abs(shaped)),.01))
    edge=round(.005*RATE)
    shaped[:edge] *= np.linspace(0,1,edge)[:,None]
    shaped[-edge:] *= np.linspace(1,0,edge)[:,None]
    return shaped


def wav(path, pcm):
    with wave.open(str(path),"wb") as file:
        file.setnchannels(2)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes((pcm*32766).astype("<i2").tobytes())


def mp3(source, target, name, bitrate="112k"):
    subprocess.run([
        "ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(source),
        "-c:a","libmp3lame","-b:a",bitrate,
        "-metadata","title="+name,"-metadata","artist=Stack Attack!",
        "-metadata","album=Tidal Diner Funk",str(target),
    ],check=True)


def main():
    cli=argparse.ArgumentParser()
    cli.add_argument("--soundfont",type=Path,default=Path("/usr/share/sounds/sf2/TimGM6mb.sf2"))
    cli.add_argument("--scratch",type=Path,required=True)
    cli.add_argument("--album",type=Path)
    args=cli.parse_args()
    args.scratch.mkdir(parents=True,exist_ok=True)
    target=ROOT/"dist"/"music"
    target.mkdir(exist_ok=True)
    masters=[]
    for score in SCORES:
        pcm=master(score,BARS,args.soundfont)
        masters.append(pcm)
        raw=args.scratch/(score.slug+".wav")
        wav(raw,pcm)
        mp3(raw,target/(score.slug+".mp3"),score.title)
        print(f"{score.title} · {score.bpm} BPM · {len(pcm)/RATE:.2f} seconds",flush=True)

    fallback_wav=args.scratch/"fallback.wav"
    fallback_mp3=args.scratch/"fallback.mp3"
    wav(fallback_wav,master(SCORES[0],8,args.soundfont))
    mp3(fallback_wav,fallback_mp3,"Toast Rush (Short Loop)","96k")
    encoded=base64.b64encode(fallback_mp3.read_bytes()).decode("ascii")
    wrapped="\n  + ".join("'" + encoded[i:i+100] + "'" for i in range(0,len(encoded),100))
    (target/"fallback.js").write_text(
        "// Generated by scripts/compose-soundtrack.py.\nexport const backing = "+wrapped+";\n",encoding="utf-8",
    )

    if args.album:
        mix=masters[0]
        size=round(.52*RATE)
        blend=np.linspace(0,1,size)[:,None]
        for following in masters[1:]:
            overlap=mix[-size:]*(1-blend)+following[:size]*blend
            mix=np.concatenate((mix[:-size],overlap,following[size:]))
        mix[:size] *= blend
        mix[-size:] *= 1-blend
        raw=args.scratch/"album.wav"
        wav(raw,mix)
        mp3(raw,args.album,"Tidal Diner Funk – Stack Attack Original Soundtrack","160k")


if __name__ == "__main__":
    main()
