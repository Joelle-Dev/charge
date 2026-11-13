export function toMessage(error) {
  return String(error?.message || error || '未知错误');
}

/**
 * Errors that are expected during normal use (user cancels a share/dialog,
 * a request is aborted) should not surface a global "something broke" toast.
 */
export function isIgnorableError(error) {
  if (!error) return true;
  const name = String(error?.name || '');
  if (name === 'AbortError') return true;
  if (error === 'cancel' || error === 'close') return true;
  return /user (?:aborted|cancell?ed)|operation was aborted|request was aborted/i
    .test(toMessage(error));
}
