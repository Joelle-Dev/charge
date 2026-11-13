export const ACHIEVEMENTS = [
  {
    id: 'first-paw',
    name: '第一枚爪印',
    description: '记下第一笔小账',
    icon: 'paw',
    target: 1,
    value: (stats) => stats.totalCount
  },
  {
    id: 'ten-records',
    name: '十笔小账',
    description: '一共记了 10 笔小账',
    icon: 'paw',
    target: 10,
    value: (stats) => stats.totalCount
  },
  {
    id: 'fifty-records',
    name: '五十笔小账',
    description: '一共记了 50 笔小账',
    icon: 'paw',
    target: 50,
    value: (stats) => stats.totalCount
  },
  {
    id: 'hundred-records',
    name: '百笔小账',
    description: '一共记了 100 笔小账',
    icon: 'crown',
    target: 100,
    value: (stats) => stats.totalCount
  },
  {
    id: 'streak-3',
    name: '连续三天',
    description: '连续 3 天都来记账',
    icon: 'paw',
    target: 3,
    value: (stats) => stats.streak
  },
  {
    id: 'streak-7',
    name: '一周猫爪',
    description: '连续 7 天都来记账',
    icon: 'paw',
    target: 7,
    value: (stats) => stats.streak
  },
  {
    id: 'streak-30',
    name: '月度守护',
    description: '连续 30 天都来记账',
    icon: 'crown',
    target: 30,
    value: (stats) => stats.streak
  },
  {
    id: 'no-spend-7',
    name: '空碗勋章',
    description: '一共 7 天没花钱',
    icon: 'bowl',
    target: 7,
    value: (stats) => stats.noSpendDays
  },
  {
    id: 'budget-keeper',
    name: '猫粮守护者',
    description: '有猫粮罐的账本都没花超',
    icon: 'bowl',
    target: 1,
    value: (stats) => stats.budgetKeptStages
  },
  {
    id: 'stage-master',
    name: '账本收藏家',
    description: '建过 3 个账本',
    icon: 'star',
    target: 3,
    value: (stats) => stats.stageCount
  }
];

// 人生里程碑：跟着岁月慢慢长出来的纪念章
export const MILESTONES = [
  {
    id: 'thousand-records',
    group: 'milestone',
    name: '千笔纪念',
    description: '一共记了 1000 笔，日子都收好啦',
    icon: 'crown',
    target: 1000,
    value: (stats) => stats.totalCount,
    celebration: '第 1000 笔！果冻把这些年都替你收好啦'
  },
  {
    id: 'ten-thousand-records',
    group: 'milestone',
    name: '万笔长卷',
    description: '一万笔小账，日子都在里面了',
    icon: 'crown',
    target: 10000,
    value: (stats) => stats.totalCount,
    celebration: '一万笔了！这本账就是一部生活史'
  },
  {
    id: 'anniversary-1',
    group: 'milestone',
    name: '一周年',
    description: '小账本陪你走过第一年',
    icon: 'cake',
    target: 1,
    value: (stats) => stats.yearsActive,
    celebration: '记账一周年啦，果冻陪你走过第一年'
  },
  {
    id: 'anniversary-3',
    group: 'milestone',
    name: '三周年',
    description: '三年了，果冻还在陪你记',
    icon: 'cake',
    target: 3,
    value: (stats) => stats.yearsActive,
    celebration: '三周年，果冻还在陪你记'
  },
  {
    id: 'anniversary-10',
    group: 'milestone',
    name: '十周年',
    description: '十年老账本，值得一座金爪印',
    icon: 'cake',
    target: 10,
    value: (stats) => stats.yearsActive,
    celebration: '十年老账本，果冻给你盖一枚金爪印'
  },
  {
    id: 'streak-100',
    group: 'milestone',
    name: '百日不断',
    description: '连续 100 天都来记账',
    icon: 'star',
    target: 100,
    value: (stats) => stats.streak,
    celebration: '连续 100 天，好习惯养成了'
  },
  {
    id: 'streak-365',
    group: 'milestone',
    name: '一年不断',
    description: '连续 365 天从没断过',
    icon: 'star',
    target: 365,
    value: (stats) => stats.streak,
    celebration: '连续 365 天从没断过，太厉害了'
  }
];

const ALL_BADGES = [...ACHIEVEMENTS, ...MILESTONES];

export function getAchievementState(stats) {
  return ALL_BADGES.map((achievement) => {
    const raw = Number(achievement.value(stats)) || 0;
    const value = Math.min(raw, achievement.target);
    return {
      ...achievement,
      value,
      progress: Math.min(1, value / achievement.target),
      unlocked: value >= achievement.target
    };
  });
}
