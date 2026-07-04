import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Copy, 
  Trash2, 
  RefreshCw, 
  Sliders, 
  Check, 
  Wand2, 
  BookOpen, 
  Music, 
  HelpCircle, 
  Info, 
  Layers, 
  Settings, 
  AlertCircle,
  Cpu,
  Flame,
  Heart,
  CloudRain,
  Wind,
  Mic,
  Activity,
  Smile,
  Download,
  Clock,
  Plus,
  Search,
  FolderClosed,
  ListPlus,
  Play,
  Pause,
  Loader2
} from "lucide-react";

import Header from "./components/Header";
import AudioVisualizer from "./components/AudioVisualizer";
import OptimizationBreakdown from "./components/OptimizationBreakdown";
import AudioPlayerControls from "./components/AudioPlayerControls";
import VoiceCard from "./components/VoiceCard";

import { VOICE_STYLES, VOICE_MODELS, SAMPLE_SCRIPTS } from "./data";
import { VoiceStyle, VoiceModelOption, OptimizationResult, SavedProject } from "./types";
import { 
  analyzeBurmeseTextV4, 
  verifyPauseSafety, 
  optimizeBurmeseTextV2, 
  validateTextForTts, 
  masterAudio 
} from "./utils/voiceEngine";

export default function App() {
  // --- Workspace Editor State ---
  const [text, setText] = useState<string>(SAMPLE_SCRIPTS[0].text);
  const [optimizedText, setOptimizedText] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [useSmartNarration, setUseSmartNarration] = useState<boolean>(true);

  // --- Version 2: Mode & Batch States ---
  const [editorMode, setEditorMode] = useState<"single" | "batch">("single");
  const [batchScripts, setBatchScripts] = useState<string[]>([""]);
  const [batchProgress, setBatchProgress] = useState<{
    id: string;
    text: string;
    status: "idle" | "optimizing" | "synthesizing" | "completed" | "failed";
    progress: number;
    error?: string;
    audioUrl?: string;
  }[]>([]);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  // --- Version 2: Live Progress & Messages ---
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [activeProgressMessage, setActiveProgressMessage] = useState<string>("");

  // --- Version 2: Projects Directory ---
  const [projects, setProjects] = useState<SavedProject[]>(() => {
    try {
      const saved = localStorage.getItem("myanmar_voice_projects_v2");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>("");
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");

  // --- Version 2: Quota Reset Timer ---
  const [resetCountdown, setResetCountdown] = useState<string>("");

  useEffect(() => {
    try {
      localStorage.setItem("myanmar_voice_projects_v2", JSON.stringify(projects));
    } catch (e) {
      console.error(e);
    }
  }, [projects]);

  // Quota countdown ticking
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diffMs = midnight.getTime() - now.getTime();
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffMs % (1000 * 60)) / 1000);
      setResetCountdown(`${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Smart Narration & Cache State ---
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [lastOptimizedText, setLastOptimizedText] = useState<string>("");
  const [lastOptimizedStyle, setLastOptimizedStyle] = useState<string>("");
  const [dailyRequestCount, setDailyRequestCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("burmese_speech_daily_count");
      if (saved) {
        const parsed = JSON.parse(saved);
        const todayStr = new Date().toDateString();
        if (parsed.date === todayStr) {
          return parsed.count || 0;
        }
      }
    } catch (e) {
      console.error("Failed to read daily request count:", e);
    }
    return 0;
  });

  const audioCacheRef = useRef<Record<string, {
    url: string;
    blob: Blob;
    optimizationResult: OptimizationResult | null;
    optimizedText: string;
  }>>({});

  const makeCacheKey = (
    textVal: string,
    voiceVal: string,
    styleVal: string,
    speedVal: number,
    pitchVal: number,
    useSmartNarrationVal: boolean,
    pauseStrengthVal: string,
    emotionLevelVal: number,
    expressivenessVal: number,
    voiceWarmthVal: number,
    masteringActiveVal: boolean
  ) => {
    const normText = textVal.trim().replace(/\s+/g, " ");
    return `${normText}_${voiceVal}_${styleVal}_${speedVal}_${pitchVal}_${useSmartNarrationVal}_${pauseStrengthVal}_${emotionLevelVal}_${expressivenessVal}_${voiceWarmthVal}_${masteringActiveVal}`;
  };

  const incrementDailyCount = () => {
    setDailyRequestCount(prev => {
      const newCount = prev + 1;
      try {
        localStorage.setItem("burmese_speech_daily_count", JSON.stringify({
          date: new Date().toDateString(),
          count: newCount
        }));
      } catch (e) {
        console.error(e);
      }
      return newCount;
    });
  };

  // --- Voice Parameter Controls ---
  const [selectedStyle, setSelectedStyle] = useState<VoiceStyle>(VOICE_STYLES[0]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<"Kore" | "Fenrir" | "Puck" | "Charon" | "Zephyr">("Charon");
  const [speed, setSpeed] = useState<number>(0.95);
  const [pitch, setPitch] = useState<number>(1.0);
  const [pauseStrength, setPauseStrength] = useState<string>("Natural");
  const [emotionLevel, setEmotionLevel] = useState<number>(0.7);
  const [expressiveness, setExpressiveness] = useState<number>(0.8);
  const [voiceWarmth, setVoiceWarmth] = useState<number>(0.8);
  const [autoTune, setAutoTune] = useState<boolean>(true);

  // --- Run Human Voice Engine v4 Analysis ---
  const textToAnalyze = useSmartNarration ? (optimizedText || text) : text;
  const v4Analysis = analyzeBurmeseTextV4(textToAnalyze, selectedStyle.defaultSpeed);
  const pauseSafety = verifyPauseSafety(textToAnalyze);
  const pauseQuality = pauseSafety.isSafe ? 98 : 65;
  const estSpeechSecs = textToAnalyze.trim() ? Math.max(1, Math.round(textToAnalyze.trim().replace(/\s+/g, "").length / 5.5)) : 0;
  const estSpeechTimeStr = textToAnalyze.trim() 
    ? `${Math.floor(estSpeechSecs / 60)}:${(estSpeechSecs % 60).toString().padStart(2, "0")} (~${estSpeechSecs}s)`
    : "0:00 (0s)";

  useEffect(() => {
    if (autoTune && textToAnalyze.trim()) {
      setSpeed(v4Analysis.narrationSpeed);
      setPitch(v4Analysis.pitchAdjustment);
      setVoiceWarmth(v4Analysis.prosodyLevel.warmth);
      setEmotionLevel(v4Analysis.prosodyLevel.emotionLevel);
      setExpressiveness(v4Analysis.prosodyLevel.expressiveness);
      setPauseStrength(v4Analysis.prosodyLevel.pauseStrength);
    }
  }, [autoTune, textToAnalyze, selectedStyle, useSmartNarration]);

  // --- Voice History & Presets State ---
  const [voiceHistory, setVoiceHistory] = useState<{
    id: string;
    timestamp: string;
    textSnippet: string;
    title?: string;
    voice: string;
    speed: number;
    style: string;
    emotion: number;
    duration?: string;
    audioUrl: string;
  }[]>(() => {
    try {
      const saved = localStorage.getItem("myanmar_voice_history_v5");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  const [projectPresets, setProjectPresets] = useState<{
    id: string;
    name: string;
    styleId: string;
    voiceName: "Kore" | "Fenrir" | "Puck" | "Charon" | "Zephyr";
    speed: number;
    pitch: number;
    pauseStrength: string;
    emotionLevel: number;
    expressiveness: number;
    voiceWarmth: number;
  }[]>(() => {
    try {
      const saved = localStorage.getItem("myanmar_voice_presets_v5");
      return saved ? JSON.parse(saved) : [
        {
          id: "preset-storytelling",
          name: "Storytelling",
          styleId: "story-narrator",
          voiceName: "Charon" as const,
          speed: 0.95,
          pitch: 1.0,
          pauseStrength: "Natural",
          emotionLevel: 0.7,
          expressiveness: 0.8,
          voiceWarmth: 0.8
        },
        {
          id: "preset-documentary",
          name: "Documentary",
          styleId: "documentary",
          voiceName: "Zephyr" as const,
          speed: 1.05,
          pitch: 1.0,
          pauseStrength: "Natural",
          emotionLevel: 0.3,
          expressiveness: 0.5,
          voiceWarmth: 0.5
        },
        {
          id: "preset-sad-story",
          name: "Sad Story",
          styleId: "sad",
          voiceName: "Charon" as const,
          speed: 0.85,
          pitch: 0.95,
          pauseStrength: "Dramatic",
          emotionLevel: 0.85,
          expressiveness: 0.8,
          voiceWarmth: 0.6
        },
        {
          id: "preset-romantic",
          name: "Romantic",
          styleId: "warm-female",
          voiceName: "Kore" as const,
          speed: 0.95,
          pitch: 1.0,
          pauseStrength: "Natural",
          emotionLevel: 0.65,
          expressiveness: 0.75,
          voiceWarmth: 0.9
        },
        {
          id: "preset-horror",
          name: "Horror",
          styleId: "whisper",
          voiceName: "Fenrir" as const,
          speed: 0.8,
          pitch: 0.85,
          pauseStrength: "Dramatic",
          emotionLevel: 0.9,
          expressiveness: 0.9,
          voiceWarmth: 0.4
        },
        {
          id: "preset-dhamma",
          name: "Dhamma",
          styleId: "calm-male",
          voiceName: "Fenrir" as const,
          speed: 0.90,
          pitch: 0.95,
          pauseStrength: "Natural",
          emotionLevel: 0.4,
          expressiveness: 0.5,
          voiceWarmth: 0.7
        }
      ];
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  const [newPresetName, setNewPresetName] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("myanmar_voice_history_v5", JSON.stringify(voiceHistory));
    } catch (e) {
      console.error(e);
    }
  }, [voiceHistory]);

  const filteredHistory = voiceHistory.filter(item => {
    const q = historySearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      item.textSnippet.toLowerCase().includes(q) ||
      item.voice.toLowerCase().includes(q) ||
      (item.style && item.style.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    try {
      localStorage.setItem("myanmar_voice_presets_v5", JSON.stringify(projectPresets));
    } catch (e) {
      console.error(e);
    }
  }, [projectPresets]);

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset = {
      id: "preset-" + Date.now(),
      name: newPresetName.trim(),
      styleId: selectedStyle.id,
      voiceName: selectedVoiceName,
      speed,
      pitch,
      pauseStrength,
      emotionLevel,
      expressiveness,
      voiceWarmth
    };
    setProjectPresets(prev => [...prev, newPreset]);
    setNewPresetName("");
  };

  const handleLoadPreset = (preset: typeof projectPresets[0]) => {
    const matchedStyle = VOICE_STYLES.find(s => s.id === preset.styleId);
    if (matchedStyle) setSelectedStyle(matchedStyle);
    setSelectedVoiceName(preset.voiceName);
    setSpeed(preset.speed);
    setPitch(preset.pitch);
    setPauseStrength(preset.pauseStrength);
    setEmotionLevel(preset.emotionLevel);
    setExpressiveness(preset.expressiveness);
    setVoiceWarmth(preset.voiceWarmth);
    setAutoTune(false);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectPresets(prev => prev.filter(p => p.id !== id));
  };

  // --- Version 2 Helpers and Handlers ---
  const getScriptTitle = (textStr: string) => {
    const matchedSample = SAMPLE_SCRIPTS.find(s => s.text.trim() === textStr.trim());
    if (matchedSample) return matchedSample.title;
    const clean = textStr.trim();
    if (clean.length <= 25) return clean;
    return clean.substring(0, 25) + "...";
  };

  const autoSaveProject = (textVal: string, optTextVal: string, audioUrlVal?: string) => {
    if (!textVal.trim()) return;

    const title = getScriptTitle(textVal);
    const matchedIndex = projects.findIndex(
      p => p.text.trim() === textVal.trim() && 
           p.voiceName === selectedVoiceName && 
           p.styleId === selectedStyle.id
    );

    const updatedSettings = {
      voiceName: selectedVoiceName,
      styleId: selectedStyle.id,
      speed,
      pitch,
      pauseStrength,
      emotionLevel,
      expressiveness,
      voiceWarmth,
      useSmartNarration,
      masteringActive
    };

    const timestampStr = `${new Date().toLocaleDateString([], { month: "short", day: "numeric" })}, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    if (matchedIndex !== -1) {
      setProjects(prev => {
        const copy = [...prev];
        copy[matchedIndex] = {
          ...copy[matchedIndex],
          optimizedText: optTextVal,
          timestamp: timestampStr,
          audioUrl: audioUrlVal || copy[matchedIndex].audioUrl,
          ...updatedSettings
        };
        return copy;
      });
    } else {
      const newProj: SavedProject = {
        id: "proj-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        title,
        text: textVal,
        optimizedText: optTextVal,
        timestamp: timestampStr,
        audioUrl: audioUrlVal,
        ...updatedSettings
      };
      setProjects(prev => [newProj, ...prev].slice(0, 30));
    }
  };

  const startProgressSimulation = (textLength: number) => {
    setGenerationProgress(0);
    setActiveProgressMessage("Analyzing Burmese syllables & checking safety...");
    const estTimeMs = Math.max(3000, Math.min(8000, textLength * 50));
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(97, Math.floor((elapsed / estTimeMs) * 100));
      setGenerationProgress(pct);
      
      if (pct < 30) {
        setActiveProgressMessage("Analyzing Burmese syllables & checking safety...");
      } else if (pct < 70) {
        setActiveProgressMessage("Synthesizing native voice phonemes via Gemini...");
      } else if (pct < 90) {
        setActiveProgressMessage("Applying acoustic mastering & wave limits...");
      } else {
        setActiveProgressMessage("Finalizing high fidelity audio render...");
      }
    }, 100);
    
    return interval;
  };

  const handleBatchGenerateSpeech = async () => {
    const scriptsToGenerate = batchScripts.filter(s => s.trim().length > 0);
    if (scriptsToGenerate.length === 0) {
      setError("Please add at least one script to batch generate.");
      return;
    }

    if (dailyRequestCount >= 10) {
      setError("Daily free quota limit reached. Cannot start batch generation.");
      return;
    }

    setIsBatchGenerating(true);
    setError(null);
    
    const tasks = scriptsToGenerate.map((scr, idx) => ({
      id: "batch-" + idx + "-" + Date.now(),
      text: scr,
      status: "idle" as const,
      progress: 0,
    }));
    setBatchProgress(tasks);

    let quotaCurrent = dailyRequestCount;

    for (let i = 0; i < tasks.length; i++) {
      if (quotaCurrent >= 10) {
        setBatchProgress(prev => prev.map((t, idx) => idx === i ? { ...t, status: "failed" as const, error: "Quota limit reached during batch process" } : t));
        continue;
      }

      const task = tasks[i];
      setBatchProgress(prev => prev.map((t, idx) => idx === i ? { ...t, status: useSmartNarration ? "optimizing" as const : "synthesizing" as const, progress: 10 } : t));

      let textToUse = task.text;

      try {
        if (useSmartNarration) {
          const preprocessedText = optimizeBurmeseTextV2(task.text);
          const optimizeRes = await fetch("/api/optimize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: preprocessedText,
              style: selectedStyle.name,
              voiceDetails: selectedStyle.promptGuideline
            }),
          });

          if (optimizeRes.ok) {
            const optResult: OptimizationResult = await optimizeRes.json();
            textToUse = optResult.optimizedText;
            setBatchProgress(prev => prev.map((t, idx) => idx === i ? { ...t, status: "synthesizing" as const, progress: 40 } : t));
          }
          quotaCurrent++;
          incrementDailyCount();
        }

        const ttsRes = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: textToUse,
            style: selectedStyle.name,
            voiceName: selectedVoiceName,
            speed: speed,
            pitch: pitch,
            pauseStrength: pauseStrength,
            emotionLevel: emotionLevel,
            expressiveness: expressiveness,
            voiceWarmth: voiceWarmth,
            useSmartNarration: useSmartNarration
          }),
        });

        if (!ttsRes.ok) {
          const errData = await ttsRes.json();
          throw new Error(errData.error || "Speech synthesis failed");
        }

        const audioBlob = await ttsRes.blob();
        let finalAudioBlob = audioBlob;
        if (masteringActive) {
          finalAudioBlob = await masterAudio(audioBlob, true);
        }
        const localUrl = URL.createObjectURL(finalAudioBlob);
        quotaCurrent++;
        incrementDailyCount();

        const snippet = textToUse.length > 32 ? textToUse.substring(0, 32).trim() + "..." : textToUse.trim();
        let durationStr = "0:02";
        try {
          const tempAudio = new Audio(localUrl);
          await new Promise((resolve) => {
            tempAudio.addEventListener("loadedmetadata", () => {
              const m = Math.floor(tempAudio.duration / 60);
              const s = Math.floor(tempAudio.duration % 60).toString().padStart(2, "0");
              durationStr = `${m}:${s}`;
              resolve(null);
            }, { once: true });
            tempAudio.addEventListener("error", () => resolve(null), { once: true });
            setTimeout(() => resolve(null), 1000);
          });
        } catch (e) {
          console.error(e);
        }

        const newHistoryEntry = {
          id: "hist-batch-" + Date.now() + "-" + i,
          timestamp: `${new Date().toLocaleDateString([], { month: "short", day: "numeric" })}, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          textSnippet: snippet,
          title: `Batch [${i+1}] - ` + getScriptTitle(task.text),
          voice: selectedVoiceName,
          speed: speed,
          style: selectedStyle.name,
          emotion: emotionLevel,
          duration: durationStr,
          audioUrl: localUrl
        };
        setVoiceHistory(prev => [newHistoryEntry, ...prev].slice(0, 20));

        autoSaveProject(task.text, useSmartNarration ? textToUse : "", localUrl);

        setBatchProgress(prev => prev.map((t, idx) => idx === i ? { 
          ...t, 
          status: "completed" as const, 
          progress: 100, 
          audioUrl: localUrl 
        } : t));

      } catch (err: any) {
        console.error("Error in batch item", i, err);
        setBatchProgress(prev => prev.map((t, idx) => idx === i ? { 
          ...t, 
          status: "failed" as const, 
          error: err.message || "Synthesis failed" 
        } : t));
      }
    }

    setIsBatchGenerating(false);
  };

  const handleLoadProject = (project: SavedProject) => {
    setText(project.text);
    setOptimizedText(project.optimizedText);
    setSelectedVoiceName(project.voiceName);
    const matchedStyle = VOICE_STYLES.find(s => s.id === project.styleId);
    if (matchedStyle) setSelectedStyle(matchedStyle);
    setSpeed(project.speed);
    setPitch(project.pitch);
    setPauseStrength(project.pauseStrength);
    setEmotionLevel(project.emotionLevel);
    setExpressiveness(project.expressiveness);
    setVoiceWarmth(project.voiceWarmth);
    setUseSmartNarration(project.useSmartNarration);
    setMasteringActive(project.masteringActive);
    setAutoTune(false);
    if (project.audioUrl) {
      setAudioUrl(project.audioUrl);
    }
    setEditorMode("single");
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  // --- Generation Pipeline State ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [generationStep, setGenerationStep] = useState<"idle" | "optimizing" | "synthesizing" | "ready">("idle");
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);
  const [masteringActive, setMasteringActive] = useState<boolean>(true);

  // --- Custom Audio Engine State ---
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Apply voice preset settings when voice style is changed ---
  const handleSelectStyle = (style: VoiceStyle) => {
    setSelectedStyle(style);
    setSelectedVoiceName(style.defaultVoice);
    setSpeed(style.defaultSpeed);
    setVoiceWarmth(style.defaultWarmth);
    setEmotionLevel(style.defaultEmotion);
    // Reset output when switching configurations
    setAudioUrl(null);
    setOptimizationResult(null);
    setOptimizedText("");
    setError(null);
  };

  // --- Handle copy text ---
  const handleCopy = () => {
    navigator.clipboard.writeText(optimizedText || optimizationResult?.optimizedText || text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Handle clear text ---
  const handleClear = () => {
    setText("");
    setOptimizedText("");
    setAudioUrl(null);
    setOptimizationResult(null);
    setError(null);
  };

  // --- Audio Event Listeners & Ref lifecycle ---
  useEffect(() => {
    if (!audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.volume = volume;
    audio.playbackRate = playbackRate;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    // Play once loaded
    audio.play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        console.warn("Audio autoplay blocked or failed:", err);
      });

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  // Sync real-time volume & speed sliders to active Audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // --- Player handlers passed to controls deck ---
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error(err));
    }
  };

  const handleStop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `mandalay_voice_${selectedStyle.id}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // --- AI Script Optimization (Punctuation, breathing, spelling numbers) ---
  const handleOptimizeScript = async () => {
    // Run pre-flight quality check validation
    const quality = validateTextForTts(text);
    if (!quality.isValid) {
      setError(quality.warnings[0]);
      return null;
    }
    if (quality.warnings.length > 0) {
      setTtsWarning(quality.warnings[0]);
    } else {
      setTtsWarning(null);
    }

    // Automatically pre-process with Burmese Optimizer V2
    const preprocessedText = optimizeBurmeseTextV2(text);

    // Smart Optimization Check: Only run once per text/style combination
    if (
      preprocessedText === lastOptimizedText &&
      selectedStyle.name === lastOptimizedStyle &&
      optimizedText &&
      optimizedText.trim() !== ""
    ) {
      console.log("SMART CHIP: Reusing existing script optimization. Skipping redundant API call.");
      return optimizedText;
    }

    setIsOptimizing(true);
    setError(null);
    setGenerationStep("optimizing");

    try {
      const optimizeRes = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: preprocessedText,
          style: selectedStyle.name,
          voiceDetails: selectedStyle.promptGuideline
        }),
      });

      if (!optimizeRes.ok) {
        const errData = await optimizeRes.json();
        throw new Error(errData.error || "Optimization step failed");
      }

      const optResult: OptimizationResult = await optimizeRes.json();
      setOptimizationResult(optResult);
      setOptimizedText(optResult.optimizedText);
      setLastOptimizedText(preprocessedText);
      setLastOptimizedStyle(selectedStyle.name);
      incrementDailyCount(); // Count this successful optimization request
      setGenerationStep("idle");
      return optResult.optimizedText;
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during optimization.");
      setGenerationStep("idle");
      return null;
    } finally {
      setIsOptimizing(false);
    }
  };

  // --- Full Audio Production Pipe ---
  const handleGenerateSpeech = async () => {
    // One-click generate safety: ignore extra clicks if already running
    if (isGenerating || isOptimizing) {
      setError("Generation already in progress.");
      return;
    }

    let textToUse = text;

    if (useSmartNarration) {
      textToUse = optimizedText;
      if (!textToUse || textToUse.trim() === "") {
        if (!text || text.trim() === "") {
          setError("ကျေးဇူးပြု၍ စာသားတစ်ခုခု ရိုက်ထည့်ပေးပါ။ (Please enter some text)");
          return;
        }
        
        // Auto-optimize first if optimizedText is empty
        const autoOptText = await handleOptimizeScript();
        if (!autoOptText) return;
        textToUse = autoOptText;
      }
    } else {
      if (!text || text.trim() === "") {
        setError("ကျေးဇူးပြု၍ စာသားတစ်ခုခု ရိုက်ထည့်ပေးပါ။ (Please enter some text)");
        return;
      }
    }

    // Run pre-flight quality check validation
    const quality = validateTextForTts(textToUse);
    if (!quality.isValid) {
      setError(quality.warnings[0]);
      return;
    }
    if (quality.warnings.length > 0) {
      setTtsWarning(quality.warnings[0]);
    } else {
      setTtsWarning(null);
    }

    // Voice Cache Lookup
    const cacheKey = makeCacheKey(
      textToUse,
      selectedVoiceName,
      selectedStyle.name,
      speed,
      pitch,
      useSmartNarration,
      pauseStrength,
      emotionLevel,
      expressiveness,
      voiceWarmth,
      masteringActive
    );

    if (audioCacheRef.current[cacheKey]) {
      console.log("CACHE HIT: Loading audio from local memory cache!");
      const cached = audioCacheRef.current[cacheKey];
      setAudioUrl(cached.url);
      setOptimizationResult(cached.optimizationResult);
      if (useSmartNarration) {
        setOptimizedText(cached.optimizedText);
      }
      setLoadedFromCache(true);
      setError(null);
      setGenerationStep("ready");
      
      // Auto-dismiss the cached notice toast after 4 seconds
      setTimeout(() => {
        setLoadedFromCache(false);
      }, 4000);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);
    setGenerationStep("synthesizing");
    const progressInterval = startProgressSimulation(textToUse.length);

    try {
      // Speech Synthesis via Gemini TTS Engine
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToUse,
          style: selectedStyle.name,
          voiceName: selectedVoiceName,
          speed: speed,
          pitch: pitch,
          pauseStrength: pauseStrength,
          emotionLevel: emotionLevel,
          expressiveness: expressiveness,
          voiceWarmth: voiceWarmth,
          useSmartNarration: useSmartNarration
        }),
      });

      if (!ttsRes.ok) {
        const errData = await ttsRes.json();
        throw new Error(errData.error || "Speech synthesis failed");
      }

      const audioBlob = await ttsRes.blob();
      
      // Apply DSP mastering chain
      let finalAudioBlob = audioBlob;
      if (masteringActive) {
        console.log("AUDIO MASTERING ENGINE: Enhancing sound, applying soft limiter...");
        finalAudioBlob = await masterAudio(audioBlob, true);
      }
      const localUrl = URL.createObjectURL(finalAudioBlob);
      
      // Save to cache
      audioCacheRef.current[cacheKey] = {
        url: localUrl,
        blob: finalAudioBlob,
        optimizationResult: optimizationResult,
        optimizedText: textToUse
      };
      
      incrementDailyCount(); // Increment usage counter since we consumed a TTS API call
      setAudioUrl(localUrl);
      setGenerationStep("ready");

      // Auto Save to project!
      autoSaveProject(text, textToUse, localUrl);

      // Append to Voice History timeline
      const snippet = textToUse.length > 32 ? textToUse.substring(0, 32).trim() + "..." : textToUse.trim();
      
      // Measure audio duration
      let durationStr = "0:02";
      try {
        const tempAudio = new Audio(localUrl);
        await new Promise((resolve) => {
          tempAudio.addEventListener("loadedmetadata", () => {
            const m = Math.floor(tempAudio.duration / 60);
            const s = Math.floor(tempAudio.duration % 60).toString().padStart(2, "0");
            durationStr = `${m}:${s}`;
            resolve(null);
          }, { once: true });
          tempAudio.addEventListener("error", () => resolve(null), { once: true });
          setTimeout(() => resolve(null), 1250);
        });
      } catch (e) {
        console.error("Error measuring duration:", e);
      }

      const newHistoryEntry = {
        id: "hist-" + Date.now(),
        timestamp: `${new Date().toLocaleDateString([], { month: "short", day: "numeric" })}, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        textSnippet: snippet,
        title: getScriptTitle(textToUse),
        voice: selectedVoiceName,
        speed: speed,
        style: selectedStyle.name,
        emotion: emotionLevel,
        duration: durationStr,
        audioUrl: localUrl
      };
      setVoiceHistory(prev => [newHistoryEntry, ...prev].slice(0, 15));

      // End progress successfully
      clearInterval(progressInterval);
      setGenerationProgress(100);
      setActiveProgressMessage("Voice synthesis and mastering complete!");
      setTimeout(() => {
        setGenerationProgress(0);
        setActiveProgressMessage("");
      }, 1000);

    } catch (err: any) {
      console.error(err);
      clearInterval(progressInterval);
      setGenerationProgress(0);
      setActiveProgressMessage("");
      setError(err.message || "An unexpected error occurred during audio generation.");
      setGenerationStep("idle");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080415] text-purple-100 flex flex-col font-sans">
      <Header />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Production Workspace (Lg: cols 7) */}
        <section className="lg:col-span-7 flex flex-col gap-5 w-full">
          
          {/* Live Progress Bar for Speech Generation */}
          {generationProgress > 0 && (
            <div className="rounded-2xl border border-purple-500/30 bg-[#120D2B]/95 p-5 shadow-[0_0_20px_rgba(139,92,246,0.3)] animate-pulse flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-xs font-semibold text-purple-200 uppercase tracking-wider">
                    {activeProgressMessage || "Processing Audio Pipeline..."}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-purple-400">
                  {generationProgress}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-purple-950/40 rounded-full overflow-hidden border border-purple-900/30">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Card 1: Original Text Input Editor */}
          <div className="rounded-2xl border border-purple-900/30 bg-[#110C24]/90 backdrop-blur-md p-5 flex flex-col gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            <div className="flex flex-col gap-3 border-b border-purple-900/10 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-purple-200">
                    1. Original Burmese Script
                  </h2>
                </div>
                
                <span className="text-xs font-mono text-purple-300/40">
                  INPUT CHARS: <b className="text-purple-300">{text.length}</b>
                </span>
              </div>

              {/* Mode Toggles */}
              <div className="flex gap-4 mt-1 border-t border-purple-900/5 pt-2">
                <button
                  onClick={() => setEditorMode("single")}
                  className={`pb-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                    editorMode === "single"
                      ? "border-purple-500 text-purple-200 font-extrabold"
                      : "border-transparent text-purple-400/60 hover:text-purple-300"
                  }`}
                >
                  Single Script Mode
                </button>
                <button
                  onClick={() => setEditorMode("batch")}
                  className={`pb-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                    editorMode === "batch"
                      ? "border-purple-500 text-purple-200 font-extrabold"
                      : "border-transparent text-purple-400/60 hover:text-purple-300"
                  }`}
                >
                  Batch Mode ({batchScripts.length} scripts)
                </button>
              </div>
            </div>

            {editorMode === "single" ? (
              <>
                {/* Original Text Area */}
                <div className="relative">
                  <textarea
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setOptimizedText(""); // reset optimized text on typing so they re-optimize
                      setError(null);
                    }}
                    placeholder="မြန်မာစကားပြေ သို့မဟုတ် ပုံပြင်စာသားများကို ဤနေရာတွင် ရေးသားပါ..."
                    className="w-full h-44 bg-[#0A0516]/90 border border-purple-950 rounded-xl p-4 text-sm text-purple-100 placeholder-purple-400/20 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-800 leading-relaxed resize-none font-sans"
                  />
                  
                  {text.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 text-center">
                      <p className="text-xs text-purple-300/10">
                        Type or paste a Burmese story script, or select a template below.
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick-Inject Sample Scripts Badges */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-purple-300/30 font-semibold">
                    Quick Story Templates:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_SCRIPTS.map((sample, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setText(sample.text);
                          setOptimizedText("");
                          setOptimizationResult(null);
                          setAudioUrl(null);
                          setError(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-950/20 hover:bg-purple-900/30 border border-purple-900/30 hover:border-purple-800 text-xs text-purple-300 transition-all font-sans active:scale-95"
                      >
                        💡 {sample.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card 1 Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-purple-900/10 pt-3">
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-950/20 hover:bg-red-950/40 border border-red-950/40 text-red-300 text-xs font-sans transition-all active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>

                  <button
                    disabled={isOptimizing || !text.trim()}
                    onClick={handleOptimizeScript}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all active:scale-95 ${
                      isOptimizing || !text.trim()
                        ? "bg-purple-900/30 border border-purple-800/40 text-purple-300/40 cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.35)]"
                    }`}
                  >
                    <Wand2 className={`w-4 h-4 ${isOptimizing ? "animate-spin" : ""}`} />
                    <span>{isOptimizing ? "Optimizing Script..." : "✨ Run AI Speech Optimizer"}</span>
                  </button>
                </div>
              </>
            ) : (
              /* Batch Mode Editor */
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                  {batchScripts.map((scriptText, sIdx) => (
                    <div key={sIdx} className="relative flex flex-col gap-1.5 bg-[#0A0516]/60 border border-purple-950 p-3.5 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wide">Script #{sIdx + 1}</span>
                        {batchScripts.length > 1 && (
                          <button
                            onClick={() => {
                              setBatchScripts(prev => prev.filter((_, i) => i !== sIdx));
                            }}
                            className="p-1 text-red-400/60 hover:text-red-400 transition-colors"
                            title="Delete Script"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <textarea
                        value={scriptText}
                        onChange={(e) => {
                          setBatchScripts(prev => {
                            const copy = [...prev];
                            copy[sIdx] = e.target.value;
                            return copy;
                          });
                        }}
                        placeholder="မြန်မာစကားပြေ စာသားတစ်ခု ရေးသားပါ..."
                        className="w-full h-20 bg-black/40 border border-purple-900/20 rounded-lg p-2.5 text-xs text-purple-100 placeholder-purple-400/10 focus:outline-none focus:ring-1 focus:ring-purple-500/30 leading-relaxed resize-none font-sans"
                      />
                    </div>
                  ))}
                </div>

                {/* Batch Mode Controls */}
                <div className="flex items-center justify-between border-t border-purple-900/10 pt-3">
                  <button
                    onClick={() => setBatchScripts(prev => [...prev, ""])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/30 border border-purple-900/20 text-purple-300 text-xs font-sans transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Script</span>
                  </button>
                  
                  <button
                    disabled={isBatchGenerating}
                    onClick={handleBatchGenerateSpeech}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all active:scale-95 ${
                      isBatchGenerating
                        ? "bg-purple-900/30 border border-purple-800/40 text-purple-300/40 cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.35)]"
                    }`}
                  >
                    {isBatchGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                        <span>Generating Batch...</span>
                      </>
                    ) : (
                      <>
                        <ListPlus className="w-4 h-4 text-purple-200" />
                        <span>Batch Generate ({batchScripts.filter(s => s.trim()).length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Batch Progress Dashboard Section */}
          {editorMode === "batch" && batchProgress.length > 0 && (
            <div className="rounded-2xl border border-purple-900/30 bg-[#110C24]/90 p-5 flex flex-col gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-200 flex items-center gap-2 border-b border-purple-900/10 pb-2">
                <ListPlus className="w-4 h-4 text-purple-400" />
                <span>Batch Generation Tasks</span>
              </h3>
              <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                {batchProgress.map((task, idx) => (
                  <div key={task.id} className="bg-[#0A0516]/60 border border-purple-950 p-3.5 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-300">
                        Task #{idx + 1}: <span className="text-[11px] font-mono font-normal text-purple-400">{task.text.substring(0, 30)}...</span>
                      </span>
                      <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                        task.status === "completed" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30" :
                        task.status === "failed" ? "bg-red-950/40 text-red-400 border border-red-900/30" :
                        task.status === "optimizing" ? "bg-amber-950/40 text-amber-400 border border-amber-900/30 animate-pulse" :
                        task.status === "synthesizing" ? "bg-purple-950/40 text-purple-400 border border-purple-900/30 animate-pulse" :
                        "bg-purple-950/20 text-purple-300/40 border border-purple-950/20"
                      }`}>
                        {task.status}
                      </span>
                    </div>
                    
                    {/* Micro Progress Bar */}
                    <div className="w-full h-1 bg-purple-950/40 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          task.status === "completed" ? "bg-emerald-500" :
                          task.status === "failed" ? "bg-red-500" :
                          "bg-purple-500 animate-pulse"
                        }`}
                        style={{ width: `${task.status === "completed" ? 100 : task.status === "failed" ? 100 : task.progress || 10}%` }}
                      />
                    </div>

                    {task.error && (
                      <span className="text-[10px] text-red-400 font-mono">{task.error}</span>
                    )}

                    {task.audioUrl && (
                      <div className="flex items-center justify-between mt-1 bg-black/20 p-1.5 rounded-lg">
                        <span className="text-[10px] text-purple-300/60 font-mono">Audio ready</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setAudioUrl(task.audioUrl!);
                              setIsPlaying(true);
                            }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300"
                          >
                            <Play className="w-3 h-3 text-emerald-400" />
                            <span>Play</span>
                          </button>
                          <a
                            href={task.audioUrl}
                            download={`Burmese-Voice-Batch-${idx + 1}.wav`}
                            className="flex items-center gap-1 text-[10px] font-semibold text-purple-400 hover:text-purple-300"
                          >
                            <Download className="w-3 h-3 text-purple-400" />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card 1.5: Pro v5 Quality Score Panel */}
          <div className="rounded-2xl border border-purple-500/30 bg-[#0E0724]/95 backdrop-blur-md p-5 flex flex-col gap-4 shadow-[0_0_35px_rgba(139,92,246,0.18)] transition-all">
            <div className="flex items-center justify-between border-b border-purple-900/20 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-purple-200">
                  Pro v5 Quality Score Panel
                </h2>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Active v5 Engine
              </span>
            </div>

            {/* Pro v5 Quality Score Panel - 6 Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {/* 1. Human Score */}
              <div className="rounded-xl border border-purple-950 bg-[#070313]/90 p-3 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400/40 font-semibold">
                  Human Score
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-extrabold font-mono text-emerald-400">
                    {v4Analysis.humanVoiceScore}%
                  </span>
                  <span className="text-[8px] text-purple-400 font-mono">Realism</span>
                </div>
                <div className="w-full h-1.5 bg-purple-950/40 rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${v4Analysis.humanVoiceScore}%` }}
                  />
                </div>
              </div>

              {/* 2. Naturalness */}
              <div className="rounded-xl border border-purple-950 bg-[#070313]/90 p-3 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400/40 font-semibold">
                  Naturalness
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-extrabold font-mono text-teal-400">
                    {v4Analysis.naturalnessScore}%
                  </span>
                  <span className="text-[8px] text-purple-400 font-mono">Fluency</span>
                </div>
                <div className="w-full h-1.5 bg-purple-950/40 rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${v4Analysis.naturalnessScore}%` }}
                  />
                </div>
              </div>

              {/* 3. Emotion */}
              <div className="rounded-xl border border-purple-950 bg-[#070313]/90 p-3 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400/40 font-semibold">
                  Emotion
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-extrabold font-mono text-pink-400">
                    {v4Analysis.emotionScore}%
                  </span>
                  <span className="text-[8px] text-purple-400 font-mono">Warmth</span>
                </div>
                <div className="w-full h-1.5 bg-purple-950/40 rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${v4Analysis.emotionScore}%` }}
                  />
                </div>
              </div>

              {/* 4. Rhythm */}
              <div className="rounded-xl border border-purple-950 bg-[#070313]/90 p-3 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400/40 font-semibold">
                  Rhythm
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-extrabold font-mono text-amber-400">
                    {v4Analysis.rhythmScore}%
                  </span>
                  <span className="text-[8px] text-purple-400 font-mono">Cadence</span>
                </div>
                <div className="w-full h-1.5 bg-purple-950/40 rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500"
                    style={{ width: `${v4Analysis.rhythmScore}%` }}
                  />
                </div>
              </div>

              {/* 5. Pause Quality */}
              <div className="rounded-xl border border-purple-950 bg-[#070313]/90 p-3 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400/40 font-semibold">
                  Pause Quality
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-extrabold font-mono text-cyan-400">
                    {pauseQuality}%
                  </span>
                  <span className="text-[8px] text-purple-400 font-mono">Breathing</span>
                </div>
                <div className="w-full h-1.5 bg-purple-950/40 rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-500"
                    style={{ width: `${pauseQuality}%` }}
                  />
                </div>
              </div>

              {/* 6. Estimated Speech Time */}
              <div className="rounded-xl border border-purple-950 bg-[#070313]/90 p-3 flex flex-col justify-between col-span-2 md:col-span-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400/40 font-semibold">
                  Estimated Speech Time
                </span>
                <div className="flex items-center gap-1.5 mt-2">
                  <Clock className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span className="text-xs font-bold font-mono text-purple-200">
                    {estSpeechTimeStr}
                  </span>
                </div>
              </div>
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Acoustic & Emotional Profiler */}
              <div className="rounded-xl border border-purple-950 bg-[#070313] p-4 flex flex-col gap-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400/40 font-semibold block border-b border-purple-950/50 pb-1.5">
                  Emotion AI & Acoustic Profiler
                </span>
                
                {/* Human Voice Score */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-purple-300/60 font-medium">Human Voice Score</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{v4Analysis.humanVoiceScore}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-purple-950/40 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${v4Analysis.humanVoiceScore}%` }}
                    />
                  </div>
                </div>

                {/* Emotion Score */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-purple-300/60 font-medium">Emotion Score</span>
                    <span className="text-xs font-mono font-bold text-purple-300">{v4Analysis.emotionScore}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-purple-950/40 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                      style={{ width: `${v4Analysis.emotionScore}%` }}
                    />
                  </div>
                </div>

                {/* Emotion Intensity level row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-300/60 font-medium">Emotional Intensity</span>
                  <div className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-purple-950/30 border border-purple-900/40 text-[11px] font-semibold text-purple-200">
                    <Activity className="w-3 h-3 text-purple-400" />
                    <span>{v4Analysis.intensity}</span>
                    <span className="text-[9px] font-mono text-purple-400/80">({v4Analysis.intensityScore}%)</span>
                  </div>
                </div>

                {/* Dialogue status description */}
                <p className="text-[10px] text-purple-300/50 leading-relaxed italic mt-1 bg-[#0A0516]/40 p-2 rounded border border-purple-950/40">
                  {v4Analysis.hasDialogue 
                    ? `Character Engine active: ${v4Analysis.dialogueCount} dialogues detected. Spanning soft, warm narrator delivery and highly expressive dialogue phrasings.` 
                    : "Pure narrator workflow active: Opting for a steady, cinematic, and comfortable human pace."}
                </p>
              </div>

              {/* Smart Pause & Breath Engine */}
              <div className="rounded-xl border border-purple-950 bg-[#070313] p-4 flex flex-col gap-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400/40 font-semibold block border-b border-purple-950/50 pb-1.5">
                  Smart Pause & Breath Engine
                </span>

                {/* Dynamic Speed row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-300/60 font-medium">Vocal Tempo (Base)</span>
                  <span className="text-xs font-mono font-bold text-purple-200">
                    {v4Analysis.narrationSpeed.toFixed(2)}x
                  </span>
                </div>

                {/* Natural Breathing paragraph breaks */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-300/60 font-medium">Paragraph Breath Alloc</span>
                  <span className="text-xs font-mono font-bold text-teal-400 flex items-center gap-1">
                    <Wind className="w-3 h-3 text-teal-400 animate-pulse" />
                    {v4Analysis.breathBoundaries} Natural Breaths
                  </span>
                </div>

                {/* Pause breakdown metrics */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-300/60 font-medium">Smart Pause Nodes</span>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-purple-300" title="Short pauses after commas">၊: {v4Analysis.pauseCount.commas}</span>
                    <span className="text-purple-300" title="Medium pauses after periods">။: {v4Analysis.pauseCount.periods}</span>
                    {v4Analysis.pauseCount.reveals > 0 && (
                      <span className="text-amber-400 animate-pulse" title="Dramatic reveals / pauses">Reveal: {v4Analysis.pauseCount.reveals}</span>
                    )}
                  </div>
                </div>

                {/* Pause Safety Status */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-300/60 font-medium">Pause Safety Lock</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                    pauseSafety.isSafe 
                      ? "bg-emerald-950/30 text-emerald-400 border border-emerald-950" 
                      : "bg-red-950/30 text-red-400 border border-red-950"
                  }`}>
                    {pauseSafety.isSafe ? "● Safe" : "▲ Syllable Split Warning"}
                  </span>
                </div>

                {!pauseSafety.isSafe && (
                  <p className="text-[9px] text-red-300/60 leading-tight mt-1 bg-red-950/10 p-1.5 rounded border border-red-950/20">
                    Warning: Unsafe syllables split: <code className="font-mono text-red-300">{pauseSafety.flaggedSegments.join(", ")}</code>. Auto-pacing has bypassed these splits safely.
                  </p>
                )}
              </div>

              {/* Narrative Emotional Curve Timeline */}
              <div className="md:col-span-2 rounded-xl border border-purple-500/20 bg-[#070313]/90 p-4 flex flex-col gap-3 shadow-inner">
                {/* Emotional Curve Timeline */}
                <div className="flex flex-col gap-2.5 bg-[#090418] p-3 rounded-xl border border-purple-950">
                  <span className="text-[10px] font-mono text-purple-400/80 uppercase tracking-wider">
                    Narrative Emotional Curve (v5 Progression Timeline)
                  </span>
                  <div className="flex items-center justify-between mt-1 text-[11px] overflow-x-auto py-1.5 scrollbar-thin">
                    {v4Analysis.emotionalCurve.map((state, index, arr) => (
                      <React.Fragment key={index}>
                        <div className="flex flex-col items-center gap-1.5 shrink-0 px-1">
                          <span className={`w-2.5 h-2.5 rounded-full transition-all ${
                            index === 0 
                              ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" 
                              : index === arr.length - 1 
                              ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" 
                              : "bg-purple-400"
                          }`} />
                          <span className="font-semibold text-purple-200 text-[10px] font-sans">{state}</span>
                        </div>
                        {index < arr.length - 1 && (
                          <div className="h-[2px] bg-gradient-to-r from-purple-800/40 via-purple-500/40 to-purple-800/40 grow mx-2 min-w-[24px]" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Natural Rhythm Stats */}
                <div className="flex items-center gap-2 text-[10px] text-purple-300/70 bg-purple-950/20 p-2.5 rounded-lg border border-purple-900/10 font-sans">
                  <span className="text-teal-400 font-mono font-bold uppercase shrink-0">Pacing Stat:</span>
                  <span>{v4Analysis.naturalRhythmStats}</span>
                </div>
              </div>

            </div>

            {/* Prosody tip block */}
            <div className="rounded-xl bg-purple-950/10 border border-purple-950/30 p-3">
              <div className="flex gap-2 items-start">
                <Info className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-purple-300/75 leading-relaxed font-sans">
                  {v4Analysis.prosodyTip}
                </p>
              </div>
            </div>

            {/* Telemetry Footer */}
            <div className="flex items-center justify-between text-[10px] text-purple-400/40 font-mono border-t border-purple-900/10 pt-2.5">
              <span>Pro v4 Real-time Prosody Tuning</span>
              <span>No redundant API call consumed for preview</span>
            </div>
          </div>

          {/* Card 2: Smart AI Optimized Voice Script Editor */}
          <div className="rounded-2xl border border-purple-500/30 bg-[#120D2B]/90 backdrop-blur-md p-5 flex flex-col gap-4 shadow-[0_0_25px_rgba(139,92,246,0.15)] transition-all">
            <div className="flex items-center justify-between border-b border-purple-900/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-purple-200">
                  2. Smart Optimized Voice Script
                </h2>
              </div>
              
              <span className="text-xs font-mono text-purple-300/40">
                VOICE CHARS: <b className="text-purple-300">{optimizedText.length}</b>
              </span>
            </div>

            {/* Editable Optimized Text Area */}
            <div className="relative">
              <textarea
                value={optimizedText}
                onChange={(e) => {
                  setOptimizedText(e.target.value);
                  setError(null);
                }}
                placeholder="အလိုအလျောက် သန့်စင်ပြီးသား စာသားများကို ဤနေရာတွင် ပြသမည်ဖြစ်ပြီး စိတ်ကြိုက် ပြင်ဆင်နိုင်ပါသည်။"
                className="w-full h-44 bg-[#0A0516]/95 border border-purple-500/20 rounded-xl p-4 text-sm text-purple-100 placeholder-purple-400/30 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500 leading-relaxed resize-none font-sans"
              />
              
              {!optimizedText && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center bg-[#070312]/95 rounded-xl border border-purple-950">
                  <Cpu className="w-8 h-8 text-purple-500/40 mb-2 animate-pulse" />
                  <p className="text-xs text-purple-300/50 max-w-sm leading-relaxed">
                    {useSmartNarration ? (
                      <>No optimized script yet. Click <b className="text-purple-400">"✨ Run AI Speech Optimizer"</b> above to format natural pauses, pronounce numbers properly, and build the cinematic voice script.</>
                    ) : (
                      <>Smart Narration is currently disabled. Enable <b className="text-purple-400">"Use Smart Narration Engine"</b> on the right to auto-optimize script and apply cinematic voice tuning.</>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Card 2 Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-purple-900/10 pt-3">
              <button
                disabled={!optimizedText}
                onClick={() => {
                  navigator.clipboard.writeText(optimizedText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-950/40 hover:bg-purple-900/30 border border-purple-900/20 text-purple-300 text-xs font-sans transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy Voice Script"}</span>
              </button>

              <div className="flex items-center gap-2">
                {isPlaying && (
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-200 text-xs font-semibold uppercase tracking-wider transition-all active:scale-95"
                  >
                    <span>Stop Play</span>
                  </button>
                )}

                <button
                  disabled={isGenerating || isOptimizing}
                  onClick={handleGenerateSpeech}
                  id="generate-btn"
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all active:scale-95 ${
                    isGenerating || isOptimizing
                      ? "bg-purple-900/30 border border-purple-800/40 text-purple-300/40 cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)]"
                  }`}
                >
                  <Sparkles className="w-4 h-4 animate-pulse text-emerald-200" />
                  <span>{isGenerating ? "Synthesizing..." : "Generate Voice Master"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* AI Optimization Log display */}
          <OptimizationBreakdown result={optimizationResult} isOptimizing={isOptimizing} />

        </section>

        {/* RIGHT COLUMN: Production Studio Controls & Playback (Lg: cols 5) */}
        <section className="lg:col-span-5 flex flex-col gap-5 w-full">
          
          {/* Visual Wave Console */}
          <AudioVisualizer 
            isPlaying={isPlaying} 
            isGenerating={isGenerating} 
            generationStep={generationStep} 
          />

          {loadedFromCache && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-pulse">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-emerald-200">Loaded from cache.</span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded">0ms Latency • Saved 1 API Quota Call</span>
            </div>
          )}

          {ttsWarning && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 p-3 flex flex-col gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.08)]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-amber-200">Quality Check Warning:</span>
              </div>
              <p className="text-[11px] text-amber-200/80 leading-relaxed font-sans">{ttsWarning}</p>
            </div>
          )}

          {/* Custom audio controls deck */}
          <AudioPlayerControls
            audioUrl={audioUrl}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            playbackRate={playbackRate}
            onPlayPause={handlePlayPause}
            onStop={handleStop}
            onSeek={handleSeek}
            onVolumeChange={setVolume}
            onPlaybackRateChange={setPlaybackRate}
            onDownload={handleDownload}
          />

          {/* Error Board */}
          {error && (
            <div className={`rounded-xl border p-4 flex flex-col gap-3 shadow-lg ${
              error.includes("Quota Limit") || error.includes("Settings > Secrets")
                ? "border-amber-500/30 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                : "border-red-900/30 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
            }`}>
              <div className="flex items-start gap-3">
                {error.includes("Quota Limit") || error.includes("Settings > Secrets") ? (
                  <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className={`text-xs font-bold ${
                    error.includes("Quota Limit") || error.includes("Settings > Secrets") ? "text-amber-300" : "text-red-300"
                  }`}>
                    {error.includes("Quota Limit") || error.includes("Settings > Secrets") ? "STUDIO QUOTA LIMIT REACHED" : "STUDIO MASTERING ERROR"}
                  </h4>
                  <p className={`text-xs leading-relaxed mt-0.5 ${
                    error.includes("Quota Limit") || error.includes("Settings > Secrets") ? "text-amber-100/90" : "text-red-300/80"
                  }`}>{error}</p>
                </div>
              </div>

              {(error.includes("Quota Limit") || error.includes("Settings > Secrets")) && (
                <div className="border-t border-amber-500/10 pt-3 mt-1 text-xs text-amber-300/80 flex flex-col gap-2">
                  <div className="font-bold text-[10px] tracking-wider uppercase text-amber-400">HOW TO UPGRADE YOUR LIMITS:</div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-200/70">
                    <li>Open the <b className="text-amber-300">Settings</b> menu (gear icon) in the upper right corner of the workspace.</li>
                    <li>Click on <b className="text-amber-300">Secrets</b>.</li>
                    <li>Add or update the <code className="bg-amber-950/40 px-1.5 py-0.5 rounded text-amber-400 font-mono">GEMINI_API_KEY</code> environment variable with your personal API Key.</li>
                    <li>Generate your speech with full high-tier limits!</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Voice parameters controls card */}
          <div className="rounded-2xl border border-purple-900/30 bg-[#110C24]/90 backdrop-blur-md p-5 flex flex-col gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            <div className="flex flex-col gap-2 border-b border-purple-900/10 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-200">
                    Studio Vocal Parameters
                  </h3>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                {/* Auto-Tune Controller */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-purple-300/40">v4 Auto-Tune:</span>
                  <button
                    onClick={() => setAutoTune(!autoTune)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all border ${
                      autoTune 
                        ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                        : "bg-purple-950/40 border-purple-900/40 text-purple-400 hover:text-purple-300"
                    }`}
                    title="Automatically tune vocals dynamically matching the script's detected emotion and dialog structures."
                  >
                    {autoTune ? "ACTIVE" : "MANUAL"}
                  </button>
                </div>

                {/* Audio Mastering Toggle */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-purple-300/40">Mastering DSP:</span>
                  <button
                    onClick={() => setMasteringActive(!masteringActive)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all border ${
                      masteringActive 
                        ? "bg-indigo-950/40 border-indigo-500/30 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                        : "bg-purple-950/40 border-purple-900/40 text-purple-400 hover:text-purple-300"
                    }`}
                    title="Apply post-process peak-normalization and soft limiting clipper to ensure optimal acoustics."
                  >
                    {masteringActive ? "MASTERED" : "RAW"}
                  </button>
                </div>
              </div>
            </div>

            {/* Parameter Grid Sliders */}
            <div className="flex flex-col gap-4">
              
              {/* Speaking Speed */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60 font-medium flex items-center gap-1.5">
                    <span>Speaking Speed</span>
                    {autoTune && (
                      <span className="text-[9px] font-mono bg-emerald-950/40 text-emerald-400 px-1 py-0.2 rounded border border-emerald-950">v4 tuned</span>
                    )}
                  </span>
                  <span className="font-mono text-purple-300 font-bold">{speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.4"
                  step="0.05"
                  value={speed}
                  onChange={(e) => {
                    setSpeed(parseFloat(e.target.value));
                    setAutoTune(false);
                  }}
                  className="w-full h-1 bg-purple-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[9px] text-purple-300/20 font-mono">
                  <span>Slow & Somber</span>
                  <span>Normal (1.0x)</span>
                  <span>Fast & Energetic</span>
                </div>
              </div>

              {/* Voice Pitch */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60 font-medium flex items-center gap-1.5">
                    <span>Vocal Pitch</span>
                    {autoTune && (
                      <span className="text-[9px] font-mono bg-emerald-950/40 text-emerald-400 px-1 py-0.2 rounded border border-emerald-950">v4 tuned</span>
                    )}
                  </span>
                  <span className="font-mono text-purple-300 font-bold">
                    {pitch < 0.85 ? "Deep / Low" : pitch > 1.15 ? "High / Bright" : "Medium / Natural"} ({pitch.toFixed(2)}x)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={pitch}
                  onChange={(e) => {
                    setPitch(parseFloat(e.target.value));
                    setAutoTune(false);
                  }}
                  className="w-full h-1 bg-purple-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[9px] text-purple-300/20 font-mono">
                  <span>Deep / Masculine</span>
                  <span>Default (1.0x)</span>
                  <span>High / Feminine</span>
                </div>
              </div>

              {/* Voice Warmth */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60 font-medium flex items-center gap-1.5">
                    <span>Voice Warmth</span>
                    {autoTune && (
                      <span className="text-[9px] font-mono bg-emerald-950/40 text-emerald-400 px-1 py-0.2 rounded border border-emerald-950">v4 tuned</span>
                    )}
                  </span>
                  <span className="font-mono text-purple-300 font-bold">{(voiceWarmth * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={voiceWarmth}
                  onChange={(e) => {
                    setVoiceWarmth(parseFloat(e.target.value));
                    setAutoTune(false);
                  }}
                  className="w-full h-1 bg-purple-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[9px] text-purple-300/20 font-mono">
                  <span>Cool & Crisp</span>
                  <span>Balanced</span>
                  <span>Deep Warmth</span>
                </div>
              </div>

              {/* Emotion Level */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60 font-medium flex items-center gap-1.5">
                    <span>Emotion Level</span>
                    {autoTune && (
                      <span className="text-[9px] font-mono bg-emerald-950/40 text-emerald-400 px-1 py-0.2 rounded border border-emerald-950">v4 tuned</span>
                    )}
                  </span>
                  <span className="font-mono text-purple-300 font-bold">{(emotionLevel * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={emotionLevel}
                  onChange={(e) => {
                    setEmotionLevel(parseFloat(e.target.value));
                    setAutoTune(false);
                  }}
                  className="w-full h-1 bg-purple-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[9px] text-purple-300/20 font-mono">
                  <span>Matter-of-fact</span>
                  <span>Empathetic</span>
                  <span>Dramatic Intensity</span>
                </div>
              </div>

              {/* Expressiveness */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60 font-medium flex items-center gap-1.5">
                    <span>Expressiveness</span>
                    {autoTune && (
                      <span className="text-[9px] font-mono bg-emerald-950/40 text-emerald-400 px-1 py-0.2 rounded border border-emerald-950">v4 tuned</span>
                    )}
                  </span>
                  <span className="font-mono text-purple-300 font-bold">{(expressiveness * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={expressiveness}
                  onChange={(e) => {
                    setExpressiveness(parseFloat(e.target.value));
                    setAutoTune(false);
                  }}
                  className="w-full h-1 bg-purple-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[9px] text-purple-300/20 font-mono">
                  <span>Factual / Fixed</span>
                  <span>Dynamic Range</span>
                  <span>Cinematic Accent</span>
                </div>
              </div>

              {/* Pause Strength */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-purple-300/60 font-medium flex items-center gap-1.5">
                  <span>Pause Strength</span>
                  {autoTune && (
                    <span className="text-[9px] font-mono bg-emerald-950/40 text-emerald-400 px-1 py-0.2 rounded border border-emerald-950">v4 tuned</span>
                  )}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {["Short", "Natural", "Dramatic"].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        setPauseStrength(lvl);
                        setAutoTune(false);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all active:scale-95 ${
                        pauseStrength === lvl
                          ? "bg-purple-600/20 border-purple-500 text-purple-200"
                          : "bg-purple-950/20 border-purple-900/40 text-purple-400 hover:text-purple-200"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle Switch: Use Smart Narration Engine */}
              <div className="flex items-center justify-between border-t border-purple-900/10 pt-3 mt-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-purple-200">
                    Use Smart Narration Engine
                  </span>
                  <p className="text-[10px] text-purple-300/40 leading-tight">
                    Perform natural audiobook optimization & cinematic expression
                  </p>
                </div>
                <button
                  onClick={() => setUseSmartNarration(!useSmartNarration)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    useSmartNarration ? "bg-purple-600" : "bg-purple-950"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      useSmartNarration ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Dropdown: Underlying Voice Model Option */}
              <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-purple-900/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-300/60 font-medium">Base Gemini Voice Model</span>
                  <span className="text-[10px] bg-purple-950/40 text-purple-400 px-1.5 py-0.5 rounded font-mono">
                    {VOICE_MODELS.find(v => v.id === selectedVoiceName)?.gender}
                  </span>
                </div>
                <select
                  value={selectedVoiceName}
                  onChange={(e) => setSelectedVoiceName(e.target.value as any)}
                  className="w-full bg-[#0A0516] border border-purple-900/40 rounded-xl px-3 py-2 text-xs text-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                >
                  {VOICE_MODELS.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} ({voice.description})
                    </option>
                  ))}
                </select>
              </div>

              {/* Native TTS Engine Status Indicator */}
              <div className="flex items-center justify-between border-t border-purple-900/10 pt-3 mt-1">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-purple-300/85 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Gemini 3.1 TTS Engine Active
                  </span>
                  <p className="text-[9px] text-purple-300/35">Native multimodal audio generation via @google/genai</p>
                </div>
              </div>

              {/* Daily Quota Protection Meter */}
              <div className="flex flex-col gap-2 border-t border-purple-900/10 pt-3 mt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-300/60 font-medium font-sans">Daily Free Quota Monitor</span>
                  <span className="font-mono text-purple-300 font-bold">{dailyRequestCount} / 10 Used</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[10px] bg-purple-950/25 border border-purple-900/20 p-2.5 rounded-lg font-mono">
                  <div>
                    <span className="text-purple-400">Remaining:</span>{" "}
                    <span className={`font-bold ${10 - dailyRequestCount <= 2 ? "text-amber-400 animate-pulse" : "text-emerald-400"}`}>
                      {Math.max(0, 10 - dailyRequestCount)} requests
                    </span>
                  </div>
                  <div>
                    <span className="text-purple-400">Quota Reset:</span>{" "}
                    <span className="font-bold text-teal-400">
                      in {resetCountdown || "calculating..."}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-[#0A0516]/80 border border-purple-900/20 h-2 rounded-full overflow-hidden p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      dailyRequestCount >= 10 
                        ? "bg-gradient-to-r from-red-600 to-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                        : dailyRequestCount >= 8 
                        ? "bg-gradient-to-r from-amber-600 to-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                        : "bg-gradient-to-r from-emerald-600 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    }`}
                    style={{ width: `${Math.min((dailyRequestCount / 10) * 100, 100)}%` }}
                  />
                </div>

                {/* Warn before quota runs out */}
                {dailyRequestCount >= 8 && dailyRequestCount < 10 && (
                  <div className="text-[10px] text-amber-400 bg-amber-950/20 border border-amber-500/20 px-2.5 py-1.5 rounded flex items-center gap-1.5 font-sans">
                    <AlertCircle className="w-3.5 h-3.5 animate-bounce shrink-0" />
                    <span>⚠️ Warning: Daily free quota almost exhausted! (Only {10 - dailyRequestCount} generations left).</span>
                  </div>
                )}

                <p className="text-[9px] text-purple-300/40 leading-tight">
                  {dailyRequestCount >= 10 
                    ? "Daily free limit reached. Add a personal API key in Settings > Secrets to unlock unlimited high-speed limits!" 
                    : "Daily free quota limit is 10 requests. Automatically optimized with Voice Caching to prevent duplicate wasted calls."}
                </p>
              </div>

            </div>
          </div>

          {/* Project Mode: Saved Presets */}
          <div className="rounded-2xl border border-purple-900/30 bg-[#110C24]/90 backdrop-blur-md p-5 flex flex-col gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between border-b border-purple-900/10 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-purple-200">
                  Project Presets (v5 Save Mode)
                </h2>
              </div>
            </div>

            {/* Save Current Preset form */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New preset name..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                maxLength={25}
                className="flex-1 bg-[#0A0516] border border-purple-900/40 rounded-xl px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
              />
              <button
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>

            {/* Presets List */}
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
              {projectPresets.length === 0 ? (
                <p className="text-[10px] text-purple-400/40 italic text-center py-2">No custom presets saved yet.</p>
              ) : (
                projectPresets.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handleLoadPreset(preset)}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#0A0516]/50 border border-purple-950 hover:border-purple-800/40 transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-purple-200 group-hover:text-purple-100">{preset.name}</span>
                      <span className="text-[9px] text-purple-400/60 font-mono">
                        Voice: {preset.voiceName} | Speed: {preset.speed}x
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDeletePreset(preset.id, e)}
                      className="p-1 rounded text-purple-400 hover:text-red-400 hover:bg-red-950/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Auto-Saved Projects Directory */}
          <div className="rounded-2xl border border-purple-900/30 bg-[#110C24]/90 backdrop-blur-md p-5 flex flex-col gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between border-b border-purple-900/10 pb-3">
              <div className="flex items-center gap-2">
                <FolderClosed className="w-4 h-4 text-purple-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-purple-200">
                  Auto-Saved Projects
                </h2>
              </div>
              {projects.length > 0 && (
                <button
                  onClick={() => setProjects([])}
                  className="text-[10px] text-purple-400 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Search Input for Projects */}
            {projects.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-purple-400/50" />
                <input
                  type="text"
                  placeholder="Search auto-saved projects..."
                  value={projectSearchQuery}
                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                  className="w-full bg-[#0A0516] border border-purple-900/30 rounded-xl pl-9 pr-4 py-1.5 text-xs text-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-purple-400/20"
                />
              </div>
            )}

            {/* Projects list */}
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
              {projects.length === 0 ? (
                <div className="text-center py-4 flex flex-col items-center gap-1">
                  <FolderClosed className="w-5 h-5 text-purple-400/20" />
                  <p className="text-[10px] text-purple-400/40 italic">Projects are auto-saved here upon generation.</p>
                </div>
              ) : (
                projects
                  .filter(p => {
                    const q = projectSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return p.title.toLowerCase().includes(q) || p.text.toLowerCase().includes(q);
                  })
                  .map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleLoadProject(project)}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#0A0516]/50 border border-purple-950 hover:border-purple-800/40 transition-all cursor-pointer group"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <span className="text-xs font-semibold text-purple-200 block truncate group-hover:text-purple-100">
                          {project.title}
                        </span>
                        <span className="text-[9px] text-purple-400/60 font-mono block truncate mt-0.5">
                          Voice: {project.voiceName} | Speed: {project.speed}x | {project.timestamp}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id, e);
                          }}
                          className="p-1 rounded text-purple-400 hover:text-red-400 hover:bg-red-950/20"
                          title="Delete Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Voice style preset grid */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300/40 font-mono">
              Narrative Voice Profiles
            </span>
            <div className="grid grid-cols-2 gap-3">
              {VOICE_STYLES.map((style) => (
                <VoiceCard
                  key={style.id}
                  style={style}
                  isSelected={selectedStyle.id === style.id}
                  onSelect={() => handleSelectStyle(style)}
                />
              ))}
            </div>
          </div>

          {/* Audio Generation History */}
          <div className="rounded-2xl border border-purple-900/30 bg-[#110C24]/90 backdrop-blur-md p-5 flex flex-col gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between border-b border-purple-900/10 pb-3">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-purple-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-purple-200">
                  Audio Generation History
                </h2>
              </div>
              {voiceHistory.length > 0 && (
                <button
                  onClick={() => setVoiceHistory([])}
                  className="text-[10px] text-purple-400 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Search Input for Voice History */}
            {voiceHistory.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-purple-400/50" />
                <input
                  type="text"
                  placeholder="Search voice history by script, voice or style..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full bg-[#0A0516] border border-purple-900/30 rounded-xl pl-9 pr-4 py-2 text-xs text-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 placeholder-purple-400/20"
                />
              </div>
            )}

            <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
              {voiceHistory.length === 0 ? (
                <div className="text-center py-6 flex flex-col items-center gap-1">
                  <Music className="w-6 h-6 text-purple-400/20" />
                  <p className="text-[11px] text-purple-400/40 italic">No audio generated yet in this session.</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-6 text-purple-400/40 italic text-xs">
                  No matches found for "{historySearchQuery}".
                </div>
              ) : (
                filteredHistory.map((item) => {
                  const itemTitle = item.title || item.textSnippet;
                  const itemStyle = item.style || "Standard";
                  const itemSpeed = item.speed || 1.0;
                  const itemEmotion = item.emotion !== undefined ? Math.round(item.emotion * 100) : 70;
                  const itemDuration = item.duration || "0:02";

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setAudioUrl(item.audioUrl);
                        setIsPlaying(true);
                      }}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#0A0516]/60 border border-purple-950 hover:border-purple-500/20 hover:bg-[#0d0724]/60 transition-all cursor-pointer group"
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-xs font-bold text-purple-200 truncate group-hover:text-purple-100 flex items-center gap-1.5">
                          <Music className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span>{itemTitle}</span>
                        </p>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1 gap-x-2.5 mt-2 text-[9px] text-purple-300/60 font-mono">
                          <div className="flex items-center gap-1">
                            <span className="text-purple-500/80">Voice:</span>
                            <span className="text-purple-200 font-sans font-semibold">{item.voice}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-purple-500/80">Style:</span>
                            <span className="text-purple-200 font-sans font-semibold">{itemStyle}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-purple-500/80">Speed:</span>
                            <span className="text-purple-200 font-semibold">{itemSpeed}x</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-purple-500/80">Emotion:</span>
                            <span className="text-purple-200 font-semibold">{itemEmotion}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-purple-500/80">Duration:</span>
                            <span className="text-purple-200 font-semibold flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5 text-teal-400" />
                              {itemDuration}
                            </span>
                          </div>
                          <div className="col-span-2 sm:col-span-3 mt-0.5 text-[8.5px] text-purple-400/50">
                            {item.timestamp}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        {item.audioUrl && (
                          <a
                            href={item.audioUrl}
                            download={`${itemTitle.replace(/[\s\W]+/g, "_")}.wav`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shrink-0"
                            title="Download Audio"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVoiceHistory(prev => prev.filter(h => h.id !== item.id));
                          }}
                          className="p-2 rounded-lg bg-red-950/40 text-red-400 border border-red-900/40 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100"
                          title="Delete History Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          className="p-2 rounded-lg bg-purple-950 border border-purple-900 text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-all flex items-center justify-center shrink-0"
                          title="Play Preview"
                        >
                          <Music className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </section>

      </main>

      {/* Decorative ambient studio floor */}
      <footer className="w-full text-center py-6 border-t border-purple-900/10 bg-[#070313]/90 text-[11px] text-purple-300/30 font-mono flex flex-col sm:flex-row items-center justify-between px-6 gap-2">
        <span>© 2026 MANDALAY WAVE AI SPEECH LABS. ALL RIGHTS RESERVED.</span>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>NATIVE INTEGRATION WITH GEMINI LLM TTS MODALITIES</span>
        </div>
      </footer>
    </div>
  );
}
