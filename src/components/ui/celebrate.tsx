"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { isReducedMotion } from "@/lib/motion";
import { cx } from "./cx";

/*
 * Celebration kit: a confetti burst, an animated success checkmark and a
 * number that counts up. Used only after a successful server response.
 * Everything respects the effective motion mode (<html data-motion>, see
 * src/lib/motion.ts – the in-app setting wins over the OS): under "reduce"
 * there is no confetti, the checkmark and the counter show their final state.
 */

/** True when animations should not move (in-app setting, else the OS). */
export function prefersReducedMotion(): boolean {
  return isReducedMotion();
}

// Asseco blue shades, the logo black and light tones – no rainbow.
const COLORS = [
  "#00a3e0", // brand-500, the official blue
  "#00a3e0",
  "#0079b0", // brand-600
  "#2bb4e6", // brand-400
  "#5cc6ec", // brand-300
  "#99dbf3", // brand-200
  "#005e8a", // brand-800
  "#1d1d1d", // ink
  "#ccedf9", // brand-100
];

export type ConfettiOptions = {
  /** "full" for the big moments, "light" for a subtle burst. */
  intensity?: "full" | "light";
  /** Burst origin as a fraction of the viewport (0–1). */
  origin?: { x: number; y: number };
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  wobble: number;
  size: number;
  color: string;
  round: boolean;
};

const GRAVITY = 1500; // px/s²
const DRAG = 1.9; // velocity decay per second (exponential)

/**
 * Fires one burst on a temporary full-screen canvas, which removes itself when
 * the burst ends. Returns a function that stops it early (e.g. on unmount).
 */
export function fireConfetti({ intensity = "full", origin = { x: 0.5, y: 0.35 } }: ConfettiOptions = {}): () => void {
  if (prefersReducedMotion()) return () => {};

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.confetti = "true";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "60",
  });

  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.scale(ratio, ratio);
  document.body.appendChild(canvas);

  const full = intensity === "full";
  const count = full ? 130 : 48;
  const duration = full ? 1450 : 1400; // IT-02: at most 1.5 s
  const spread = (full ? 110 : 80) * (Math.PI / 180);
  const speed = full ? 1050 : 760;
  const ox = origin.x * width;
  const oy = origin.y * height;

  const particles: Particle[] = Array.from({ length: count }, () => {
    const direction = -Math.PI / 2 + (Math.random() - 0.5) * spread;
    const velocity = speed * (0.45 + Math.random() * 0.55);
    return {
      x: ox + (Math.random() - 0.5) * 24,
      y: oy + (Math.random() - 0.5) * 12,
      vx: Math.cos(direction) * velocity,
      vy: Math.sin(direction) * velocity,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 12,
      flip: Math.random() * Math.PI * 2,
      flipSpeed: 6 + Math.random() * 8,
      wobble: Math.random() * Math.PI * 2,
      size: 5 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() < 0.3,
    };
  });

  let frame = 0;
  let stopped = false;
  const start = performance.now();
  let last = start;

  // The canvas is sized for this viewport; a resize or a hidden tab ends the burst.
  const onVisibility = () => {
    if (document.visibilityState === "hidden") stop();
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", stop);
    window.removeEventListener("orientationchange", stop);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.remove();
  };
  window.addEventListener("resize", stop);
  window.addEventListener("orientationchange", stop);
  document.addEventListener("visibilitychange", onVisibility);

  const tick = (now: number) => {
    const elapsed = now - start;
    if (elapsed >= duration) return stop();
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const decay = Math.exp(-DRAG * dt);
    // Fade out over the last 35 % of the burst.
    const alpha = Math.min(1, (1 - elapsed / duration) / 0.35);

    context.clearRect(0, 0, width, height);
    context.globalAlpha = alpha;
    for (const p of particles) {
      p.vx = p.vx * decay + Math.sin(p.wobble + elapsed / 260) * 40 * dt; // sideways drift
      p.vy = p.vy * decay + GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.flip += p.flipSpeed * dt;
      if (p.y > height + 20) continue;

      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.angle);
      context.scale(1, Math.cos(p.flip)); // paper flipping in 3D
      context.fillStyle = p.color;
      if (p.round) {
        context.beginPath();
        context.arc(0, 0, p.size * 0.42, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      }
      context.restore();
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return stop;
}

/**
 * Returns a `fire(options)` function for event handlers (e.g. after a 201).
 * A running burst is stopped when the component unmounts.
 */
export function useConfetti(): (options?: ConfettiOptions) => void {
  const stopRef = useRef<() => void>(() => {});
  useEffect(() => {
    const stops = stopRef;
    return () => stops.current();
  }, []);
  return useCallback((options?: ConfettiOptions) => {
    stopRef.current();
    stopRef.current = fireConfetti(options);
  }, []);
}

/**
 * Declarative burst: fires once when mounted with `fire` (or when `fire` turns
 * true). Under StrictMode the effect runs twice in development; the cleanup
 * stops the first burst, so only one is ever visible.
 */
export function Confetti({ fire = true, ...options }: ConfettiOptions & { fire?: boolean }) {
  const { intensity, origin } = options;
  const x = origin?.x;
  const y = origin?.y;
  useEffect(() => {
    if (!fire) return;
    return fireConfetti({
      intensity,
      origin: x === undefined || y === undefined ? undefined : { x, y },
    });
  }, [fire, intensity, x, y]);
  return null;
}

/** Success checkmark: a ring and a tick drawn with a stroke animation. Decorative. */
export function SuccessCheck({ size = 64, className }: { size?: number; className?: string }) {
  const stroke = { strokeDasharray: 1 };
  return (
    <span
      aria-hidden="true"
      className={cx("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 animate-pop rounded-full bg-brand-50" />
      <svg viewBox="0 0 52 52" width={size} height={size} fill="none" className="relative">
        <circle
          cx="26"
          cy="26"
          r="24"
          stroke="currentColor"
          strokeWidth="2"
          pathLength={1}
          className="animate-draw text-brand-500"
          style={stroke}
          transform="rotate(-90 26 26)"
        />
        <path
          d="M16.5 27l6.5 6.5L36 19.5"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="animate-draw-late text-brand-600"
          style={stroke}
        />
      </svg>
    </span>
  );
}

/**
 * A number that counts up from 0 once after mount. The server renders the
 * final value (no hydration mismatch, correct without JavaScript); screen
 * readers always get the final value.
 */
export function CountUp({
  value,
  duration = 900,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || value <= 0 || isReducedMotion()) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(eased * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    element.textContent = "0";
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      element.textContent = String(value);
    };
  }, [value, duration]);

  return (
    <span className={cx("tabular-nums", className)}>
      <span ref={ref} aria-hidden="true">
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
