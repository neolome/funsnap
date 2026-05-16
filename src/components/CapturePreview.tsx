"use client";

type Capture = { type: "image"; dataUrl: string } | { type: "video"; url: string; blob: Blob };

type Props = {
  capture: Capture;
  onClose: () => void;
};

export function CapturePreview({ capture, onClose }: Props) {
  const handleDownload = () => {
    const a = document.createElement("a");
    const ts = Date.now();
    if (capture.type === "image") {
      a.href = capture.dataUrl;
      a.download = `funsnap-${ts}.jpg`;
    } else {
      a.href = capture.url;
      a.download = `funsnap-${ts}.webm`;
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleShare = async () => {
    try {
      if (capture.type === "image") {
        const res = await fetch(capture.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `funsnap-${Date.now()}.jpg`, { type: "image/jpeg" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "FunSnap" });
          return;
        }
      } else {
        const file = new File([capture.blob], `funsnap-${Date.now()}.webm`, { type: "video/webm" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "FunSnap" });
          return;
        }
      }
      // Fallback: download
      handleDownload();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        {capture.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capture.dataUrl} alt="Capture" className="h-full w-full object-contain" />
        ) : (
          <video
            src={capture.url}
            controls
            autoPlay
            loop
            playsInline
            className="h-full w-full object-contain"
          />
        )}

        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white text-xl backdrop-blur"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center justify-around gap-4 bg-black px-6 py-5">
        <ActionButton emoji="💾" label="Télécharger" onClick={handleDownload} />
        <ActionButton emoji="📤" label="Partager" onClick={handleShare} primary />
        <ActionButton emoji="🔄" label="Reprendre" onClick={onClose} />
      </div>
    </div>
  );
}

function ActionButton({
  emoji,
  label,
  onClick,
  primary,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${primary ? "rounded-full bg-white px-6 py-3 text-black" : "text-white"}`}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
