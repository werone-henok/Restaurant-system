// Sound Notification Engine for Chefs, Waiters & Staff
// Uses Web Audio API synthesized tones (zero external audio file latency / 100% offline capable)

export type SoundProfileId = 
  | 'kitchen_bell' 
  | 'loud_buzzer' 
  | 'marimba' 
  | 'double_ding' 
  | 'high_siren' 
  | 'gentle_chime';

export interface SoundProfileMeta {
  id: SoundProfileId;
  nameEn: string;
  nameAm: string;
  descriptionEn: string;
  descriptionAm: string;
  icon: string;
  recommendedFor: 'chef' | 'waiter' | 'both';
}

export const SOUND_PROFILES: SoundProfileMeta[] = [
  {
    id: 'kitchen_bell',
    nameEn: 'Kitchen Bell (Classic)',
    nameAm: 'የኩሽና ደወል (ክላሲክ)',
    descriptionEn: 'Crisp, resonant dual metallic bell chimes (880Hz & 1320Hz)',
    descriptionAm: 'ግልጽ እና የሚያስተጋባ የኩሽና ደወል ድምፅ',
    icon: '🛎️',
    recommendedFor: 'both'
  },
  {
    id: 'loud_buzzer',
    nameEn: 'Industrial Loud Buzzer',
    nameAm: 'ከፍተኛ የኢንዱስትሪ ባዘር (ለሼፍ የሚመከር)',
    descriptionEn: 'Penetrating triple pulse to cut through sizzling grills & exhaust fans',
    descriptionAm: 'በከፍተኛ የኩሽና ጩኸት ውስጥ እንኳን በግልጽ የሚሰማ ከፍተኛ ባዘር',
    icon: '🚨',
    recommendedFor: 'chef'
  },
  {
    id: 'marimba',
    nameEn: 'Marimba Harmony',
    nameAm: 'ማሪምባ ዜማ (ለአስተናጋጅ የሚመከር)',
    descriptionEn: 'Elegant 4-note ascending musical chord (Pleasant for dining areas)',
    descriptionAm: 'ለደንበኞች የማይረብሽ ደስ የሚል 4-ደረጃ የሙዚቃ ዜማ',
    icon: '🎵',
    recommendedFor: 'waiter'
  },
  {
    id: 'double_ding',
    nameEn: 'High Double Ding',
    nameAm: 'ድርብ ፒንግ ደወል',
    descriptionEn: 'Two rapid, sharp high-frequency alerts (1200Hz - 1500Hz)',
    descriptionAm: 'ሁለት ፈጣንና ከፍተኛ የደወል ቃጭሎች',
    icon: '🔔',
    recommendedFor: 'both'
  },
  {
    id: 'high_siren',
    nameEn: 'Urgent Dual-Tone Alert',
    nameAm: 'አስቸኳይ ከፍተኛ የማስጠንቀቂያ ድምፅ',
    descriptionEn: 'Oscillating two-tone alert impossible to miss when away from screen',
    descriptionAm: 'ከመሣሪያው ርቀው ሲሆኑ በቀላሉ የሚያስጠነቅቅ ድምፅ',
    icon: '📢',
    recommendedFor: 'both'
  },
  {
    id: 'gentle_chime',
    nameEn: 'Soft Ambient Tone',
    nameAm: 'ለስላሳ ቻይም',
    descriptionEn: 'Smooth sine wave chime for calm service areas',
    descriptionAm: 'ለስላሳና ረጋ ያለ ድምፅ',
    icon: '✨',
    recommendedFor: 'waiter'
  }
];

export interface SoundSettings {
  enabled: boolean;
  profile: SoundProfileId;
  volume: number; // 0 to 100
  repeatCount: number; // 1, 2, or 3 times
  vibrate: boolean;
  voiceAnnounce: boolean;
}

const DEFAULT_CHEF_SETTINGS: SoundSettings = {
  enabled: true,
  profile: 'loud_buzzer',
  volume: 90,
  repeatCount: 2,
  vibrate: true,
  voiceAnnounce: false
};

