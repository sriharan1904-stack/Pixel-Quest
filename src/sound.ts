/**
 * Retro Synth Sound FX & Music Engine using Web Audio API
 */

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private activeBgmOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];
  private bgmTimeout: any = null;
  private currentBgmType: 'world' | 'boss' | 'menu' | null = null;
  private lastNoteTime: number = 0;

  constructor() {
    // Lazy initialisation on first interaction
    this.muted = localStorage.getItem('pq_muted') === 'true';
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('pq_muted', String(this.muted));
    if (this.muted) {
      this.stopBGM();
    } else {
      if (this.currentBgmType) {
        this.playBGM(this.currentBgmType);
      }
    }
    return this.muted;
  }

  // Plays a simple coin ding
  playCoin() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(987.77, t); // B5 note
      osc.frequency.setValueAtTime(1318.51, t + 0.08); // E6 note
      
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.35);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // Classic jump pitch sweep
  playJump() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
      
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.18);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // Swoosh dash noise or triangle pitch sweep
  playDash() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
      
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.12);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // Power Up sweep
  playPowerUp() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
      const dur = 0.05;
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + idx * dur);
        
        gain.gain.setValueAtTime(0.04, t + idx * dur);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * dur + 0.15);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        
        osc.start(t + idx * dur);
        osc.stop(t + idx * dur + 0.15);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // Harsh damage crunch
  playDamage() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.linearRampToValueAtTime(80, t + 0.25);
      
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.25);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // Shield break sound - high crystalline crash
  playShieldBreak() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(1500, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.3);
      
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.3);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // Triumph arpeggio
  playVictory() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      
      const chord = [261.63, 329.63, 392.00, 523.25]; // C E G C
      chord.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.setValueAtTime(freq * 1.5, t + 0.3);
        
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8 + idx * 0.1);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        
        osc.start(t);
        osc.stop(t + 0.8 + idx * 0.1);
      });
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // Loops a chiptune melody in the background
  playBGM(type: 'world' | 'boss' | 'menu') {
    this.currentBgmType = type;
    if (this.muted) return;
    
    try {
      this.init();
      if (!this.ctx) return;
      
      this.stopBGM();
      
      let step = 0;
      let tempo = 135; // BPM
      let beatDuration = 60 / tempo / 2; // eighth notes
      
      // Infinite sequence scheduler
      const scheduleMelody = () => {
        if (this.muted || !this.ctx) return;
        
        const nextTime = this.ctx.currentTime;
        
        // Let's create beautiful retro 8-bit sound loops
        // Menu BGM: Happy, breezy retro arpeggios
        // World BGM: Nostalgic, groovy, driving baseline
        // Boss BGM: Tense, urgent, heavy pulses
        
        let melodyNode: OscillatorNode | null = null;
        let melodyGain: GainNode | null = null;
        let bassNode: OscillatorNode | null = null;
        let bassGain: GainNode | null = null;

        if (type === 'menu') {
          // Melodic sequence: C, G, A, F, C, G...
          const melody = [523.25, 392.00, 440.00, 349.23, 523.25, 392.00, 440.00, 587.33];
          const bass = [130.81, 130.81, 196.00, 196.00, 220.00, 220.00, 174.61, 174.61];
          const beat = step % 8;
          
          if (beat % 2 === 0) {
            melodyNode = this.ctx.createOscillator();
            melodyGain = this.ctx.createGain();
            melodyNode.type = 'triangle';
            melodyNode.frequency.setValueAtTime(melody[beat], nextTime);
            melodyGain.gain.setValueAtTime(0.03, nextTime);
            melodyGain.gain.exponentialRampToValueAtTime(0.001, nextTime + beatDuration * 1.8);
            melodyNode.connect(melodyGain);
            melodyGain.connect(this.ctx.destination);
            melodyNode.start(nextTime);
            melodyNode.stop(nextTime + beatDuration * 1.8);
            this.activeBgmOscillators.push({ osc: melodyNode, gain: melodyGain });
          }
          
          if (step % 2 === 0) {
            bassNode = this.ctx.createOscillator();
            bassGain = this.ctx.createGain();
            bassNode.type = 'sawtooth';
            bassNode.frequency.setValueAtTime(bass[step % 8], nextTime);
            bassGain.gain.setValueAtTime(0.02, nextTime);
            bassGain.gain.exponentialRampToValueAtTime(0.001, nextTime + beatDuration * 1.8);
            bassNode.connect(bassGain);
            bassGain.connect(this.ctx.destination);
            bassNode.start(nextTime);
            bassNode.stop(nextTime + beatDuration * 1.8);
            this.activeBgmOscillators.push({ osc: bassNode, gain: bassGain });
          }
        } else if (type === 'world') {
          // Energetic platformer melody in Pentatonic Major
          const melody = [392.00, 440.00, 523.25, 587.33, 659.25, 587.33, 523.25, 440.00];
          const bass = [130.81, 164.81, 196.00, 220.00, 130.81, 164.81, 196.00, 110.00];
          const beat = step % 8;
          
          if (beat === 0 || beat === 3 || beat === 5 || beat === 6) {
            melodyNode = this.ctx.createOscillator();
            melodyGain = this.ctx.createGain();
            melodyNode.type = 'triangle';
            melodyNode.frequency.setValueAtTime(melody[beat], nextTime);
            melodyGain.gain.setValueAtTime(0.03, nextTime);
            melodyGain.gain.exponentialRampToValueAtTime(0.001, nextTime + beatDuration * 1.5);
            melodyNode.connect(melodyGain);
            melodyGain.connect(this.ctx.destination);
            melodyNode.start(nextTime);
            melodyNode.stop(nextTime + beatDuration * 1.5);
            this.activeBgmOscillators.push({ osc: melodyNode, gain: melodyGain });
          }
          
          // Groovy continuous bassline
          bassNode = this.ctx.createOscillator();
          bassGain = this.ctx.createGain();
          bassNode.type = 'square';
          bassNode.frequency.setValueAtTime(bass[step % 8], nextTime);
          bassGain.gain.setValueAtTime(0.015, nextTime);
          bassGain.gain.exponentialRampToValueAtTime(0.001, nextTime + beatDuration * 0.95);
          bassNode.connect(bassGain);
          bassGain.connect(this.ctx.destination);
          bassNode.start(nextTime);
          bassNode.stop(nextTime + beatDuration * 0.95);
          this.activeBgmOscillators.push({ osc: bassNode, gain: bassGain });
        } else if (type === 'boss') {
          // Intense frantic chromatic notes
          const melody = [293.66, 311.13, 329.63, 349.23, 293.66, 311.13, 329.63, 220.00];
          const bass = [73.42, 73.42, 82.41, 82.41, 87.31, 87.31, 65.41, 65.41];
          const beat = step % 8;
          
          melodyNode = this.ctx.createOscillator();
          melodyGain = this.ctx.createGain();
          melodyNode.type = 'sawtooth';
          melodyNode.frequency.setValueAtTime(melody[beat] * 1.5, nextTime);
          melodyGain.gain.setValueAtTime(0.02, nextTime);
          melodyGain.gain.exponentialRampToValueAtTime(0.001, nextTime + beatDuration * 0.8);
          melodyNode.connect(melodyGain);
          melodyGain.connect(this.ctx.destination);
          melodyNode.start(nextTime);
          melodyNode.stop(nextTime + beatDuration * 0.8);
          this.activeBgmOscillators.push({ osc: melodyNode, gain: melodyGain });
          
          bassNode = this.ctx.createOscillator();
          bassGain = this.ctx.createGain();
          bassNode.type = 'square';
          bassNode.frequency.setValueAtTime(bass[step % 8], nextTime);
          bassGain.gain.setValueAtTime(0.025, nextTime);
          bassGain.gain.exponentialRampToValueAtTime(0.001, nextTime + beatDuration * 0.8);
          bassNode.connect(bassGain);
          bassGain.connect(this.ctx.destination);
          bassNode.start(nextTime);
          bassNode.stop(nextTime + beatDuration * 0.8);
          this.activeBgmOscillators.push({ osc: bassNode, gain: bassGain });
        }
        
        step++;
        // Garbage collect old stopped nodes
        this.activeBgmOscillators = this.activeBgmOscillators.filter(item => {
          return item.osc.frequency.value > 0; // standard filter
        });
        
        this.bgmTimeout = setTimeout(scheduleMelody, beatDuration * 1000);
      };
      
      scheduleMelody();
    } catch (e) {
      console.warn('BGM scheduling error', e);
    }
  }

  stopBGM() {
    if (this.bgmTimeout) {
      clearTimeout(this.bgmTimeout);
      this.bgmTimeout = null;
    }
    this.activeBgmOscillators.forEach(item => {
      try {
        item.osc.stop();
      } catch (e) {}
    });
    this.activeBgmOscillators = [];
  }
}

export const sound = new RetroAudioEngine();
