const PATTERNS = {
  light: 8,
  medium: 16,
  success: [10, 32, 14],
  warning: [18, 42, 18]
};

export function haptic(type = 'light') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[type] || PATTERNS.light);
  } catch (err) {
    // iOS Safari and some browsers don't support vibration.
  }
}
