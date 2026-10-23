export const PRESET_CATEGORIES = ['餐饮', '交通', '住宿', '购物', '娱乐', '门票', '其他'];
export const DEFAULT_CATEGORY = '其他';

const RULES = [
  {
    name: '餐饮',
    keywords: [
      '早餐', '早饭', '午餐', '午饭', '晚餐', '晚饭', '夜宵', '宵夜', '吃饭', '外卖',
      '奶茶', '咖啡', '火锅', '烧烤', '饮料', '可乐', '矿泉水', '星巴克', '麦当劳',
      '肯德基', '食堂', '买菜', '菜市场', '零食', '水果', '蛋糕', '面包', '饺子',
      '包子', '面条', '米粉', '烧烤', '聚餐', '请客', '餐', '饭', '粉', '面'
    ]
  },
  {
    name: '交通',
    keywords: [
      '打车', '滴滴', '出租车', '的士', '网约车', '地铁', '公交', '巴士', '高铁',
      '火车', '动车', '机票', '飞机', '机场', '停车', '加油', '油费', '过路费',
      '高速', '共享单车', '单车', '电瓶车', '船票', '轮渡', '车费'
    ]
  },
  {
    name: '住宿',
    keywords: ['酒店', '民宿', '住宿', '房费', '旅馆', '宾馆', '客栈', '青旅', 'airbnb']
  },
  {
    name: '门票',
    keywords: [
      '门票', '景区', '景点', '博物馆', '展览', '乐园', '迪士尼', '环球影城', '公园',
      '索道', '观光', '演出票', '预约'
    ]
  },
  {
    name: '购物',
    keywords: [
      '购物', '超市', '商场', '衣服', '裤子', '鞋子', '包包', '化妆品', '护肤',
      '日用品', '淘宝', '京东', '拼多多', '纪念品', '特产', '礼物', '数码', '耳机',
      '手机', '家电', '药店', '药'
    ]
  },
  {
    name: '娱乐',
    keywords: [
      '电影', '唱歌', 'ktv', '游戏', '演出', '演唱会', '酒吧', '娱乐', '按摩',
      'spa', '桌游', '剧本杀', '密室', '健身', '游泳', '滑雪', '租车'
    ]
  }
];

const CN_DIGITS = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9
};
const CN_UNITS = { 十: 10, 百: 100, 千: 1000, 万: 10000, 亿: 100000000 };

const MEASURE_AFTER = /^[年月日号点时秒分公里人个份杯瓶包张件次天晚位只斤克岁折成]/;
const DATE_DAY = /^[日号]/;

export function chineseToNumber(input) {
  const raw = String(input || '').replace(/〇/g, '零');
  if (!raw) return NaN;

  const [intPart, decPart] = raw.split('点');
  let total = 0;
  let section = 0;
  let number = 0;
  let lastUnit = 0;
  let zeroSeen = false;
  let hasUnit = false;

  for (const ch of intPart) {
    if (ch in CN_DIGITS) {
      const d = CN_DIGITS[ch];
      if (d === 0) zeroSeen = true;
      number = d;
    } else if (ch in CN_UNITS) {
      hasUnit = true;
      const unit = CN_UNITS[ch];
      if (unit === 100000000) {
        total = (total + section + number) * unit;
        section = 0;
      } else if (unit === 10000) {
        section = (section + number) * unit;
        total += section;
        section = 0;
      } else {
        if (number === 0) number = 1;
        section += number * unit;
      }
      lastUnit = unit;
      number = 0;
      zeroSeen = false;
    }
  }

  if (!hasUnit) {
    let whole = Number(intPart.split('').map((c) => CN_DIGITS[c]).join(''));
    if (decPart) {
      const decimals = decPart.split('').map((c) => CN_DIGITS[c]).join('');
      if (decimals) whole += Number(`0.${decimals}`);
    }
    return whole;
  }

  if (number > 0) {
    if (lastUnit >= 100 && !zeroSeen) {
      total += section + number * (lastUnit / 10);
    } else {
      total += section + number;
    }
  } else {
    total += section;
  }

  if (decPart) {
    const decimals = decPart.split('').map((c) => CN_DIGITS[c]).join('');
    if (decimals) total += Number(`0.${decimals}`);
  }

  return Number(total.toFixed(4));
}

