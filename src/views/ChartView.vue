<template>
  <section class="chart-page">
    <LoadingState v-if="!ready || loading" text="果冻在算这段时间的钱…" />

    <div v-else-if="!currentStage" class="list-empty">
      <p>果冻还没有账本</p>
      <span>先建个账本，钱钱才有地方住</span>
      <button class="secondary-btn" type="button" @click="openStageForm">建个账本</button>
    </div>

    <template v-else>
      <div class="chart-toolbar">
        <div class="history-trend-switch" role="tablist" aria-label="支出周期">
          <button
            v-for="option in PERIOD_OPTIONS"
            :key="option.value"
            :class="{ active: period === option.value }"
            type="button"
            role="tab"
            :aria-selected="period === option.value"
            @click="setPeriod(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div ref="railRef" class="history-trend-rail" role="listbox" aria-label="选择支出周期">
        <button
          v-for="option in periodOptions"
          :key="option.key"
          class="history-trend-chip"
          :class="{ active: option.key === selectedKey }"
          type="button"
          role="option"
          :aria-selected="option.key === selectedKey"
          @click="selectPeriod(option)"
        >
          <span class="history-trend-chip-label">{{ option.shortLabel }}</span>
          <span class="history-trend-chip-amount">{{ option.total ? `¥${displayMoney(option.total)}` : '—' }}</span>
        </button>
      </div>

      <section class="chart-card" aria-label="支出折线图">
        <div class="chart-card-head">
          <strong>合计 ¥{{ displayMoney(series.total) }}</strong>
        </div>
        <SpendLineChart
          :points="series.points"
          :period="period"
          :label="series.label"
          :height="176"
        />
      </section>

      <section class="history-categories chart-ranking" aria-label="支出排行榜">
        <div class="history-categories-head">
          <h3>支出排行榜</h3>
          <span>{{ series.label }} · {{ categoryData.items.length }} 类</span>
        </div>

        <div v-if="categoryLoading && !categoryData.items.length" class="history-category-empty">
          果冻在排支出榜单…
        </div>
        <div v-else-if="categoryError" class="history-category-empty">
          排行榜没算成
          <button class="text-btn" type="button" @click="retryCategories">再试一次</button>
        </div>
        <div v-else-if="!categoryData.items.length" class="history-category-empty">
          果冻这段时间还没花钱，排行榜空空的
        </div>
        <template v-else>
          <div class="history-category-list">
            <div
              v-for="(item, index) in categoryData.items"
              :key="item.category"
              class="history-category"
            >
              <div class="history-category-line">
                <span class="chart-rank" :class="{ 'is-top': index < 3 }">{{ index + 1 }}</span>
                <CategoryIcon class="history-category-icon" :name="iconFor(item.category)" />
                <span class="history-category-name">{{ item.category }}</span>
                <span class="history-category-amount">¥{{ displayMoney(item.amount) }}</span>
                <span class="history-category-percent">{{ percentLabel(item.percent) }}%</span>
              </div>
              <div class="history-category-track">
                <div
                  class="history-category-fill"
                  :style="{
                    width: `${item.percent}%`,
                    background: categoryColor(item.category)
                  }"
                ></div>
              </div>
            </div>
          </div>
        </template>
      </section>
    </template>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import LoadingState from '../components/LoadingState.vue';
import SpendLineChart from '../components/SpendLineChart.vue';
import CategoryIcon from '../components/CategoryIcon.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { loadDayStats } from '../lib/stats';
import { buildTrendPeriodOptions, buildTrendSeries, periodRange, TREND_PERIODS } from '../utils/trend';
import { displayMoney } from '../utils/money';
import { categoryColor, toDateInput } from '../utils/format';
import { haptic } from '../utils/haptics';

const PERIOD_OPTIONS = [
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' }
];

const { ready, currentStage, dataVersion, loadCategoryTotals, iconFor } = useLedger();
const sheets = useSheets();
const today = toDateInput(new Date());

const period = ref('month');
const anchor = ref(periodRange('month', today).from);
const allDays = ref([]);
const loading = ref(true);
const railRef = ref(null);
const categoryData = ref({ total: 0, items: [] });
const categoryLoading = ref(false);
const categoryError = ref(false);

