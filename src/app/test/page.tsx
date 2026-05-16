"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { FILTERS, NO_FILTER, computeFaceFrame, getAllUsedEmojis, type Filter } from "@/lib/filters";
import { preloadEmojis } from "@/lib/twemoji";

const TEST_IMAGE = "/test-face.jpg";

type Pt = { x: number; y: number; z?: number };

export default function TestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [filter, setFilter] = useState<Filter>(FILTERS[0]);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [landmarks, setLandmarks] = useState<Pt[] | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState("Initialisation…");

  // Initial load: image + emojis + face landmarker + detect
  useEffect(() => {
    (async () => {
      setStatus("Préchargement Twemoji…");
      await preloadEmojis(getAllUsedEmojis());

      setStatus("Chargement de l'image…");
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = TEST_IMAGE;
      await image.decode();
      setImg(image);

      setStatus("Chargement MediaPipe…");
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numFaces: 1,
      });

      setStatus("Détection du visage…");
      const result = landmarker.detect(image);
      if (result.faceLandmarks?.[0]) {
        setLandmarks(result.faceLandmarks[0] as Pt[]);
        setStatus(`Prêt — ${result.faceLandmarks[0].length} points détectés`);
      } else {
        setStatus("Aucun visage détecté");
      }
    })().catch((e) => setStatus("Erreur: " + (e as Error).message));
  }, []);

  // Render whenever filter / landmarks / showLandmarks changes
  useEffect(() => {
    if (!img || !landmarks) return;
    const canvas = canvasRef.current!;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    const frame = computeFaceFrame(landmarks, canvas.width, canvas.height);
    if (filter.id !== "none" && (frame || !filter.needsFace)) {
      try {
        filter.render({
          ctx,
          width: canvas.width,
          height: canvas.height,
          landmarks,
          frame,
          time: 0,
        });
      } catch (e) {
        console.error("render error", e);
      }
    }

    if (showLandmarks && frame) {
      const anchors = [
        { name: "forehead", p: frame.forehead, color: "#ff0" },
        { name: "topOfHead", p: frame.topOfHead, color: "#fa0" },
        { name: "noseTip", p: frame.noseTip, color: "#0ff" },
        { name: "chin", p: frame.chin, color: "#f0f" },
        { name: "leftEye", p: frame.leftEye, color: "#0f0" },
        { name: "rightEye", p: frame.rightEye, color: "#0f0" },
        { name: "leftCheek", p: frame.leftCheek, color: "#f00" },
        { name: "rightCheek", p: frame.rightCheek, color: "#f00" },
        { name: "mouthCenter", p: frame.mouthCenter, color: "#fff" },
      ];
      ctx.save();
      ctx.font = "bold 14px sans-serif";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000";
      for (const a of anchors) {
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(a.p.x, a.p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.strokeText(a.name, a.p.x + 9, a.p.y + 4);
        ctx.fillText(a.name, a.p.x + 9, a.p.y + 4);
      }
      // head bounding box
      ctx.strokeStyle = "rgba(0,255,0,0.5)";
      ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(frame.center.x, frame.center.y);
      ctx.rotate(frame.angle);
      ctx.strokeRect(-frame.headWidth / 2, -frame.headHeight / 2, frame.headWidth, frame.headHeight);
      ctx.restore();
      // face bounding box
      ctx.strokeStyle = "rgba(255,0,0,0.5)";
      ctx.save();
      ctx.translate(frame.center.x, frame.center.y);
      ctx.rotate(frame.angle);
      ctx.strokeRect(-frame.faceWidth / 2, -frame.faceHeight / 2, frame.faceWidth, frame.faceHeight);
      ctx.restore();
      ctx.restore();
    }
  }, [img, landmarks, filter, showLandmarks]);

  const groupedFilters = useMemo(() => {
    const groups: Record<string, Filter[]> = {};
    for (const f of FILTERS) {
      (groups[f.category] ??= []).push(f);
    }
    return groups;
  }, []);

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4">
      <div className="mb-3 text-sm opacity-80">{status}</div>
      <div className="flex gap-4 flex-wrap items-start">
        <canvas ref={canvasRef} className="bg-black border border-white/20" style={{ width: 600, height: 675 }} />
        <div className="flex flex-col gap-2 max-h-[90vh] overflow-y-auto min-w-[260px]">
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={showLandmarks}
              onChange={(e) => setShowLandmarks(e.target.checked)}
            />
            <span>Show landmarks</span>
          </label>
          <button
            onClick={() => setFilter(NO_FILTER)}
            className={`text-left px-3 py-1.5 rounded text-sm ${
              filter.id === "none" ? "bg-white text-black" : "bg-neutral-700 hover:bg-neutral-600"
            }`}
          >
            🚫 Aucun
          </button>
          {Object.entries(groupedFilters).map(([cat, filters]) => (
            <div key={cat}>
              <div className="text-xs uppercase tracking-wider opacity-50 mt-3 mb-1">{cat}</div>
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f)}
                  className={`block w-full text-left px-3 py-1.5 rounded text-sm mb-1 ${
                    filter.id === f.id ? "bg-white text-black" : "bg-neutral-700 hover:bg-neutral-600"
                  }`}
                >
                  {f.emoji} {f.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