function normalize(text) {
  return String(text || '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/．/g, '.')
    .replace(/，/g, '，')
    .replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function numberFrom(token) {
  if (/^\d/.test(token)) return Number(token);
  return chineseToNumber(token);
}

function validAmount(value) {
  return Number.isFinite(value) && value > 0 && value < 100000000;
}

export function extractAmount(text) {
  const source = normalize(text);

  const patterns = [
    {
      re: /(\d+(?:\.\d+)?)\s*(?:元|块钱|块|圆)\s*([0-9一二三四五六七八九])\s*(?:毛|角)?/,
      calc: (m) => Number(m[1]) + Number(numberFrom(m[2])) / 10
    },
    {
      re: /([零〇一二两三四五六七八九十百千万亿点]+)\s*(?:元|块钱|块|圆)\s*([0-9一二三四五六七八九])\s*(?:毛|角)?/,
      calc: (m) => chineseToNumber(m[1]) + Number(numberFrom(m[2])) / 10
    },
    {
      re: /(\d+(?:\.\d+)?)\s*(?:元|块钱|块|圆)/,
      calc: (m) => Number(m[1])
    },
    {
      re: /([零〇一二两三四五六七八九十百千万亿点]+)\s*(?:元|块钱|块|圆)/,
      calc: (m) => chineseToNumber(m[1])
    },
    {
      re: /([零〇一二两三四五六七八九十百千万亿点]+)\s*(?:毛|角)钱?/,
      calc: (m) => chineseToNumber(m[1]) / 10
    },
    {
      re: /(\d+(?:\.\d+)?)\s*(?:毛|角)钱?/,
      calc: (m) => Number(m[1]) / 10
    },
    {
      re: /(?:花了|花掉|花费|用了|付了|支付了?|消费了?|一共|总共|合计|共计|共)\s*(\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万亿点]+)/,
      calc: (m) => numberFrom(m[1])
    }
  ];

  for (const { re, calc } of patterns) {
    const match = re.exec(source);
    if (!match) continue;
    const value = Math.round(calc(match) * 100) / 100;
    if (!validAmount(value)) continue;
    return {
      amount: value,
      raw: match[0],
      index: match.index,
      end: match.index + match[0].length
    };
  }

  const bare = /\d+(?:\.\d+)?/g;
  let m;
  while ((m = bare.exec(source))) {
    const after = source.slice(m.index + m[0].length);
    if (MEASURE_AFTER.test(after)) continue;
    const before = source.slice(0, m.index);
    if (/[第]$/.test(before)) continue;
    const value = Number(m[0]);
    if (!validAmount(value)) continue;
    return {
      amount: Math.round(value * 100) / 100,
      raw: m[0],
      index: m.index,
      end: m.index + m[0].length
    };
  }

  const cnTail = /([零〇一二两三四五六七八九十百千万亿点]+)\s*[。.!！]?$/.exec(source);
  if (cnTail) {
    const value = chineseToNumber(cnTail[1]);
    if (validAmount(value)) {
      return {
        amount: Math.round(value * 100) / 100,
        raw: cnTail[0].trim(),
        index: cnTail.index,
        end: cnTail.index + cnTail[0].length
      };
    }
  }

  return null;
}

export function detectCategory(text, categories = PRESET_CATEGORIES) {
  const hay = String(text || '').toLowerCase();
  let best = null;

  for (const rule of RULES) {
    if (!categories.includes(rule.name)) continue;
    for (const kw of rule.keywords) {
      if (!hay.includes(kw.toLowerCase())) continue;
      if (!best || kw.length > best.length) {
        best = { category: rule.name, length: kw.length };
      }
    }
  }

  for (const category of categories) {
    if (category === DEFAULT_CATEGORY) continue;
    const name = category.toLowerCase();
    if (hay.includes(name) && (!best || name.length > best.length)) {
      best = { category, length: name.length };
    }
  }

  return best ? best.category : DEFAULT_CATEGORY;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseSpentAt(text, now = new Date()) {
  const source = normalize(text);
  const base = new Date(now);
  const consumed = [];
  let relative = null;

  const relativeMatch = /(大前天|前天|昨天|今天|今日)/.exec(source);
  if (relativeMatch) {
    relative = { 大前天: -3, 前天: -2, 昨天: -1, 今天: 0, 今日: 0 }[relativeMatch[1]];
    consumed.push(relativeMatch[0]);
  }

  const date = new Date(base);
  if (relative !== null) {
    date.setDate(date.getDate() + relative);
  }

  const monthDay = /(?<!\d)(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/.exec(source);
  const slashDate = /(?<!\d)(\d{1,2})[/-](\d{1,2})(?!\d)/.exec(source);
  const md = monthDay || slashDate;

  if (md) {
    const month = Number(md[1]);
    const day = Number(md[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let candidate = new Date(base);
      candidate.setFullYear(base.getFullYear(), month - 1, day);
      candidate.setHours(base.getHours(), base.getMinutes(), 0, 0);
      if (candidate.getTime() - base.getTime() > 30 * 86400000) {
        candidate.setFullYear(candidate.getFullYear() - 1);
      }
      date.setFullYear(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
      consumed.push(md[0]);
    }
  }

  const periodMatch = /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上)/.exec(source);
  const periods = {
    凌晨: 5, 早上: 8, 早晨: 8, 上午: 10, 中午: 12,
    下午: 15, 傍晚: 18, 晚上: 20
  };
  if (periodMatch) {
    date.setHours(periods[periodMatch[1]], 0, 0, 0);
    consumed.push(periodMatch[0]);
  }

  const timeMatch = /(?<!\d)(\d{1,2})\s*点\s*(?:(\d{1,2})\s*分?)?/.exec(source);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || 0);
    if (periodMatch && /下午|傍晚|晚上/.test(periodMatch[1]) && hour < 12) hour += 12;
    if (periodMatch && periodMatch[1] === '中午' && hour < 11) hour += 12;
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      date.setHours(hour, minute, 0, 0);
      consumed.push(timeMatch[0]);
    }
  }

  if (relative !== null && date.getTime() < startOfDay(base).getTime() + (relative + 1) * 86400000) {
    // keep the clock time for relative days unless a period/time was spoken
    if (!periodMatch && !timeMatch) {
      const keep = new Date(base);
      date.setHours(keep.getHours(), keep.getMinutes(), 0, 0);
    }
  }

  date.setSeconds(0, 0);
  return { date, consumed };
}

const LEADING_FILLER = /^(?:我|已经|刚刚|刚|一共|总共|共计|合计|大约|大概|差不多|约|花了|花|用了|用|付了|付|支付了|支付|消费了|消费|买了|买|吃了|喝了|去了|住了|又|就|还|一共)+/;
const TRAILING_FILLER = /(?:吃了|喝了|买了|用了|花了|付了|消费了|左右|大概|差不多)$/;

export function cleanNote(text, removeParts = []) {
  let note = normalize(text);
  for (const part of removeParts.filter(Boolean).sort((a, b) => b.length - a.length)) {
    note = note.split(part).join(' ');
  }
  note = note
    .replace(/[，,。.!！？?；;、:：\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let previous = '';
  while (previous !== note) {
    previous = note;
    note = note.replace(LEADING_FILLER, '').replace(TRAILING_FILLER, '').trim();
  }
  note = note.replace(/[了]$/, '').replace(/[，,。.!！？?；;、:：\s]+$/g, '').trim();
  return note;
}

function splitSegments(text) {
  return normalize(text)
    .replace(/[；;。！!？?、\n\r]+/g, '，')
    .replace(/(然后|还有|另外|接着|以及|再有|再记|外加)/g, '，')
    .split(/[，,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseExpenses(text, options = {}) {
  const now = options.now || new Date();
  const categories = options.categories || PRESET_CATEGORIES;
  const segments = splitSegments(text);
  const entries = [];

  for (const segment of segments) {
    const amount = extractAmount(segment);
    if (!amount) continue;
    const { date, consumed } = parseSpentAt(segment, now);
    const category = detectCategory(segment, categories);
    const note = cleanNote(segment, [amount.raw, ...consumed]);
    entries.push({
      amount: amount.amount,
      category,
      note,
      spentAt: date.toISOString(),
      raw: segment
    });
  }

  return entries;
}
