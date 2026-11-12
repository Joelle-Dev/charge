<template>
  <div class="spend-line-chart">
    <div v-if="!hasData" class="spend-line-empty">
      <span class="spend-line-empty-paw" aria-hidden="true"><PawIcon /></span>
      <span>果冻这段时间还没花钱</span>
    </div>
    <div v-else class="spend-line-stage">
      <svg
        class="spend-line-svg"
        :viewBox="`0 0 ${WIDTH} ${height}`"
        role="img"
        :aria-label="ariaLabel"
        @pointermove="onPointerMove"
        @pointerdown="onPointerDown"
        @pointerleave="onPointerLeave"
      >
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.24" />
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
          </linearGradient>
        </defs>

        <g class="spend-line-grid">
          <g v-for="line in gridLines" :key="line.value">
            <line
              :x1="PAD.left"
              :x2="WIDTH - PAD.right"
              :y1="line.y"
              :y2="line.y"
            />
          </g>
        </g>

        <path
          v-if="areaPath"
          :d="areaPath"
          :fill="`url(#${gradientId})`"
          class="spend-line-area"
        />
        <path
          v-if="linePath"
          :key="lineKey"
          :d="linePath"
          pathLength="1"
          class="spend-line-path"
          fill="none"
          stroke="var(--accent)"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <g v-if="peakPoint" class="spend-line-peak">
          <line
            :x1="PAD.left"
            :x2="WIDTH - PAD.right"
            :y1="peakPoint.y"
            :y2="peakPoint.y"
          />
          <text
            :x="WIDTH - PAD.right"
            :y="peakLabelY"
            text-anchor="end"
          >{{ peakLabel }}</text>
        </g>

        <circle
          v-for="(point, index) in coords"
          v-show="showDot(index)"
          :key="point.key"
          :cx="point.x"
          :cy="point.y"
          :r="activeIndex === index ? 4 : 2.4"
          class="spend-line-dot"
          :class="{ 'is-active': activeIndex === index }"
        >
          <title>{{ point.fullLabel }}：{{ amountLabel(point.amount) }}</title>
        </circle>

        <g class="spend-line-x">
          <text
            v-for="point in labelCoords"
            :key="point.key"
            :x="point.x"
            :y="height - 7"
            text-anchor="middle"
          >
            {{ xLabel(point) }}
          </text>
        </g>
      </svg>

      <div v-if="activePoint" class="spend-line-tooltip" :style="tooltipStyle">
        <span>{{ activePoint.fullLabel }}</span>
        <strong>{{ amountLabel(activePoint.amount) }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue';
import PawIcon from './PawIcon.vue';
import { displayMoney } from '../utils/money';

const props = defineProps({
  points: { type: Array, default: () => [] },
  period: { type: String, default: 'month' },
  label: { type: String, default: '' },
  height: { type: Number, default: 210 }
});

const WIDTH = 340;
const PAD = { top: 16, right: 10, bottom: 26, left: 14 };
const PLOT_WIDTH = WIDTH - PAD.left - PAD.right;
const height = computed(() => Math.max(120, Number(props.height) || 210));
const plotHeight = computed(() => Math.max(1, height.value - PAD.top - PAD.bottom));
const NICE_STEPS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];

