<template>
  <SheetFrame v-model:show="show" title="果冻的账本小结" max-height="92dvh">
    <template v-if="summary">
      <div ref="cardRef" class="summary-card">
        <div class="summary-top">
          <div class="summary-cat"><CatMood :mood="mood" /></div>
          <div class="summary-heading">
            <span class="summary-eyebrow">果冻的账本小结</span>
            <strong>{{ summary.stage.name }}</strong>
            <span>{{ rangeText }}</span>
          </div>
          <span class="summary-title">{{ summary.catTitle }}</span>
        </div>

        <div class="summary-total">
          <span>一共花了</span>
          <strong>¥{{ displayMoney(summary.total) }}</strong>
          <small>{{ summary.count }} 笔 · {{ budgetText }}</small>
        </div>

        <div class="summary-categories">
          <div v-for="item in summary.topCategories" :key="item.category" class="summary-category">
            <div class="summary-category-line">
              <span class="summary-category-name"><CategoryIcon class="summary-category-icon" :name="iconFor(item.category)" /> {{ item.category }}</span>
              <span>¥{{ displayMoney(item.amount) }} · {{ Math.round(item.percent) }}%</span>
            </div>
            <div class="summary-track">
              <div class="summary-fill" :style="{ width: `${item.percent}%`, background: categoryColor(item.category) }"></div>
            </div>
          </div>
        </div>

        <div class="summary-footer">
          <ProfileAvatar class="summary-profile-avatar" :avatar="profile.avatar" :name="profile.name" :size="20" />
          <span>{{ profileName }} · 守财小果</span>
        </div>
      </div>

      <div class="form-actions">
        <button class="primary-btn" type="button" :disabled="busy" @click="shareSummary">
          {{ busy ? '果冻在画画…' : '分享 / 保存这张图' }}
        </button>
      </div>
      <p class="sheet-note">图片由本机画出来，不会上传账本数据。</p>
    </template>

    <div v-else class="list-empty">
        <p>果冻还没画出小结</p>
        <span>先记几笔，再来看看嘛</span>
    </div>
  </SheetFrame>
</template>

<script setup>
import { computed, ref } from 'vue';
import { showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import CatMood from './CatMood.vue';
import CategoryIcon from './CategoryIcon.vue';
import ProfileAvatar from './ProfileAvatar.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { useProfile } from '../composables/useProfile';
import { displayMoney } from '../utils/money';
import { categoryColor } from '../utils/format';
import { haptic } from '../utils/haptics';
import { saveImage } from '../utils/saveImage';

const show = defineModel('show', { type: Boolean, default: false });
const sheets = useSheets();
const { stageSummary , iconFor } = useLedger();
const { profile, profileName } = useProfile();
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
  if (!summary.value || !summary.value.budget) return '还没放猫粮预算';
  const budget = displayMoney(summary.value.budget);
  if (summary.value.remaining >= 0) return `猫粮罐 ¥${budget} · 还剩 ¥${displayMoney(summary.value.remaining)}`;
  return `猫粮罐 ¥${budget} · 花超啦 ¥${displayMoney(Math.abs(summary.value.remaining))}`;
});

async function shareSummary() {
  if (!summary.value || !cardRef.value || busy.value) return;
  busy.value = true;
  try {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(cardRef.value, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#faf5ec'
    });
    const filename = `${summary.value.stage.name.replace(/[\\/:*?"<>|]/g, '_')}-小结.png`;
    const result = await saveImage(dataUrl, filename, {
      title: `${summary.value.stage.name} · 果冻的账本小结`,
      text: `${summary.value.stage.name} 一共花了 ¥${displayMoney(summary.value.total)}`
    });
    if (result === 'share') {
      showToast('已打开分享，选「存储图像」保存');
    } else if (result === 'preview') {
      showToast('长按图片保存到相册');
    } else if (result === 'download') {
      showToast('小结图已保存到下载文件夹');
    }
    if (result !== 'cancelled') haptic('success');
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.error(err);
      showToast('画像失败啦，再试一次吧');
    }
  } finally {
    busy.value = false;
  }
}
</script>
