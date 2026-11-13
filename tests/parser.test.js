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

  const half = parseSpentAt('晚上8点半吃饭', NOW);
  assert.equal(half.date.getHours(), 20);
  assert.equal(half.date.getMinutes(), 30);
});

test('parseSpentAt honors explicit years and rejects impossible dates', () => {
  const explicit = parseSpentAt('2024年3月5日 买了书 88', NOW);
  assert.equal(explicit.date.getFullYear(), 2024);
  assert.equal(explicit.date.getMonth(), 2);
  assert.equal(explicit.date.getDate(), 5);
  assert.ok(explicit.consumed.join('').includes('2024年3月5日'));

  const impossible = parseSpentAt('2月30日 买了书 88', NOW);
  assert.equal(impossible.consumed.length, 0);

  const rolled = parseExpenses('2024年3月5日 打车 88', { now: NOW });
  assert.equal(rolled.length, 1);
  assert.equal(rolled[0].note, '打车');
  assert.equal(new Date(rolled[0].spentAt).getFullYear(), 2024);
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

test('parseExpenses splits multiple amounts even without punctuation', () => {
  const entries = parseExpenses('午饭30 打车25 门票120', { now: NOW });
  assert.deepEqual(
    entries.map((e) => [e.amount, e.category]),
    [[30, '餐饮'], [25, '交通'], [120, '门票']]
  );

  const joined = parseExpenses('午饭30打车25', { now: NOW });
  assert.deepEqual(joined.map((e) => e.amount), [30, 25]);

  const shopping = parseExpenses('买了30元水果和25元奶茶', { now: NOW });
  assert.deepEqual(shopping.map((e) => [e.amount, e.category]), [[30, '购物'], [25, '餐饮']]);

  const days = parseExpenses('昨天吃饭花了35 前天门票花了37', { now: NOW });
  assert.deepEqual(
    days.map((e) => [e.amount, e.category, e.note]),
    [[35, '餐饮', '吃饭'], [37, '门票', '门票']]
  );
});

test('parseExpenses splits chinese amounts without units', () => {
  const entries = parseExpenses('午饭三十五打车二十五', { now: NOW });
  assert.deepEqual(
    entries.map((e) => [e.amount, e.category, e.note]),
    [[35, '餐饮', '午饭'], [25, '交通', '打车']]
  );

  const mixed = parseExpenses('午饭三十五打车二十五块', { now: NOW });
  assert.deepEqual(mixed.map((e) => e.amount), [35, 25]);

  const clock = parseExpenses('下午三点买书二十', { now: NOW });
  assert.equal(clock.length, 1);
  assert.equal(clock[0].amount, 20);
});

test('extractAmount prefers the leftmost amount', () => {
  assert.equal(extractAmount('午饭三十五打车二十五块').amount, 35);
  assert.equal(extractAmount('三块半').amount, 3.5);
});

test('extractAmount combines jiao decimals after filler verbs', () => {
  assert.equal(extractAmount('花了38块5').amount, 38.5);
  assert.equal(extractAmount('午饭花了25块8').amount, 25.8);
  assert.equal(extractAmount('花了3块半').amount, 3.5);
  assert.equal(extractAmount('一共38块5').amount, 38.5);
  assert.equal(extractAmount('付了12块5毛').amount, 12.5);
});

test('parseExpenses does not split kuai-jiao amounts into phantom entries', () => {
  const entries = parseExpenses('早饭花了38块5', { now: NOW });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 38.5);
  assert.equal(entries[0].category, '餐饮');
  assert.equal(entries[0].note, '早饭');
});

test('parseExpenses handles HH:MM clock times', () => {
  const entries = parseExpenses('昨天 15:30 打车 30元', { now: NOW });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 30);
  assert.equal(entries[0].category, '交通');
  assert.equal(entries[0].note, '打车');
  const when = new Date(entries[0].spentAt);
  assert.equal(when.getDate(), 22);
  assert.equal(when.getHours(), 15);
  assert.equal(when.getMinutes(), 30);
});

test('parseExpenses keeps clock minutes out of amounts', () => {
  const entries = parseExpenses('下午3点30打车25', { now: NOW });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 25);
  assert.equal(new Date(entries[0].spentAt).getHours(), 15);
});

test('multi-amount splitting ignores quantities and dates', () => {
  assert.equal(parseExpenses('买了2杯奶茶30', { now: NOW }).length, 1);
  assert.equal(parseExpenses('上午10点花了35', { now: NOW }).length, 1);
  assert.equal(parseExpenses('10月1日门票120', { now: NOW }).length, 1);
  assert.equal(parseExpenses('住3晚酒店1200', { now: NOW }).length, 1);
});

test('parseExpenses respects custom categories', () => {
  const entries = parseExpenses('宠物洗澡180', {
    now: NOW,
    categories: ['餐饮', '宠物', '其他']
  });
  assert.equal(entries[0].category, '宠物');
  assert.equal(entries[0].note, '宠物洗澡');
});
