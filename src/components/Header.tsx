import React from "react";
import { Sparkles, Mic, Activity, Layers } from "lucide-react";

export default function Header() {
  return (
    <header className="relative w-full border-b border-purple-900/40 bg-[#0B061A]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
      {/* Abstract Background Glow */}
      <div className="absolute -top-10 left-1/4 w-96 h-24 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-[0_0_15px_rgba(147,51,234,0.3)]">
          <Mic className="w-5 h-5 text-white animate-pulse" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-400 rounded-full border border-[#0B061A]"></div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white font-sans bg-clip-text bg-gradient-to-r from-purple-200 to-indigo-200">
              Mandalay Wave
            </h1>
            <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-700/30 text-purple-300">
              Studio PRO
            </span>
          </div>
          <p className="text-xs text-purple-300/60 font-sans">
            Myanmar AI Story Voice Studio Pro v5 • Native Gemini TTS Engine
          </p>
        </div>
      </div>

      {/* Connection and Telemetry Indicators */}
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-900/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-mono text-purple-300/80">
            GEMINI ENGINE ONLINE
          </span>
        </div>

        {/* Audio Sample Rate Info */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/30 border border-indigo-900/30">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-mono text-indigo-300/80">
            24kHz PCM Hi-Fi
          </span>
        </div>
      </div>
    </header>
  );
}
