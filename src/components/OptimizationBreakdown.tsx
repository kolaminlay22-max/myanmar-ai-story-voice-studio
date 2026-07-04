import React from "react";
import { CheckCircle, Info, Sparkles, Wand2, Lightbulb } from "lucide-react";
import { OptimizationResult } from "../types";

interface OptimizationBreakdownProps {
  result: OptimizationResult | null;
  isOptimizing: boolean;
}

export default function OptimizationBreakdown({ result, isOptimizing }: OptimizationBreakdownProps) {
  if (isOptimizing) {
    return (
      <div className="rounded-xl border border-purple-950 bg-[#120D2B]/50 p-6 flex flex-col gap-4 animate-pulse">
        <div className="flex items-center gap-2 text-purple-300">
          <Wand2 className="w-5 h-5 animate-spin text-purple-400" />
          <h3 className="font-semibold text-sm">AI Story Analyzer Running...</h3>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-purple-900/20 rounded w-3/4"></div>
          <div className="h-4 bg-purple-900/20 rounded w-1/2"></div>
          <div className="h-4 bg-purple-900/20 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  // Pre-optimized default content if no active result is available yet
  const displayResult = result || {
    optimizedText: "",
    changes: [
      "Automatically maps abbreviations (e.g., AI) to Burmese phonetics.",
      "Converts international numbers & years into full-spelled Myanmar digits.",
      "Balances syllables and inserts commas (၊) for natural breath lines.",
      "Injects ellipses (...) for dramatic narrative suspension."
    ],
    storytellingTips: "Select a voice style above and click 'Generate Speech' to see the AI Optimization Log in action!"
  };

  return (
    <div className="rounded-xl border border-purple-900/30 bg-[#130E26]/60 backdrop-blur-sm p-5 flex flex-col gap-4 shadow-[0_4px_25px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between border-b border-purple-900/20 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
          <h3 className="font-semibold text-sm text-purple-200 uppercase tracking-wide font-sans">
            AI Studio Optimization Log
          </h3>
        </div>
        <span className="text-[10px] font-mono bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800/40">
          Active
        </span>
      </div>

      {/* Changes list */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs text-purple-300/40 font-semibold uppercase tracking-wider">
          Pronunciation & Rhythm Enhancements:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {displayResult.changes.map((change, index) => (
            <div 
              key={index} 
              className="flex items-start gap-2.5 bg-purple-950/20 border border-purple-900/20 rounded-lg p-3 text-xs text-purple-200/90 transition-all hover:border-purple-800/40"
            >
              <CheckCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>{change}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Tips */}
      <div className="mt-2 bg-gradient-to-r from-purple-950/50 to-indigo-950/40 border border-purple-900/40 rounded-lg p-3.5 flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-purple-900/30 text-purple-300 shrink-0 mt-0.5">
          <Lightbulb className="w-4 h-4 text-purple-300" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-purple-200 mb-0.5">
            Voice Director's Tip:
          </h4>
          <p className="text-xs text-purple-300/80 leading-relaxed font-sans">
            {displayResult.storytellingTips}
          </p>
        </div>
      </div>
    </div>
  );
}
