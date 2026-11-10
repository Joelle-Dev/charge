export const PROFILE_NAME_MAX = 12;
export const PROFILE_AVATAR_MAX_LENGTH = 320000;
export const PROFILE_AVATAR_INPUT_MAX = 12 * 1024 * 1024;

export const PROFILE_AVATARS = [
  { id: 'cat', label: '猫猫' },
  { id: 'dog', label: '狗狗' },
  { id: 'rabbit', label: '兔兔' },
  { id: 'panda', label: '熊猫' },
  { id: 'fox', label: '狐狸' },
  { id: 'bear', label: '小熊' },
  { id: 'koala', label: '考拉' },
  { id: 'tiger', label: '老虎' },
  { id: 'lion', label: '狮子' },
  { id: 'frog', label: '青蛙' },
  { id: 'hamster', label: '仓鼠' },
  { id: 'pig', label: '小猪' }
];

export const PROFILE_AVATAR_IDS = PROFILE_AVATARS.map((item) => item.id);
export const DEFAULT_PROFILE = {
  name: '',
  avatar: { type: 'initial', value: '' }
};

const IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|webp);base64,/i;

export function isAllowedAvatarImage(value) {
  return typeof value === 'string' &&
    value.length <= PROFILE_AVATAR_MAX_LENGTH &&
    IMAGE_DATA_URL.test(value);
}

export function normalizeProfile(raw) {
  const name = typeof raw?.name === 'string'
    ? Array.from(raw.name.trim()).slice(0, PROFILE_NAME_MAX).join('')
    : '';

  let avatar = { ...DEFAULT_PROFILE.avatar };
  if (raw?.avatar && typeof raw.avatar === 'object' && !Array.isArray(raw.avatar)) {
    if (raw.avatar.type === 'image' && isAllowedAvatarImage(raw.avatar.value)) {
      avatar = { type: 'image', value: raw.avatar.value };
    } else if (raw.avatar.type === 'preset' && PROFILE_AVATAR_IDS.includes(raw.avatar.value)) {
      avatar = { type: 'preset', value: raw.avatar.value };
    } else if (raw.avatar.type === 'initial') {
      avatar = { type: 'initial', value: '' };
    }
  }

  return { name, avatar };
}

export function validateProfile(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    return '备份里的个人资料格式不正确';
  }
  if (value.name !== undefined && typeof value.name !== 'string') {
    return '备份里的昵称格式不正确';
  }
  if (typeof value.name === 'string' && Array.from(value.name.trim()).length > PROFILE_NAME_MAX) {
    return '备份里的昵称太长啦';
  }
  if (value.avatar === undefined) return null;
  if (!value.avatar || typeof value.avatar !== 'object' || Array.isArray(value.avatar)) {
    return '备份里的头像格式不正确';
  }
  if (value.avatar.type === 'initial') {
    return null;
  }
  if (value.avatar.type === 'preset') {
    if (!PROFILE_AVATAR_IDS.includes(value.avatar.value)) {
      return '备份里的头像不认识';
    }
    return null;
  }
  if (value.avatar.type === 'image') {
    if (!isAllowedAvatarImage(value.avatar.value)) {
      return '备份里的头像图片不正确或太大';
    }
    return null;
  }
  return '备份里的头像格式不正确';
}

export function profileDisplayName(profile) {
  return profile?.name?.trim() || '小果';
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 5) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 13) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}
