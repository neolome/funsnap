"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFaceLandmarker } from "@/lib/face-landmarker";
import { FILTERS, NO_FILTER, computeFaceFrame, type Filter } from "@/lib/filters";
import { FilterCarousel } from "./FilterCarousel";
import { CategoryBar } from "./CategoryBar";
import { CaptureButton } from "./CaptureButton";
import { TopControls } from "./TopControls";
import { CapturePreview } from "./CapturePreview";

type FacingMode = "user" | "environment";

type Capture = { type: "image"; dataUrl: string } | { type: "video"; url: string; blob: Blob };

export function Camera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastLandmarksRef = useRef<{ x: number; y: number; z: number }[] | null>(null);
  const filterRef = useRef<Filter>(NO_FILTER);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const [activeFilter, setActiveFilter] = useState<Filter>(NO_FILTER);
  const [facing, setFacing] = useState<FacingMode>("user");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Démarrage de la caméra…");
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [capture, setCapture] = useState<Capture | null>(null);

  // Keep filter ref in sync (so RAF loop reads latest without re-binding)
  useEffect(() => {
    filterRef.current = activeFilter;
  }, [activeFilter]);

  const startCamera = useCallback(async (facingMode: FacingMode) => {
    setReady(false);
    setError(null);
    setLoadingMessage("Demande d'accès caméra…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(() => resolve()).catch(() => resolve());
        };
      });
      setLoadingMessage("Chargement de la détection visage…");
      await getFaceLandmarker();
      setReady(true);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Accès caméra refusé. Autorise-le dans les paramètres du navigateur."
          : "Impossible d'accéder à la caméra.",
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    startCamera(facing);
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  // Render loop
  useEffect(() => {
    if (!ready) return;
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stopped = false;

    const loop = async () => {
      if (stopped) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h) {
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;

        // Mirror for front camera
        ctx.save();
        if (facing === "user") {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, w, h);
        ctx.restore();

        // Detect face
        const now = performance.now();
        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          try {
            const fl = await getFaceLandmarker();
            const result = fl.detectForVideo(video, now);
            if (result.faceLandmarks && result.faceLandmarks[0]) {
              const raw = result.faceLandmarks[0];
              // Mirror landmarks horizontally for front camera (since canvas is mirrored)
              lastLandmarksRef.current = facing === "user"
                ? raw.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }))
                : raw.map((p) => ({ x: p.x, y: p.y, z: p.z }));
            } else {
              lastLandmarksRef.current = null;
            }
          } catch (err) {
            console.error("Face detection error:", err);
          }
        }

        // Apply filter
        const filter = filterRef.current;
        const landmarks = lastLandmarksRef.current;
        if (filter && filter.id !== "none") {
          const frame = landmarks ? computeFaceFrame(landmarks, w, h) : null;
          if (frame || !filter.needsFace) {
            try {
              filter.render({
                ctx,
                width: w,
                height: h,
                landmarks: landmarks ?? [],
                frame,
                time: now,
              });
            } catch (err) {
              console.error("Filter render error:", err);
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, facing]);

  const handleSwitchCamera = () => {
    setFacing((f) => (f === "user" ? "environment" : "user"));
  };

  const handleRandomFilter = () => {
    const idx = Math.floor(Math.random() * FILTERS.length);
    setActiveFilter(FILTERS[idx]);
  };

  const handleTakePhoto = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapture({ type: "image", dataUrl });
  };

  const handleStartRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) return;
    recordedChunksRef.current = [];
    const stream = canvas.captureStream(30);
    // Add audio if available
    const audio = streamRef.current?.getAudioTracks();
    if (audio && audio.length) {
      stream.addTrack(audio[0]);
    }
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (e) => {
      if (e.data.size) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setCapture({ type: "video", url, blob });
      setIsRecording(false);
      setRecordingProgress(0);
    };
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);

    const startTime = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = Math.min(elapsed / 15, 1);
      setRecordingProgress(progress);
      if (progress >= 1) {
        handleStopRecording();
        return;
      }
      recordingTimerRef.current = window.setTimeout(tick, 100);
    };
    tick();
  };

  const handleStopRecording = () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  return (
    <div ref={containerRef} className="relative h-dvh w-full overflow-hidden bg-black text-white">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-center px-6">
          <div className="text-5xl animate-bounce">🎭</div>
          <p className="text-sm opacity-80">{loadingMessage}</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
          <div className="text-5xl">😕</div>
          <p className="text-sm opacity-90">{error}</p>
          <button
            onClick={() => startCamera(facing)}
            className="mt-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
          >
            Réessayer
          </button>
        </div>
      )}

      {ready && (
        <>
          <TopControls
            onSwitchCamera={handleSwitchCamera}
            onRandomFilter={handleRandomFilter}
            onOpenCategories={() => setShowCategoryPicker(true)}
            search={search}
            onSearchChange={setSearch}
            activeFilter={activeFilter}
          />

          <CategoryBar
            open={showCategoryPicker}
            onClose={() => setShowCategoryPicker(false)}
            category={category}
            onSelectCategory={(c) => {
              setCategory(c);
              setShowCategoryPicker(false);
            }}
          />

          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-6">
            <FilterCarousel
              category={category}
              search={search}
              activeFilterId={activeFilter.id}
              onSelect={setActiveFilter}
            />
            <CaptureButton
              isRecording={isRecording}
              progress={recordingProgress}
              onPhoto={handleTakePhoto}
              onStartRecord={handleStartRecording}
              onStopRecord={handleStopRecording}
            />
          </div>
        </>
      )}

      {capture && (
        <CapturePreview
          capture={capture}
          onClose={() => {
            if (capture.type === "video") URL.revokeObjectURL(capture.url);
            setCapture(null);
          }}
        />
      )}
    </div>
  );
}
