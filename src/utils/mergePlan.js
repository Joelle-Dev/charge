export function mergeStageTotals(stages = [], getStats = () => null) {
  const selected = (Array.isArray(stages) ? stages : []).filter(Boolean);
  let count = 0;
  let total = 0;
  let budget = 0;
  let budgetedStages = 0;
  let minDate = '';
  let maxDate = '';
  // 分类名是用户输入，用无原型对象避免 __proto__ 之类的键污染
  const categories = Object.create(null);

  for (const stage of selected) {
    const stats = getStats(stage.id) || {};
    count += Number(stats.count) || 0;
    total += Number(stats.total) || 0;

    const stageBudget = Number(stage.budget) || 0;
    if (stageBudget > 0) {
      budget += stageBudget;
      budgetedStages += 1;
    }

    for (const [category, value] of Object.entries(stats.categories || {})) {
      const current = Object.hasOwn(categories, category)
        ? categories[category]
        : { count: 0, amount: 0 };
      current.count += Number(value.count) || 0;
      current.amount += Number(value.amount) || 0;
      categories[category] = current;
    }

    if (stats.minDate && (!minDate || stats.minDate < minDate)) minDate = stats.minDate;
    if (stats.maxDate && (!maxDate || stats.maxDate > maxDate)) maxDate = stats.maxDate;
  }

  return {
    count,
    total,
    budget,
    budgetedStages,
    stageCount: selected.length,
    categories,
    minDate,
    maxDate
  };
}

export function buildMergePlan({ stages = [], selectedIds = [], targetId = '', getStats = () => null } = {}) {
  const selectedSet = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const selectedStages = (Array.isArray(stages) ? stages : []).filter(
    (stage) => stage && selectedSet.has(stage.id)
  );

  if (selectedStages.length < 2) {
    return { ok: false, error: '至少选两个账本才能合并' };
  }

  const target = selectedStages.find((stage) => stage.id === targetId);
  if (!target) {
    return { ok: false, error: '合并目标必须是选中的账本' };
  }
  if (target.archived) {
    return { ok: false, error: '合并目标不能是已归档账本' };
  }

  const sources = selectedStages.filter((stage) => stage.id !== targetId);
  if (!sources.length) {
    return { ok: false, error: '至少需要一个被合并的账本' };
  }
  if (sources.some((stage) => stage.archived)) {
    return { ok: false, error: '归档账本不能参与合并' };
  }

  return {
    ok: true,
    target,
    sources,
    selectedStages,
    totals: mergeStageTotals(selectedStages, getStats)
  };
}
