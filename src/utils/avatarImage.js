import {
  PROFILE_AVATAR_INPUT_MAX,
  PROFILE_AVATAR_MAX_LENGTH
} from './profile.js';

const OUTPUT_ATTEMPTS = [
  [384, 0.92],
  [320, 0.88],
  [256, 0.82],
  [192, 0.74]
];

function loadElement(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读不出来'));
    image.src = url;
  });
}

function sourceSize(source) {
  const width = source?.width || source?.naturalWidth || 0;
  const height = source?.height || source?.naturalHeight || 0;
  if (!width || !height) throw new Error('图片尺寸不对');
  return { width, height };
}

export function avatarBaseScale(width, height, stageSize) {
  if (!width || !height || !stageSize) return 0;
  return Math.max(stageSize / width, stageSize / height);
}

export function clampAvatarOffset(width, height, stageSize, zoom, x = 0, y = 0) {
  const scale = avatarBaseScale(width, height, stageSize) * zoom;
  const maxX = Math.max(0, (width * scale - stageSize) / 2);
  const maxY = Math.max(0, (height * scale - stageSize) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, Number(x) || 0)) + 0,
    y: Math.min(maxY, Math.max(-maxY, Number(y) || 0)) + 0
  };
}

export function avatarCropRect(width, height, { stageSize, zoom = 1, offsetX = 0, offsetY = 0 } = {}) {
  const scale = avatarBaseScale(width, height, stageSize) * zoom;
  if (!scale) throw new Error('图片尺寸不对');
  const side = stageSize / scale;
  const maxSx = Math.max(0, width - side);
  const maxSy = Math.max(0, height - side);
  const sx = Math.min(maxSx, Math.max(0, width / 2 - (stageSize / 2 + offsetX) / scale));
  const sy = Math.min(maxSy, Math.max(0, height / 2 - (stageSize / 2 + offsetY) / scale));
  return { sx, sy, sw: side, sh: side };
}

export async function loadAvatarSource(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('请选择一张图片');
  }
  if (file.size > PROFILE_AVATAR_INPUT_MAX) {
    throw new Error('图片太大啦，换一张小一点的');
  }

  const previewUrl = URL.createObjectURL(file);
  let source = null;
  try {
    if (typeof createImageBitmap === 'function') {
      source = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
    }
    if (!source) source = await loadElement(previewUrl);
  } catch (err) {
    URL.revokeObjectURL(previewUrl);
    throw new Error('图片读不出来');
  }

  const { width, height } = sourceSize(source);
  return {
    source,
    previewUrl,
    width,
    height,
    close() {
      source?.close?.();
      URL.revokeObjectURL(previewUrl);
    }
  };
}

function drawCropped(source, crop, side) {
  const { width, height } = sourceSize(source);
  const rect = avatarCropRect(width, height, crop);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('图片处理失败');
  context.fillStyle = '#faf5ec';
  context.fillRect(0, 0, side, side);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, side, side);
  return canvas;
}

export async function renderAvatarDataUrl(source, crop) {
  let lastError = null;
  for (const [side, quality] of OUTPUT_ATTEMPTS) {
    const canvas = drawCropped(source, crop, side);
    const webp = canvas.toDataURL('image/webp', quality);
    if (webp.startsWith('data:image/webp') && webp.length <= PROFILE_AVATAR_MAX_LENGTH) {
      return webp;
    }
    const jpeg = canvas.toDataURL('image/jpeg', quality);
    if (jpeg.length <= PROFILE_AVATAR_MAX_LENGTH) return jpeg;
    lastError = new Error('图片有点大，换一张试试');
  }
  throw lastError || new Error('图片处理失败');
}
