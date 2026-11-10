import {
  PROFILE_AVATAR_INPUT_MAX,
  PROFILE_AVATAR_MAX_LENGTH
} from './profile';

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读不出来'));
    };
    image.src = url;
  });
}

async function loadSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (err) {
      // Fall back to an <img> decoder below.
    }
  }
  return loadImage(file);
}

function drawSquare(source, side) {
  const width = source.width || source.naturalWidth || 0;
  const height = source.height || source.naturalHeight || 0;
  if (!width || !height) throw new Error('图片尺寸不对');

  const crop = Math.min(width, height);
  const sx = (width - crop) / 2;
  const sy = (height - crop) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('图片处理失败');
  context.fillStyle = '#faf5ec';
  context.fillRect(0, 0, side, side);
  context.drawImage(source, sx, sy, crop, crop, 0, 0, side, side);
  return canvas;
}

function encode(canvas, type, quality) {
  return canvas.toDataURL(type, quality);
}

export async function fileToAvatarDataUrl(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('请选择一张图片');
  }
  if (file.size > PROFILE_AVATAR_INPUT_MAX) {
    throw new Error('图片太大啦，换一张小一点的');
  }

  const source = await loadSource(file);
  try {
    const attempts = [
      [256, 0.82],
      [224, 0.76],
      [192, 0.7]
    ];

    let fallback = '';
    for (const [side, quality] of attempts) {
      const canvas = drawSquare(source, side);
      const webp = encode(canvas, 'image/webp', quality);
      if (webp.startsWith('data:image/webp') && webp.length <= PROFILE_AVATAR_MAX_LENGTH) {
        return webp;
      }
      const jpeg = encode(canvas, 'image/jpeg', quality);
      if (jpeg.length <= PROFILE_AVATAR_MAX_LENGTH) {
        return jpeg;
      }
      fallback = jpeg;
    }
    if (fallback) throw new Error('图片有点大，换一张试试');
    throw new Error('图片处理失败');
  } finally {
    source.close?.();
  }
}
