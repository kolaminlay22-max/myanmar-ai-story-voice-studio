import React from "react";
import { Play, Pause, Square, Download, Volume2, VolumeX, Shuffle, RotateCcw } from "lucide-react";

interface AudioPlayerControlsProps {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onDownload: () => void;
}

export default function AudioPlayerControls({
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  volume,
  playbackRate,
  onPlayPause,
  onStop,
  onSeek,
  onVolumeChange,
  onPlaybackRateChange,
  onDownload,
}: AudioPlayerControlsProps) {
  // Helper to format time into MM:SS format
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || timeInSeconds === Infinity) return "00:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const isMuted = volume === 0;

  const handleVolumeToggle = () => {
    onVolumeChange(isMuted ? 0.8 : 0);
  };

  return (
    <div className="w-full rounded-xl border border-purple-900/30 bg-[#110C24]/80 backdrop-blur-md p-5 flex flex-col gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      {/* Track info & download */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-mono uppercase text-purple-400 font-semibold tracking-wider">
            Active Audio Output
          </h4>
          <p className="text-sm text-purple-200 font-sans mt-0.5">
            {audioUrl ? "Mandalay Voice Masterpiece Generated" : "No speech master loaded yet"}
          </p>
        </div>

        {audioUrl && (
          <button
            onClick={onDownload}
            id="download-btn"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-200 text-xs font-sans transition-all active:scale-95 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
            title="Download Speech MP3 File"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Download MP3</span>
          </button>
        )}
      </div>

      {/* Progress slider bar */}
      <div className="flex items-center gap-3 w-full">
        <span className="text-[11px] font-mono text-purple-300/60 min-w-[34px]">
          {formatTime(currentTime)}
        </span>
        
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          disabled={!audioUrl}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="flex-grow h-1.5 rounded-lg appearance-none cursor-pointer bg-purple-950/60 accent-purple-500 outline-none transition-all focus:ring-1 focus:ring-purple-400"
          style={{
            background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${
              duration > 0 ? (currentTime / duration) * 100 : 0
            }%, #1e1b4b ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #1e1b4b 100%)`
          }}
        />

        <span className="text-[11px] font-mono text-purple-300/60 min-w-[34px]">
          {formatTime(duration)}
        </span>
      </div>

      {/* Master Audio Play Deck */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-1 border-t border-purple-900/10 pt-3">
        {/* Playback Control Group */}
        <div className="flex items-center gap-2.5">
          {/* Play/Pause Button */}
          <button
            onClick={onPlayPause}
            disabled={!audioUrl}
            id="play-pause-btn"
            className={`flex items-center justify-center w-11 h-11 rounded-full transition-all active:scale-95 ${
              audioUrl
                ? "bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.35)]"
                : "bg-purple-950/30 text-purple-300/20 border border-purple-900/10 cursor-not-allowed"
            }`}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white fill-white" />
            ) : (
              <Play className="w-5 h-5 text-white fill-white translate-x-0.5" />
            )}
          </button>

          {/* Stop Button */}
          <button
            onClick={onStop}
            disabled={!audioUrl}
            id="stop-btn"
            className={`flex items-center justify-center w-9 h-9 rounded-full border transition-all active:scale-95 ${
              audioUrl
                ? "bg-purple-950/40 hover:bg-purple-900/30 border-purple-800/40 text-purple-300"
                : "bg-purple-950/10 border-purple-900/10 text-purple-300/20 cursor-not-allowed"
            }`}
            title="Stop Playback"
          >
            <Square className="w-4 h-4 text-current fill-current" />
          </button>
        </div>

        {/* Playback Speed Controls */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono text-purple-300/40 mr-1">SPEED:</span>
          {[0.8, 1.0, 1.25, 1.5].map((rate) => (
            <button
              key={rate}
              disabled={!audioUrl}
              onClick={() => onPlaybackRateChange(rate)}
              className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                !audioUrl
                  ? "border-purple-950/20 text-purple-300/10 cursor-not-allowed"
                  : playbackRate === rate
                  ? "bg-purple-600/20 text-purple-200 border-purple-500/60 shadow-[0_0_10px_rgba(168,85,247,0.1)]"
                  : "bg-purple-950/10 text-purple-300/50 border-purple-900/20 hover:text-purple-300 hover:border-purple-800/40"
              }`}
            >
              {rate.toFixed(2)}x
            </button>
          ))}
        </div>

        {/* Volume controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleVolumeToggle}
            disabled={!audioUrl}
            className={`p-1.5 rounded transition-all ${
              !audioUrl 
                ? "text-purple-300/10 cursor-not-allowed" 
                : "text-purple-300 hover:text-purple-100 hover:bg-purple-950/30"
            }`}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-purple-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-purple-300" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            disabled={!audioUrl}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-20 h-1 rounded-lg appearance-none cursor-pointer bg-purple-950 accent-purple-500 outline-none"
            style={{
              background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${volume * 100}%, #1e1b4b ${volume * 100}%, #1e1b4b 100%)`
            }}
          />
        </div>
      </div>
    </div>
  );
}
