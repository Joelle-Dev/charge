export function toMessage(error) {
  return String(error?.message || error || '未知错误');
}
