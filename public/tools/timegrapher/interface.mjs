// Presentation preferences only. Measurement duration and evaluation are shared.
export function positionForView(view, expertPosition) {
  return view === 'quick' ? 'dial_up' : expertPosition;
}
export function readPreference(storage, key, allowed, fallback) {
  try { const value=storage?.getItem(key); return allowed.includes(value)?value:fallback; }
  catch { return fallback; }
}
