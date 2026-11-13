const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function backupReminder(timestamp, now = Date.now(), { overdueDays = 14 } = {}) {
  const at = Number(timestamp);
  if (!at || !Number.isFinite(at)) {
    return {
      never: true,
      overdue: true,
      days: null,
      text: '还没打包过，导出一份更安心'
    };
  }

  // 按日历天数算，不是按 24 小时块
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS));
  if (days >= overdueDays) {
    return {
      never: false,
      overdue: true,
      days,
      text: `${days} 天没打包啦，导出一份更安心`
    };
  }

  const relative = days <= 0 ? '今天' : days === 1 ? '昨天' : `${days} 天前`;
  return {
    never: false,
    overdue: false,
    days,
    text: `上次打包：${relative}`
  };
}
