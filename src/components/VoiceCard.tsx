import React from "react";
import * as Icons from "lucide-react";
import { VoiceStyle } from "../types";

interface VoiceCardProps {
  key?: string;
  style: VoiceStyle;
  isSelected: boolean;
  onSelect: () => void;
}

export default function VoiceCard({ style, isSelected, onSelect }: VoiceCardProps) {
  // Dynamically resolve icon from lucide-react
  const IconComponent = (Icons as any)[style.icon] || Icons.Mic;

  return (
    <button
      onClick={onSelect}
      className={`group relative flex flex-col items-start text-left rounded-xl p-4 transition-all duration-300 border h-full outline-none ${
        isSelected
          ? "bg-gradient-to-br from-[#1b123d] to-[#110A26] border-purple-500 shadow-[0_0_20px_rgba(139,92,246,0.18)]"
          : "bg-[#120D25]/50 hover:bg-[#150F2C]/80 border-purple-950 hover:border-purple-900/50"
      }`}
    >
      {/* Glow highlight on hover/selected */}
      <div
        className={`absolute inset-0 rounded-xl transition-opacity duration-300 pointer-events-none ${
          isSelected
            ? "opacity-100 bg-purple-500/[0.02]"
            : "opacity-0 group-hover:opacity-100 bg-purple-500/[0.01]"
        }`}
      />

      <div className="flex items-center justify-between w-full mb-2">
        {/* Rounded Icon badge */}
        <div
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-300 ${
            isSelected
              ? "bg-purple-600 text-purple-100 shadow-[0_0_10px_rgba(147,51,234,0.3)]"
              : "bg-purple-950/40 border border-purple-900/30 text-purple-400 group-hover:text-purple-300"
          }`}
        >
          <IconComponent className="w-4 h-4" />
        </div>

        {/* Selected badge status */}
        {isSelected && (
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#c084fc]" />
        )}
      </div>

      {/* Style Names */}
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-purple-300/40 uppercase tracking-wider font-mono">
          {style.burmeseName}
        </span>
        <h4 className="text-sm font-bold text-purple-100 group-hover:text-white transition-colors">
          {style.name}
        </h4>
      </div>

      {/* Description */}
      <p className="text-xs text-purple-300/60 leading-relaxed mt-2 font-sans group-hover:text-purple-300/80 transition-colors">
        {style.description}
      </p>
    </button>
  );
}
