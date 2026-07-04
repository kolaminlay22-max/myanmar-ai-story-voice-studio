export interface VoiceStyle {
  id: string;
  name: string;
  burmeseName: string;
  description: string;
  icon: string;
  defaultVoice: "Kore" | "Fenrir" | "Puck" | "Charon" | "Zephyr";
  defaultSpeed: number;
  defaultWarmth: number;
  defaultEmotion: number;
  promptGuideline: string;
}

export interface VoiceModelOption {
  id: "Kore" | "Fenrir" | "Puck" | "Charon" | "Zephyr";
  name: string;
  gender: "Female" | "Male";
  description: string;
}

export interface OptimizationResult {
  optimizedText: string;
  changes: string[];
  storytellingTips: string;
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
}

export interface SavedProject {
  id: string;
  title: string;
  text: string;
  optimizedText: string;
  timestamp: string;
  voiceName: "Kore" | "Fenrir" | "Puck" | "Charon" | "Zephyr";
  styleId: string;
  speed: number;
  pitch: number;
  pauseStrength: string;
  emotionLevel: number;
  expressiveness: number;
  voiceWarmth: number;
  useSmartNarration: boolean;
  masteringActive: boolean;
  audioUrl?: string;
}