const gradientId = `spend-line-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
const activeIndex = ref(-1);

const maxAmount = computed(() => props.points.reduce(
  (peak, point) => Math.max(peak, Number(point.amount) || 0),
  0
));
const scaleMax = computed(() => niceMax(maxAmount.value));
const hasData = computed(() => maxAmount.value > 0);

function niceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const normalized = value / base;
  const step = NICE_STEPS.find((candidate) => normalized <= candidate) || 10;
  return step * base;
}

function xFor(index) {
  if (props.points.length <= 1) return PAD.left + PLOT_WIDTH / 2;
  return PAD.left + (index / (props.points.length - 1)) * PLOT_WIDTH;
}

function yFor(value) {
  return PAD.top + plotHeight.value - (Number(value) || 0) / scaleMax.value * plotHeight.value;
}

const coords = computed(() => props.points.map((point, index) => ({
  ...point,
  x: xFor(index),
  y: yFor(point.amount)
})));

const gridLines = computed(() => {
  const values = [scaleMax.value, scaleMax.value / 2, 0];
  return values.map((value) => ({ value, y: yFor(value) }));
});

const linePath = computed(() => {
  if (!coords.value.length) return '';
  return coords.value
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join(' ');
});

const areaPath = computed(() => {
  if (coords.value.length < 2) return '';
  const baseline = round(yFor(0));
  const start = coords.value[0];
  const end = coords.value[coords.value.length - 1];
  const line = coords.value.map((point) => `L${round(point.x)} ${round(point.y)}`).join(' ');
  return `M${round(start.x)} ${baseline} ${line} L${round(end.x)} ${baseline} Z`;
});

const labelIndices = computed(() => {
  const count = props.points.length;
  if (props.period === 'month') {
    const lastDay = count;
    return [1, 5, 10, 15, 20, 25, lastDay]
      .filter((day, position, list) => day <= count && list.indexOf(day) === position)
      .map((day) => day - 1);
  }
  if (count <= 12) return props.points.map((point, index) => index);
  return [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => Math.round(ratio * (count - 1)))
    .filter((index, position, list) => list.indexOf(index) === position);
});

function xLabel(point) {
  const label = String(point.label ?? '');
  return props.period === 'month' ? label.padStart(2, '0') : label;
}

const labelCoords = computed(() => labelIndices.value.map((index) => coords.value[index]));

const peakIndex = computed(() => {
  if (!hasData.value || !coords.value.length) return -1;
  let best = 0;
  coords.value.forEach((point, index) => {
    if (point.amount > coords.value[best].amount) best = index;
  });
  return best;
});

const peakPoint = computed(() => (
  peakIndex.value >= 0 ? coords.value[peakIndex.value] : null
));

const peakLabelY = computed(() => (
  peakPoint.value ? Math.max(12, peakPoint.value.y - 7) : 0
));

const peakLabel = computed(() => {
  const point = peakPoint.value;
  return point ? `${point.fullLabel} · ¥${displayMoney(point.amount)}` : '';
});

const activePoint = computed(() => (
  activeIndex.value >= 0 ? coords.value[activeIndex.value] : null
));

const tooltipStyle = computed(() => {
  const point = activePoint.value;
  if (!point) return {};
  const left = Math.min(86, Math.max(14, point.x / WIDTH * 100));
  return {
    left: `${left}%`,
    top: `${point.y / height.value * 100}%`
  };
});

const lineKey = computed(() => {
  const first = props.points[0]?.key || '';
  const last = props.points[props.points.length - 1]?.key || '';
  return `${props.period}-${first}-${last}`;
});

const ariaLabel = computed(() => (
  `${props.label || '支出趋势'}，总支出 ¥${displayMoney(totalAmount())}`
));

function totalAmount() {
  return props.points.reduce((sum, point) => sum + (Number(point.amount) || 0), 0);
}

function amountLabel(value) {
  return `¥${displayMoney(value)}`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function showDot(index) {
  if (props.points.length <= 12) return true;
  return index === peakIndex.value || index === activeIndex.value;
}

function indexFromEvent(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  if (!rect.width) return -1;
  const x = (event.clientX - rect.left) / rect.width * WIDTH;
  const ratio = (x - PAD.left) / PLOT_WIDTH;
  if (ratio < -0.08 || ratio > 1.08) return -1;
  return Math.max(0, Math.min(props.points.length - 1, Math.round(ratio * (props.points.length - 1))));
}

function onPointerMove(event) {
  if (event.pointerType === 'touch') return;
  activeIndex.value = indexFromEvent(event);
}

function onPointerDown(event) {
  activeIndex.value = indexFromEvent(event);
}

function onPointerLeave(event) {
  if (event.pointerType === 'mouse') activeIndex.value = -1;
}

watch(
  [() => props.period, () => props.points],
  () => {
    activeIndex.value = -1;
  }
);
</script>

<style scoped>
.spend-line-chart {
  width: 100%;
}

.spend-line-stage {
  position: relative;
  width: 100%;
}

.spend-line-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  touch-action: pan-y;
}

.spend-line-grid line {
  stroke: var(--line);
  stroke-width: 1;
  stroke-dasharray: 2 4;
}

.spend-line-area {
  animation: spend-line-fade 0.5s ease-out both;
}

.spend-line-path {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: spend-line-draw 0.7s ease-out both;
}

.spend-line-x text {
  fill: var(--muted-soft);
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
}

.spend-line-peak line {
  stroke: color-mix(in srgb, var(--accent) 58%, transparent);
  stroke-width: 1.2;
  stroke-dasharray: 4 4;
}

.spend-line-peak text {
  fill: var(--ink-soft);
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  paint-order: stroke;
  stroke: var(--surface);
  stroke-width: 3px;
  stroke-linejoin: round;
}

.spend-line-dot {
  fill: var(--surface);
  stroke: var(--accent);
  stroke-width: 1.6;
  transition: r 0.15s ease, fill 0.15s ease;
}

.spend-line-dot.is-active {
  fill: var(--accent);
  stroke: #fff;
  stroke-width: 2;
}

.spend-line-tooltip {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px 8px;
  transform: translate(-50%, calc(-100% - 8px));
  border-radius: 10px;
  background: rgba(45, 39, 35, 0.94);
  box-shadow: 0 6px 16px rgba(var(--shadow-rgb), 0.24);
  color: #fff;
  font-size: 10px;
  white-space: nowrap;
  pointer-events: none;
}

.spend-line-tooltip strong {
  color: var(--hero-accent);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.spend-line-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 132px;
  padding: 16px;
  color: var(--muted);
  font-size: 11.5px;
  text-align: center;
}

.spend-line-empty-paw {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--paw);
}

.spend-line-empty-paw svg {
  width: 18px;
  height: 18px;
}

@keyframes spend-line-draw {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}

@keyframes spend-line-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .spend-line-path,
  .spend-line-area {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
