const TITLES = {
  餐饮: '干饭猫',
  交通: '出行猫',
  住宿: '旅居猫',
  购物: '剁手猫',
  娱乐: '快乐猫',
  门票: '旅行猫',
  其他: '神秘猫'
};

export function catTitleForCategory(category) {
  if (!category) return '小财迷';
  return TITLES[category] || `${category}猫`;
}
