// SoundManager: Web Audio API procedural synthesizer for retro sound effects and looping music
(function() {
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.musicPlaying = false;
      this.musicInterval = null;
      this.tempo = 120; // BPM
      this.step = 0;
      this.masterVolume = 0.5;
      
      this.chordProgression = [0, 1, 2, 3]; // Am, F, C, G progression
      this.chordIndex = 0;
      this.currentBassFreq = 220.00;
      this.melodyPattern = [];

      this.chords = [
        [220.00, 261.63, 329.63, 440.00], // Am (A3, C4, E4, A4)
        [174.61, 220.00, 261.63, 349.23], // F (F3, A3, C4, F4)
        [130.81, 164.81, 196.00, 261.63], // C (C3, E3, G3, C4)
        [196.00, 246.94, 293.66, 392.00]  // G (G3, B3, D4, G4)
      ];
    }

    init() {
      if (this.ctx) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    toggleMusic() {
      this.init();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      if (this.musicPlaying) {
        this.stopMusic();
      } else {
        this.startMusic();
      }
    }

    startMusic() {
      this.musicPlaying = true;
      const stepDuration = 60 / this.tempo / 2; // Eighth notes
      
      this.musicInterval = setInterval(() => {
        this.playMusicStep();
      }, stepDuration * 1000);
      
      const btn = document.getElementById('btn-toggle-music');
      if (btn) {
        btn.innerText = "🎵 Music: On";
        btn.classList.add('active');
      }
    }

    stopMusic() {
      this.musicPlaying = false;
      if (this.musicInterval) {
        clearInterval(this.musicInterval);
        this.musicInterval = null;
      }
      const btn = document.getElementById('btn-toggle-music');
      if (btn) {
        btn.innerText = "🎵 Music: Off";
        btn.classList.remove('active');
      }
    }

    playMusicStep() {
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const now = this.ctx.currentTime;

      const barStep = this.step % 16;
      if (barStep === 0) {
        // Next chord in progression!
        this.chordIndex = (this.chordIndex + 1) % this.chordProgression.length;
        const chordNotes = this.chords[this.chordProgression[this.chordIndex]];
        
        // Bass note is the root note (first note of the chord)
        this.currentBassFreq = chordNotes[0];

        // Mathematically generate a new improvised melody pattern for this bar!
        this.melodyPattern = [];
        for (let i = 0; i < 16; i++) {
          if (Math.random() > 0.4) {
            // Pick a random note from the chord's pentatonic options
            this.melodyPattern.push(chordNotes[Math.floor(Math.random() * chordNotes.length)]);
          } else {
            this.melodyPattern.push(null);
          }
        }
      }

      // Play bass note on beats 1, 5, 9, 13
      if (barStep % 4 === 0) {
        // Bass frequency is played one octave lower (half frequency) (increased base vol to 0.15)
        this.playTone(this.currentBassFreq / 2, 'sawtooth', 0.15, 0.4, now);
      }

      // Play improvised melody note (increased base vol to 0.08)
      const noteFreq = this.melodyPattern[barStep];
      if (noteFreq) {
        this.playTone(noteFreq, 'triangle', 0.08, 0.2, now);
      }

      this.step++;
    }

    playTone(freq, type, volume, duration, startTime) {
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        const finalVolume = volume * this.masterVolume;
        gain.gain.setValueAtTime(finalVolume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      } catch (e) {
        console.warn("SoundManager playTone error:", e);
      }
    }

    setVolume(value) {
      this.masterVolume = Math.max(0, Math.min(1, parseFloat(value)));
    }

    playClick() {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const now = this.ctx.currentTime;
      this.playTone(600, 'sine', 0.08, 0.05, now);
    }

    playBeep() {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const now = this.ctx.currentTime;
      this.playTone(800, 'sine', 0.05, 0.08, now);
    }

    playPlaceBet() {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const now = this.ctx.currentTime;
      this.playTone(400, 'sine', 0.08, 0.05, now);
      this.playTone(600, 'sine', 0.08, 0.05, now + 0.04);
    }

    playRemoveBet() {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const now = this.ctx.currentTime;
      this.playTone(600, 'sine', 0.08, 0.05, now);
      this.playTone(400, 'sine', 0.08, 0.05, now + 0.04);
    }

    playSpin() {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const now = this.ctx.currentTime;
      // Procedural sweep down frequency to simulate a spin click
      let t = now;
      for (let i = 0; i < 15; i++) {
        const freq = 800 - i * 40;
        this.playTone(freq, 'square', 0.02, 0.03, t);
        t += 0.08 + i * 0.01;
      }
    }

    playDice() {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const now = this.ctx.currentTime;
      // Tumbling noise
      for (let i = 0; i < 6; i++) {
        const freq = 100 + Math.random() * 200;
        this.playTone(freq, 'triangle', 0.1, 0.08, now + i * 0.07);
      }
    }

    playWin() {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const now = this.ctx.currentTime;
      // C-major arpeggio: C4, E4, G4, C5
      const notes = [261.63, 329.63, 392.00, 523.25];
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'square', 0.04, 0.25, now + idx * 0.08);
      });
    }

    playLose() {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const now = this.ctx.currentTime;
      // Sad downward sweep
      const notes = [392.00, 311.13, 261.63]; // G4, Eb4, C4
      notes.forEach((freq, idx) => {
        this.playTone(freq, 'sawtooth', 0.04, 0.35, now + idx * 0.12);
      });
    }

    playSlotsSpin() {
      this.init();
      if (!this.ctx || this.ctx.state === 'suspended') return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < 8; i++) {
        const freq = 300 + (i % 3) * 100;
        this.playTone(freq, 'square', 0.03, 0.06, now + i * 0.1);
      }
    }
  }

  window.Casino.SoundManager = new SoundManager();
})();
