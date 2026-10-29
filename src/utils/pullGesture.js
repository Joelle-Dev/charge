export const PULL_OPEN_THRESHOLD = 0.22;
const PULL_DISTANCE_RATIO = 0.5;

export function clampPull(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function pullProgress(startY, currentY, viewportHeight) {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0;
  const distance = currentY - startY;
  if (distance <= 0) return 0;
  return clampPull(distance / (viewportHeight * PULL_DISTANCE_RATIO));
}

export function isDownwardPull(startX, startY, currentX, currentY) {
  const dx = currentX - startX;
  const dy = currentY - startY;
  return dy > 8 && dy > Math.abs(dx) * 1.2;
}

export function isHorizontalGesture(startX, startY, currentX, currentY) {
  const dx = currentX - startX;
  const dy = currentY - startY;
  return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2;
}

export function shouldOpenCurtain(progress, velocity = 0, startOpen = false) {
  if (velocity > 0.5) return true;
  if (velocity < -0.5) return false;
  return clampPull(progress) >= (startOpen ? 0.65 : PULL_OPEN_THRESHOLD);
}

export function curtainVisibleHeight(progress, height) {
  if (!Number.isFinite(height) || height <= 0) return 0;
  return clampPull(progress) * height;
}
