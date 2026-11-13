import { useSyncExternalStore } from "react";
import { MOTION_EVENT, MOTION_INIT_SCRIPT, MOTION_STORAGE_KEY } from "./motion-script";

/*
 * Motion preference. The user picks "system" (default), "on" or "reduced" in
 * the header menu; the effective mode lives on <html data-motion="full|reduce">
 * and drives the CSS in globals.css and the JS animations (confetti, CountUp).
 * Windows "Animation effects: off" makes browsers report
 * prefers-reduced-motion: reduce – "on" overrides that for this app only.
 */

export type MotionPreference = "system" | "on" | "reduced";

export { MOTION_INIT_SCRIPT };

const QUERY = "(prefers-reduced-motion: reduce)";

function readPreference(): MotionPreference {
  try {
    const value = window.localStorage.getItem(MOTION_STORAGE_KEY);
    return value === "on" || value === "reduced" ? value : "system";
  } catch {
    return "system";
  }
}

function systemReduced(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}

/** Writes the effective mode to <html data-motion>. */
function applyMotion(): void {
  const preference = readPreference();
  const reduce = preference === "reduced" || (preference === "system" && systemReduced());
  document.documentElement.setAttribute("data-motion", reduce ? "reduce" : "full");
}

export function setMotionPreference(preference: MotionPreference): void {
  try {
    if (preference === "system") window.localStorage.removeItem(MOTION_STORAGE_KEY);
    else window.localStorage.setItem(MOTION_STORAGE_KEY, preference);
  } catch {
    // Storage blocked (private mode): the choice still applies to this page.
  }
  applyMotion();
  window.dispatchEvent(new Event(MOTION_EVENT));
}

/**
 * True when animations should not move things: the effective mode is
 * "reduce", or we are on the server / cannot tell.
 */
export function isReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const mode = document.documentElement.getAttribute("data-motion");
  if (mode === "full") return false;
  if (mode === "reduce") return true;
  return systemReduced();
}

function subscribePreference(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === MOTION_STORAGE_KEY) callback();
  };
  window.addEventListener(MOTION_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MOTION_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** [preference, setPreference] – stays in sync across components and tabs. */
export function useMotionPreference(): [MotionPreference, (preference: MotionPreference) => void] {
  const preference = useSyncExternalStore(subscribePreference, readPreference, () => "system" as const);
  return [preference, setMotionPreference];
}

function subscribeSystem(callback: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** Whether the operating system asks for reduced motion (live). */
export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribeSystem, systemReduced, () => false);
}
