<template>
  <SheetFrame v-model:show="show" title="阶段小结" max-height="92dvh">
    <template v-if="summary">
      <div ref="cardRef" class="summary-card">
        <div class="summary-top">
          <div class="summary-cat"><CatMood :mood="mood" /></div>
          <div class="summary-heading">
            <span class="summary-eyebrow">果冻的阶段小结</span>
            <strong>{{ summary.stage.name }}</strong>
            <span>{{ rangeText }}</span>
          </div>
          <span class="summary-title">{{ summary.catTitle }}</span>
        </div>

        <div class="summary-total">
          <span>总支出</span>
          <strong>¥{{ formatMoney(summary.total) }}</strong>
          <small>{{ summary.count }} 笔 · {{ budgetText }}</small>
        </div>

        <div class="summary-categories">
          <div v-for="item in summary.topCategories" :key="item.category" class="summary-category">
            <div class="summary-category-line">
              <span>{{ item.category }}</span>
              <span>¥{{ formatMoney(item.amount) }} · {{ Math.round(item.percent) }}%</span>
            </div>
            <div class="summary-track">
              <div class="summary-fill" :style="{ width: `${item.percent}%`, background: categoryColor(item.category) }"></div>
            </div>
          </div>
        </div>

        <div class="summary-footer">
          <span class="summary-paw"><PawIcon /></span>
          <span>守财小果 · 果冻陪你记账</span>
        </div>
      </div>

      <div class="form-actions">
        <button class="primary-btn" type="button" :disabled="busy" @click="shareSummary">
          {{ busy ? '生成中…' : '分享 / 保存图片' }}
        </button>
      </div>
      <p class="sheet-note">图片由本机生成，不会上传阶段数据。</p>
    </template>

    <div v-else class="list-empty">
      <p>还没有阶段小结</p>
      <span>先记几笔再来看吧</span>
    </div>
  </SheetFrame>
</template>

<script setup>
import { computed, ref } from 'vue';
import { showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import CatMood from './CatMood.vue';
import PawIcon from './PawIcon.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { categoryColor, formatMoney } from '../utils/format';
import { haptic } from '../utils/haptics';

const show = defineModel('show', { type: Boolean, default: false });
const sheets = useSheets();
const { stageSummary } = useLedger();
const cardRef = ref(null);
const busy = ref(false);

const summary = computed(() =>
  sheets.summaryStage.value ? stageSummary(sheets.summaryStage.value) : null
);

const rangeText = computed(() => {
  if (!summary.value) return '';
  const from = summary.value.from.replace(/-/g, '.');
  const to = summary.value.to.replace(/-/g, '.');
  return from === to ? from : `${from} - ${to}`;
});

const mood = computed(() => {
  if (!summary.value || !summary.value.budget) return 'happy';
  if (summary.value.total > summary.value.budget) return 'sad';
  const ratio = summary.value.total / summary.value.budget;
  if (ratio >= 0.8) return 'worried';
  if (ratio >= 0.5) return 'watch';
  return 'happy';
});

const budgetText = computed(() => {
  if (!summary.value || !summary.value.budget) return '未设置预算';
  if (summary.value.remaining >= 0) return `预算 ¥${formatMoney(summary.value.budget)} · 剩余 ¥${formatMoney(summary.value.remaining)}`;
  return `预算 ¥${formatMoney(summary.value.budget)} · 超支 ¥${formatMoney(Math.abs(summary.value.remaining))}`;
});

function download(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

async function shareSummary() {
  if (!summary.value || !cardRef.value || busy.value) return;
  busy.value = true;
  let dataUrl = '';
  let filename = '';
  try {
    const { toPng } = await import('html-to-image');
    dataUrl = await toPng(cardRef.value, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#faf5ec'
    });
    filename = `${summary.value.stage.name.replace(/[\\/:*?"<>|]/g, '_')}-小结.png`;
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${summary.value.stage.name} · 阶段小结`,
          text: `${summary.value.stage.name} 共支出 ¥${formatMoney(summary.value.total)}`
        });
        showToast('已打开分享');
      } catch (err) {
        if (err?.name === 'AbortError') return;
        download(dataUrl, filename);
        showToast('分享不可用，已保存图片');
      }
    } else {
      download(dataUrl, filename);
      showToast('小结图片已保存');
    }
    haptic('success');
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.error(err);
      if (dataUrl && filename) {
        download(dataUrl, filename);
        showToast('已保存小结图片');
      } else {
        showToast('生成图片失败，请重试');
      }
    }
  } finally {
    busy.value = false;
  }
}
</script>
