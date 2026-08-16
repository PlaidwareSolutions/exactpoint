"use client";

/**
 * Loads the Maps JavaScript API once per page using the browser-restricted
 * key (referrer-locked; safe to expose). Server keys never appear here.
 */
declare global {
  interface Window {
    google?: typeof google;
  }
}

let pending: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("browser only"));
  }
  if (window.google?.maps) return Promise.resolve(window.google);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
      if (!key) {
        reject(new Error("Maps browser key not configured"));
        return;
      }
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=drawing&v=weekly`;
      script.async = true;
      script.onload = () => {
        if (window.google?.maps) resolve(window.google);
        else reject(new Error("Maps failed to initialize"));
      };
      script.onerror = () => {
        pending = null;
        reject(new Error("Maps script failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return pending;
}

export const HOUSTON_CENTER = { lat: 29.76, lng: -95.42 };
