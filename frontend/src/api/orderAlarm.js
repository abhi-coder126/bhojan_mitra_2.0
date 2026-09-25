// One shared <audio> for the new-order ringtone (public/ordertune.mp3), so the
// global alarm, the Restaurant Orders page and the Settings test button never
// ring over each other.
export const ORDER_TUNE_SRC = "/ordertune.mp3";
export const ORDERS_UPDATED_EVENT = "bhojan:restaurant-orders-updated";
export const ORDER_SETTINGS_CHANGED_EVENT = "bhojan:order-settings-changed";

let audio = null;

const getAudio = () => {
  if (!audio && typeof Audio !== "undefined") {
    audio = new Audio(ORDER_TUNE_SRC);
    audio.preload = "auto";
  }
  return audio;
};

// Starts the looping ringtone. Resolves false when the browser blocked autoplay
// (no user interaction on the page yet), so the caller can ask for a tap.
export const startOrderAlarm = async (repeat = true) => {
  const el = getAudio();
  if (!el) return false;
  // repeat off: ring once per new order instead of until it is accepted.
  el.loop = repeat;
  if (!el.paused) return true;
  try {
    await el.play();
    return true;
  } catch {
    return false;
  }
};

export const stopOrderAlarm = () => {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
};

// Settings "Test Sound": plays the tune once.
export const playOrderTuneOnce = async () => {
  const el = getAudio();
  if (!el) return false;
  // A live order alarm is already audible; do not cut its loop short.
  if (!el.paused && el.loop) return true;
  el.loop = false;
  el.currentTime = 0;
  try {
    await el.play();
    return true;
  } catch {
    return false;
  }
};

export const notifyOrdersUpdated = (orders) =>
  window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT, { detail: orders }));
