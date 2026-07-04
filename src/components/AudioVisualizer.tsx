import React, { useEffect, useState } from "react";
import { Play, Pause, Activity, Radio, Volume2 } from "lucide-react";

interface AudioVisualizerProps {
  isPlaying: boolean;
  isGenerating: boolean;
  generationStep: "idle" | "optimizing" | "synthesizing" | "ready";
}

export default function AudioVisualizer({ isPlaying, isGenerating, generationStep }: AudioVisualizerProps) {
  const [heights, setHeights] = useState<number[]>([15, 20, 10, 30, 25, 40, 35, 12, 18, 22, 28, 14]);

  // Keep animating wave bars when playing
  useEffect(() => {
    if (!isPlaying) {
      setHeights([6, 8, 5, 8, 6, 7, 5, 8, 6, 7, 5, 6]);
      return;
    }

    const interval = setInterval(() => {
      setHeights(prev =>
        prev.map(() => Math.floor(Math.random() * 35) + 8)
      );
    }, 120);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="relative w-full rounded-2xl bg-[#0F0A24] border border-purple-900/30 overflow-hidden shadow-[inset_0_0_20px_rgba(139,92,246,0.08)] p-6 min-h-[140px] flex flex-col items-center justify-center">
      {/* Abstract Grid Map Backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e1545_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>

      {isGenerating ? (
        <div className="relative flex flex-col items-center justify-center gap-3">
          {/* Glowing Spinner */}
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-2 border-purple-500/20"></div>
            <div className="absolute inset-0 rounded-full border-2 border-t-purple-500 border-r-indigo-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border border-dashed border-purple-400/40 animate-pulse"></div>
          </div>
          
          <div className="text-center">
            <p className="text-sm font-semibold text-purple-200 tracking-wide">
              {generationStep === "optimizing" ? "AUTOMATICALLY OPTIMIZING BURMESE SCRIPT..." : "SYNTHESIZING HIGH-QUALITY SPEECH..."}
            </p>
            <p className="text-xs text-purple-400/60 mt-1 font-mono">
              {generationStep === "optimizing" 
                ? "Polishing pronunciation • Inserting story pauses" 
                : "Modulating voice style • Embedding natural expressions"}
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center gap-4">
          {/* Animated Waveform */}
          <div className="flex items-end justify-center gap-1.5 h-16 w-full max-w-sm">
            {heights.map((height, index) => {
              // Create dynamic gradients depending on playing state
              const style = isPlaying 
                ? { 
                    height: `${height}px`,
                    transition: "height 0.1s ease" 
                  }
                : { height: "6px" };

              return (
                <div
                  key={index}
                  className={`w-1.5 rounded-full bg-gradient-to-t ${
                    isPlaying 
                      ? "from-purple-600 via-purple-500 to-indigo-400 animate-pulse-slow" 
                      : "from-purple-950 to-purple-900"
                  } shadow-[0_0_10px_rgba(147,51,234,0.15)]`}
                  style={style}
                />
              );
            })}
          </div>

          {/* Context Banner */}
          <div className="flex items-center gap-2">
            {isPlaying ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-3 py-1 rounded-full animate-pulse">
                <Radio className="w-3.5 h-3.5" />
                <span className="font-mono uppercase tracking-wide">PLAYING VOICE STREAM</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-purple-400/60 bg-purple-950/20 border border-purple-900/20 px-3 py-1 rounded-full">
                <Activity className="w-3.5 h-3.5" />
                <span className="font-mono uppercase tracking-wide">STUDIO INTERACTIVE MONITORS</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
