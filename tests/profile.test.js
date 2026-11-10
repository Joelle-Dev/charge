import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROFILE,
  PROFILE_AVATAR_IDS,
  PROFILE_NAME_MAX,
  greetingForHour,
  isAllowedAvatarImage,
  normalizeProfile,
  profileDisplayName,
  validateProfile
} from '../src/utils/profile.js';

const IMAGE = 'data:image/webp;base64,AAAA';

test('normalizeProfile returns defaults for empty input', () => {
  assert.deepEqual(normalizeProfile(null), { name: '', avatar: { type: 'initial', value: '' } });
  assert.deepEqual(normalizeProfile(undefined), { name: '', avatar: { type: 'initial', value: '' } });
  assert.deepEqual(normalizeProfile(DEFAULT_PROFILE), DEFAULT_PROFILE);
});

test('normalizeProfile trims and limits the nickname', () => {
  const name = 'x'.repeat(PROFILE_NAME_MAX + 5);
  const profile = normalizeProfile({ name: `  ${name}  `, avatar: { type: 'preset', value: 'dog' } });
  assert.equal(profile.name.length, PROFILE_NAME_MAX);
  assert.equal(profile.avatar.value, 'dog');
});

test('normalizeProfile falls back for unknown or invalid avatars', () => {
  assert.deepEqual(normalizeProfile({ avatar: { type: 'preset', value: 'unknown' } }).avatar, DEFAULT_PROFILE.avatar);
  assert.deepEqual(normalizeProfile({ avatar: { type: 'image', value: 'https://x.test/a.png' } }).avatar, DEFAULT_PROFILE.avatar);
  assert.deepEqual(normalizeProfile({ avatar: { type: 'image', value: 'data:text/plain;base64,AAAA' } }).avatar, DEFAULT_PROFILE.avatar);
  assert.deepEqual(normalizeProfile({ avatar: { type: 'image', value: `data:image/webp;base64,${'a'.repeat(320001)}` } }).avatar, DEFAULT_PROFILE.avatar);
});

test('normalizeProfile keeps an uploaded image', () => {
  const profile = normalizeProfile({ name: '小果', avatar: { type: 'image', value: IMAGE } });
  assert.deepEqual(profile.avatar, { type: 'image', value: IMAGE });
});

test('profile validation accepts sane data and rejects malformed backups', () => {
  assert.equal(validateProfile(undefined), null);
  assert.equal(validateProfile(DEFAULT_PROFILE), null);
  assert.equal(validateProfile({ name: '小果', avatar: { type: 'initial' } }), null);
  assert.equal(validateProfile({ name: '小果', avatar: { type: 'image', value: IMAGE } }), null);

  assert.ok(validateProfile([]));
  assert.ok(validateProfile({ name: 3 }));
  assert.ok(validateProfile({ name: 'x'.repeat(PROFILE_NAME_MAX + 1) }));
  assert.ok(validateProfile({ avatar: { type: 'preset', value: 'unknown' } }));
  assert.ok(validateProfile({ avatar: { type: 'image', value: 'https://x.test/a.png' } }));
  assert.ok(validateProfile({ avatar: { type: 'image', value: `data:image/webp;base64,${'a'.repeat(320001)}` } }));
});

test('avatar image helper only accepts image data URLs', () => {
  assert.equal(isAllowedAvatarImage(IMAGE), true);
  assert.equal(isAllowedAvatarImage('data:image/jpeg;base64,AAAA'), true);
  assert.equal(isAllowedAvatarImage('data:image/png;base64,AAAA'), true);
  assert.equal(isAllowedAvatarImage('https://x.test/a.png'), false);
  assert.equal(isAllowedAvatarImage(''), false);
});

test('display name and greeting fall back sensibly', () => {
  assert.equal(profileDisplayName({ name: '' }), '小果');
  assert.equal(profileDisplayName({ name: '阿果' }), '阿果');

  assert.equal(greetingForHour(3), '夜深了');
  assert.equal(greetingForHour(8), '早上好');
  assert.equal(greetingForHour(12), '中午好');
  assert.equal(greetingForHour(16), '下午好');
  assert.equal(greetingForHour(21), '晚上好');
});

test('avatar preset ids are unique and default avatar is the monogram', () => {
  assert.equal(new Set(PROFILE_AVATAR_IDS).size, PROFILE_AVATAR_IDS.length);
  assert.equal(DEFAULT_PROFILE.avatar.type, 'initial');
});

test('initial avatars validate and normalize', () => {
  assert.equal(validateProfile({ name: '小果', avatar: { type: 'initial', value: '' } }), null);
  const profile = normalizeProfile({ name: '小果', avatar: { type: 'initial', value: 'x' } });
  assert.deepEqual(profile.avatar, { type: 'initial', value: '' });
});
