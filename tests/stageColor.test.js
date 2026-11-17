import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGE_COLORS, isStageColor, stageColor } from '../src/utils/format.js';

test('isStageColor accepts palette values', () => {
  for (const option of STAGE_COLORS) {
    assert.equal(isStageColor(option.value), true);
  }
});

test('isStageColor accepts any #rrggbb for自由选色', () => {
  assert.equal(isStageColor('#000000'), true);
  assert.equal(isStageColor('#ffffff'), true);
  assert.equal(isStageColor('#1A2B3C'), true);
  assert.equal(isStageColor('#abcdef'), true);
});

test('isStageColor rejects anything that is not a hex color', () => {
  // 备份是用户可编辑的文本文件，颜色最终会进 CSS 变量，必须挡掉任意字符串。
  assert.equal(isStageColor('red'), false);
  assert.equal(isStageColor('#fff'), false);
  assert.equal(isStageColor('#12345'), false);
  assert.equal(isStageColor('#1234567'), false);
  assert.equal(isStageColor('rgb(1,2,3)'), false);
  assert.equal(isStageColor('url(javascript:alert(1))'), false);
  assert.equal(isStageColor('#12345g'), false);
  assert.equal(isStageColor(''), false);
  assert.equal(isStageColor(null), false);
  assert.equal(isStageColor(undefined), false);
});

test('stageColor prefers a valid custom color', () => {
  const preset = STAGE_COLORS[2].value;
  assert.equal(stageColor({ name: '随便', color: preset }), preset);
  // 自由选色也应该生效
  assert.equal(stageColor({ name: '随便', color: '#1a2b3c' }), '#1a2b3c');
});

test('stageColor ignores invalid custom colors and falls back to name hash', () => {
  const invalid = stageColor({ name: '十月日常', color: 'javascript:alert(1)' });
  assert.notEqual(invalid, 'javascript:alert(1)');
  assert.match(invalid, /^#[0-9a-f]{6}$/i);
});

test('stageColor is stable for the same name', () => {
  assert.equal(stageColor({ name: '国庆旅行' }), stageColor({ name: '国庆旅行' }));
  assert.equal(stageColor('国庆旅行'), stageColor({ name: '国庆旅行' }));
});
