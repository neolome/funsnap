"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  isRecording: boolean;
  progress: number;
  onPhoto: () => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
};

const HOLD_THRESHOLD = 300; // ms before becoming a video

export function CaptureButton({ isRecording, progress, onPhoto, onStartRecord, onStopRecord }: Props) {
  const holdTimerRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);
  const triggeredRecordRef = useRef(false);

  const handleStart = () => {
    isHoldingRef.current = true;
    triggeredRecordRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      if (isHoldingRef.current) {
        triggeredRecordRef.current = true;
        onStartRecord();
      }
    }, HOLD_THRESHOLD);
  };

  const handleEnd = () => {
    isHoldingRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (triggeredRecordRef.current) {
      onStopRecord();
    } else if (!isRecording) {
      onPhoto();
    }
  };

  const size = 80;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative">
      <button
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={() => isHoldingRef.current && handleEnd()}
        onTouchStart={(e) => { e.preventDefault(); handleStart(); }}
        onTouchEnd={(e) => { e.preventDefault(); handleEnd(); }}
        aria-label={isRecording ? "Arrêter l'enregistrement" : "Capturer (appui long = vidéo)"}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all active:scale-95",
          isRecording ? "h-20 w-20" : "h-20 w-20",
        )}
        style={{ width: size, height: size }}
      >
        {/* Progress ring */}
        {isRecording && (
          <svg
            className="absolute inset-0 -rotate-90"
            width={size}
            height={size}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#ef4444"
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
        )}
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-4 border-white" />
        {/* Inner */}
        <div
          className={cn(
            "rounded-full transition-all",
            isRecording ? "h-7 w-7 rounded-md bg-red-500" : "h-14 w-14 bg-white",
          )}
        />
      </button>
    </div>
  );
}
