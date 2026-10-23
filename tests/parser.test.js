import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chineseToNumber,
  detectCategory,
  extractAmount,
  parseExpenses,
  parseSpentAt
} from '../src/lib/parser.js';

const NOW = new Date('2026-10-23T12:30:00+08:00');

test('chineseToNumber handles common money forms', () => {
  assert.equal(chineseToNumber('三十五'), 35);
  assert.equal(chineseToNumber('二百三十九'), 239);
  assert.equal(chineseToNumber('两百五'), 250);
  assert.equal(chineseToNumber('一百零五'), 105);
  assert.equal(chineseToNumber('一万二'), 12000);
  assert.equal(chineseToNumber('十五'), 15);
  assert.equal(chineseToNumber('五点五'), 5.5);
});

test('extractAmount finds arabic and chinese amounts', () => {
  assert.equal(extractAmount('午饭吃了35').amount, 35);
  assert.equal(extractAmount('打车25块5').amount, 25.5);
  assert.equal(extractAmount('门票120元').amount, 120);
  assert.equal(extractAmount('花了二百三十九').amount, 239);
  assert.equal(extractAmount('饮料五块五').amount, 5.5);
  assert.equal(extractAmount('五毛钱').amount, 0.5);
  assert.equal(extractAmount('三毛').amount, 0.3);
  assert.equal(extractAmount('咖啡十五').amount, 15);
  assert.equal(extractAmount('买衣服'), null);
});

test('amount ignores dates, times and measures', () => {
  assert.equal(extractAmount('10月1日门票120').amount, 120);
  assert.equal(extractAmount('下午3点咖啡20').amount, 20);
  assert.equal(extractAmount('买了2杯奶茶30').amount, 30);
  assert.equal(extractAmount('住3晚酒店1200').amount, 1200);
});

test('detectCategory matches keywords and falls back', () => {
  assert.equal(detectCategory('午饭35'), '餐饮');
  assert.equal(detectCategory('滴滴打车25'), '交通');
  assert.equal(detectCategory('住民宿'), '住宿');
  assert.equal(detectCategory('迪士尼门票'), '门票');
  assert.equal(detectCategory('买衣服'), '购物');
  assert.equal(detectCategory('电影票'), '娱乐');
  assert.equal(detectCategory('随便花了一点'), '其他');
  assert.equal(detectCategory('宠物粮', ['餐饮', '宠物', '其他']), '宠物');
});

test('parseSpentAt handles relative days and explicit dates', () => {
  const yesterday = parseSpentAt('昨天午饭35', NOW);
  assert.equal(yesterday.date.getDate(), 22);

  const explicit = parseSpentAt('10月1日门票120', NOW);
  assert.equal(explicit.date.getMonth(), 9);
  assert.equal(explicit.date.getDate(), 1);

  const evening = parseSpentAt('昨天晚上8点吃饭', NOW);
  assert.equal(evening.date.getHours(), 20);
});

test('parseExpenses splits multiple entries and builds notes', () => {
  const entries = parseExpenses('昨天午饭吃了35，打车25块5，还有门票120', { now: NOW });
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((e) => [e.amount, e.category, e.note]),
    [
      [35, '餐饮', '午饭'],
      [25.5, '交通', '打车'],
      [120, '门票', '门票']
    ]
  );
  assert.equal(new Date(entries[0].spentAt).getDate(), 22);
});

test('parseExpenses returns empty when no amount is heard', () => {
  assert.deepEqual(parseExpenses('今天天气不错'), []);
  assert.deepEqual(parseExpenses(''), []);
});

test('parseExpenses respects custom categories', () => {
  const entries = parseExpenses('宠物洗澡180', {
    now: NOW,
    categories: ['餐饮', '宠物', '其他']
  });
  assert.equal(entries[0].category, '宠物');
  assert.equal(entries[0].note, '宠物洗澡');
});
