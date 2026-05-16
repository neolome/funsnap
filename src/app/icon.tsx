import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ff006e 0%, #8338ec 50%, #3a86ff 100%)",
          fontSize: 360,
        }}
      >
        🎭
      </div>
    ),
    { ...size },
  );
}
