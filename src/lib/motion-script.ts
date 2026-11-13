/*
 * Motion preference bootstrap, kept free of React so the (server) root layout
 * can inline it. Runs in <head> before the first paint and keeps
 * <html data-motion="full|reduce"> in sync for the lifetime of the document:
 * OS setting changes, other tabs (storage) and the in-app menu (custom event).
 * The same logic lives in applyMotion() in src/lib/motion.ts.
 */
export const MOTION_STORAGE_KEY = "fz-motion";
export const MOTION_EVENT = "fz-motion-change";

export const MOTION_INIT_SCRIPT =
  "(function(){var d=document.documentElement,m=window.matchMedia?window.matchMedia(\"(prefers-reduced-motion: reduce)\"):null;" +
  "function a(){var v=null;try{v=localStorage.getItem(\"" + MOTION_STORAGE_KEY + "\")}catch(e){}" +
  "d.setAttribute(\"data-motion\",v===\"on\"?\"full\":v===\"reduced\"||(m&&m.matches)?\"reduce\":\"full\")}" +
  "a();if(m&&m.addEventListener)m.addEventListener(\"change\",a);" +
  "window.addEventListener(\"storage\",function(e){if(!e.key||e.key===\"" + MOTION_STORAGE_KEY + "\")a()});" +
  "window.addEventListener(\"" + MOTION_EVENT + "\",a)})()";