let loadToken = 0;
let categoryToken = 0;
let loadedCategoryKey = '';
let railReady = false;

const series = computed(() => buildTrendSeries({
  days: allDays.value,
  period: period.value,
  anchor: anchor.value,
  today
}));

const periodOptions = computed(() => buildTrendPeriodOptions({
  days: allDays.value,
  period: period.value,
  today
}));

const selectedKey = computed(() => series.value.range.from);

const categoryKey = computed(() => [
  currentStage.value?.id || '',
  series.value.range.from,
  series.value.range.to,
  dataVersion.value
].join('|'));

function percentLabel(value) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 10) return String(Math.round(value));
  return value.toFixed(1);
}

async function loadDays() {
  if (!ready.value) {
    loading.value = true;
    return;
  }
  const stage = currentStage.value;
  if (!stage) {
    allDays.value = [];
    loading.value = false;
    return;
  }

  const token = ++loadToken;
  loading.value = true;
  try {
    const state = await loadDayStats({ stageId: stage.id });
    if (token !== loadToken) return;
    allDays.value = [...state.days.entries()]
      .map(([key, bucket]) => ({ ...bucket, key }))
      .sort((a, b) => a.key.localeCompare(b.key));
  } catch (err) {
    if (token === loadToken) {
      console.error('加载看账数据失败', err);
      allDays.value = [];
    }
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

function setPeriod(next) {
  if (!TREND_PERIODS.includes(next) || period.value === next) return;
  period.value = next;
  anchor.value = periodRange(next, today).from;
  haptic('light');
}

function selectPeriod(option) {
  if (!option || anchor.value === option.key) return;
  anchor.value = option.key;
  haptic('light');
}

function scrollRailToEnd() {
  const rail = railRef.value;
  if (rail) rail.scrollLeft = rail.scrollWidth;
}

function centerRail() {
  const rail = railRef.value;
  if (!rail) return;
  const active = rail.querySelector('.active');
  if (!active) return;
  if (active === rail.lastElementChild) {
    rail.scrollLeft = rail.scrollWidth;
    return;
  }
  const left = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
  rail.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
}

function alignRail() {
  const rail = railRef.value;
  if (!rail) return;
  if (!railReady) {
    scrollRailToEnd();
    railReady = true;
    return;
  }
  centerRail();
}

async function loadCategories() {
  const key = categoryKey.value;
  if (loadedCategoryKey === key) return;

  const stageId = currentStage.value?.id;
  const range = series.value.range;
  if (!stageId) {
    categoryData.value = { total: 0, items: [] };
    categoryLoading.value = false;
    categoryError.value = false;
    loadedCategoryKey = '';
    return;
  }

  const token = ++categoryToken;
  categoryLoading.value = true;
  categoryError.value = false;
  try {
    const data = await loadCategoryTotals({
      stageId,
      from: range.from,
      to: range.to
    });
    if (token !== categoryToken) return;
    categoryData.value = data;
    loadedCategoryKey = key;
  } catch (err) {
    if (token === categoryToken) {
      console.error('加载支出排行榜失败', err);
      categoryData.value = { total: 0, items: [] };
      categoryError.value = true;
      loadedCategoryKey = '';
    }
  } finally {
    if (token === categoryToken) categoryLoading.value = false;
  }
}

function retryCategories() {
  loadedCategoryKey = '';
  categoryError.value = false;
  loadCategories();
}

function openStageForm() {
  sheets.openStageForm();
}

watch(
  [ready, () => currentStage.value?.id, dataVersion],
  loadDays,
  { immediate: true }
);

watch(
  () => currentStage.value?.id,
  () => {
    anchor.value = periodRange(period.value, today).from;
  }
);

watch(categoryKey, () => {
  loadedCategoryKey = '';
  categoryError.value = false;
  loadCategories();
}, { immediate: true });

watch([period, selectedKey, periodOptions, loading], () => {
  nextTick(alignRail);
});

onMounted(() => {
  nextTick(alignRail);
});
</script>
