import { showImagePreview } from 'vant';

function isCoarsePointer() {
  return typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
}

export async function saveImage(dataUrl, filename, { title = '', text = '' } = {}) {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare) {
    let canShare = false;
    try {
      canShare = Boolean(navigator.canShare({ files: [file] }));
    } catch (err) {
      canShare = false;
    }
    if (canShare) {
      try {
        await navigator.share({ files: [file], title, text });
        return 'share';
      } catch (err) {
        if (err?.name === 'AbortError') return 'cancelled';
      }
    }
  }

  if (isCoarsePointer()) {
    // iOS/Android home-screen browsers cannot reliably download data URLs.
    // Show the image so the user can long-press and save it to Photos/Files.
    showImagePreview({ images: [dataUrl] });
    return 'preview';
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'download';
}
