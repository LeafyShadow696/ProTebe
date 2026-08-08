import { useEffect, useState } from "react";

import { isLowPowerDevice } from "@/lib/idle";

export function AmbientBackground() {
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    if (isLowPowerDevice()) {
      setLowPower(true);
      document.documentElement.classList.add("low-power");
    }
  }, []);

  const blurA = lowPower ? "blur-[48px]" : "blur-[90px]";
  const blurB = lowPower ? "blur-[56px]" : "blur-[110px]";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ contain: "strict" }}
    >
      <div
        className={`ambient-bloom absolute -left-[28vw] -top-[22vh] h-[78vw] w-[78vw] rounded-full ${blurA}`}
        style={{
          background: "radial-gradient(circle, var(--primary) 0%, transparent 68%)",
          opacity: 0.34,
          animation: lowPower ? undefined : "breathe 14s ease-in-out infinite",
          willChange: lowPower ? undefined : "transform, opacity",
        }}
      />
      <div
        className={`ambient-bloom absolute -bottom-[26vh] -right-[26vw] h-[86vw] w-[86vw] rounded-full ${blurB}`}
        style={{
          background: "radial-gradient(circle, var(--primary-glow) 0%, transparent 70%)",
          opacity: 0.22,
          animation: lowPower ? undefined : "drift 22s ease-in-out infinite",
          willChange: lowPower ? undefined : "transform",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, transparent 40%, var(--background) 100%)",
        }}
      />
    </div>
  );
}