const DEFAULT_WAITER_SETTINGS: SoundSettings = {
  enabled: true,
  profile: 'marimba',
  volume: 85,
  repeatCount: 2,
  vibrate: true,
  voiceAnnounce: false
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function getSoundSettings(role: 'chef' | 'waiter' | 'general'): SoundSettings {
  if (typeof window === 'undefined') {
    return role === 'chef' ? DEFAULT_CHEF_SETTINGS : DEFAULT_WAITER_SETTINGS;
  }
  const key = `pos_sound_settings_${role}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return { ...(role === 'chef' ? DEFAULT_CHEF_SETTINGS : DEFAULT_WAITER_SETTINGS), ...JSON.parse(saved) };
    }
  } catch {
    // Ignore JSON errors
  }
  return role === 'chef' ? DEFAULT_CHEF_SETTINGS : DEFAULT_WAITER_SETTINGS;
}

export function saveSoundSettings(role: 'chef' | 'waiter' | 'general', settings: Partial<SoundSettings>): SoundSettings {
  const current = getSoundSettings(role);
  const updated: SoundSettings = { ...current, ...settings };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`pos_sound_settings_${role}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }
  return updated;
}

/**
 * Synthesizes a single pass of the selected sound profile
 */
function synthesizeProfile(ctx: AudioContext, profile: SoundProfileId, volumeGain: number): number {
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(volumeGain, now);
  masterGain.connect(ctx.destination);

  let duration = 0.5;

  switch (profile) {
    case 'kitchen_bell': {
      // Crisp metallic double chime (880Hz -> 1320Hz)
      duration = 0.75;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.7, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.5);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.12);
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.setValueAtTime(0.8, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.75);
      break;
    }

    case 'loud_buzzer': {
      // Heavy penetrating industrial triple pulse for noisy kitchens (sawtooth + square mix)
      duration = 0.65;
      const pulses = [0, 0.22, 0.44];
      pulses.forEach((startTime) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now + startTime);
        osc.frequency.linearRampToValueAtTime(480, now + startTime + 0.14);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.setValueAtTime(0.9, now + startTime);
        gain.gain.linearRampToValueAtTime(0.001, now + startTime + 0.14);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + startTime);
        osc.stop(now + startTime + 0.15);
      });
      break;
    }

    case 'marimba': {
      // Pleasant 4-note ascending chord (C5-E5-G5-C6)
      duration = 0.7;
      const notes = [
        { f: 523.25, t: 0 },
        { f: 659.25, t: 0.1 },
        { f: 783.99, t: 0.2 },
        { f: 1046.50, t: 0.3 }
      ];
      notes.forEach(({ f, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + t);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.setValueAtTime(0.75, now + t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.38);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + t);
        osc.stop(now + t + 0.4);
      });
      break;
    }

    case 'double_ding': {
      // High twin dings (1200Hz & 1600Hz)
      duration = 0.6;
      [0, 0.15].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? 1200 : 1600, now + offset);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.setValueAtTime(0.85, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.4);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.42);
      });
      break;
    }

    case 'high_siren': {
      // Alternating 2-tone alert
      duration = 0.65;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(1050, now + 0.15);
      osc.frequency.setValueAtTime(800, now + 0.3);
      osc.frequency.setValueAtTime(1050, now + 0.45);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.setValueAtTime(0.5, now + 0.55);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.65);
      break;
    }

    case 'gentle_chime': {
      // Soft ambient sine chime
      duration = 0.8;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.3);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.8);
      break;
    }
  }

  return duration;
}

/**
 * Triggers full sound notification according to saved or provided settings
 */
export async function triggerNotificationSound(
  role: 'chef' | 'waiter' | 'general',
  overrideSettings?: Partial<SoundSettings>,
  announcementText?: string
) {
  const settings = { ...getSoundSettings(role), ...overrideSettings };
  if (!settings.enabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // Audio autoplay policy might block if no user interaction yet
      return;
    }
  }

  const volumeGain = Math.max(0.05, Math.min(1.0, (settings.volume / 100) * 0.9));
  const repeats = Math.max(1, Math.min(4, settings.repeatCount || 1));

  // Vibrate mobile device if supported
  if (settings.vibrate && typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {
      // Ignore
    }
  }

  // Play repeated chimes
  for (let i = 0; i < repeats; i++) {
    const singleDuration = synthesizeProfile(ctx, settings.profile, volumeGain);
    if (i < repeats - 1) {
      // Pause gap between repeats
      await new Promise(r => setTimeout(r, (singleDuration + 0.3) * 1000));
    }
  }

  // Voice announcement if enabled
  if (settings.voiceAnnounce && announcementText && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(announcementText);
        utterance.rate = 1.0;
        utterance.volume = volumeGain;
        window.speechSynthesis.speak(utterance);
      }, 300);
    } catch {
      // Ignore
    }
  }
}

/**
 * Quick test preview for the settings modal
 */
export function previewSound(settings: SoundSettings) {
  triggerNotificationSound('general', settings, 'Test notification preview');
}
