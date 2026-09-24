import { useEffect, useState } from "react";
import API from "./axios";

// Chain-wide settings: the "Manage Branches" switch and the support contacts.
// Fetched once per page load and shared by every component that needs it.
export const PLATFORM_CHANGED_EVENT = "bhojan:platform-changed";

let cache = null;
let inflight = null;

export const loadPlatform = async ({ force = false } = {}) => {
  if (cache && !force) return cache;
  if (!inflight || force) {
    inflight = API.get("/platform")
      .then((res) => {
        cache = res.data.platform;
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
};

export const setPlatformCache = (platform) => {
  cache = platform;
  window.dispatchEvent(new Event(PLATFORM_CHANGED_EVENT));
};

// Returns null until loaded.
export function usePlatform() {
  const [platform, setPlatform] = useState(cache);

  useEffect(() => {
    let alive = true;
    loadPlatform()
      .then((value) => alive && setPlatform(value))
      .catch(() => {});

    const refresh = () => setPlatform(cache);
    window.addEventListener(PLATFORM_CHANGED_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(PLATFORM_CHANGED_EVENT, refresh);
    };
  }, []);

  return platform;
}
