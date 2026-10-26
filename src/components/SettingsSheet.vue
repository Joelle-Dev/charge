<template>
  <SheetFrame v-model:show="show" title="设置" max-height="92dvh">
    <div class="settings-block">
      <h3 class="settings-title">应用</h3>
      <button class="settings-action" type="button" @click="install">
        <span>
          添加到主屏幕
          <small>{{ standalone ? '当前已作为应用运行' : '像 App 一样从桌面打开' }}</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3v12"></path>
          <path d="m7 8 5-5 5 5"></path>
          <path d="M5 21h14"></path>
        </svg>
      </button>
      <div v-if="showInstallTip" class="install-tip">
        <template v-if="isIos">在 Safari 中点击底部 <b>分享</b> 按钮，选择 <b>添加到主屏幕</b>。</template>
        <template v-else>在浏览器菜单中选择 <b>安装应用 / 添加到主屏幕</b>。</template>
      </div>
    </div>

    <div class="settings-block">
      <h3 class="settings-title">果冻</h3>
      <button class="settings-action" type="button" @click="sheets.openAchievements()">
        <span>
          果冻成就
          <small>{{ unlockedCount }} 枚爪印 · 当前称号 {{ currentCatTitle }}</small>
        </span>
        <PawIcon class="settings-paw" />
      </button>
    </div>

    <div class="settings-block">
      <h3 class="settings-title">分类</h3>
      <p class="settings-desc">分类用于汇总和语音识别。自定义分类名称也会作为识别关键词。</p>
      <div class="category-manage">
        <span v-for="category in categories" :key="category" class="category-tag">
          {{ category }}
          <button
            v-if="category !== '其他'"
            type="button"
            :aria-label="`删除分类 ${category}`"
            @click="removeCategory(category)"
          >
            ×
          </button>
        </span>
      </div>
      <div class="add-category">
        <input
          v-model="newCategory"
          class="input"
          type="text"
          maxlength="10"
          placeholder="新分类，比如：宠物"
          @keydown.enter.prevent="addCategory"
        >
        <button class="secondary-btn" type="button" @click="addCategory">添加</button>
      </div>
    </div>

    <div class="settings-block">
      <h3 class="settings-title">导出</h3>
      <p class="settings-desc">
        导出「{{ currentStage?.name || '当前阶段' }}」的全部支出。CSV 会包含阶段标题、导出时间、笔数、总支出和预算信息。
      </p>
      <button class="settings-action" type="button" @click="openSummary">
        <span>
          生成阶段小结卡
          <small>果冻风格图片，可分享或保存</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3"></rect>
          <circle cx="8.5" cy="9" r="1.5"></circle>
          <path d="m5 17 5-5 4 4 2-2 3 3"></path>
        </svg>
      </button>
      <button class="settings-action" type="button" @click="exportCsv">
        <span>
          导出当前阶段 CSV
          <small>可用 Excel 打开，包含阶段标题</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3v12"></path>
          <path d="m7 10 5 5 5-5"></path>
          <path d="M5 21h14"></path>
        </svg>
      </button>
    </div>

    <div class="settings-block">
      <h3 class="settings-title">数据</h3>
      <button class="settings-action" type="button" @click="clearCurrentStage">
        <span>
          清空当前阶段支出
          <small>只删除支出，保留阶段</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18"></path>
          <path d="M8 6V4h8v2"></path>
          <path d="m5 6 1 14h12l1-14"></path>
        </svg>
      </button>
    </div>

    <div class="settings-block">
      <h3 class="settings-title">隐私</h3>
      <p class="settings-desc">
        所有账目和阶段都保存在这台设备的浏览器里，不会上传到服务器。语音识别由浏览器和系统提供，是否上传音频取决于浏览器实现。
      </p>
      <p class="settings-desc settings-version">守财小果 · 语音记账 v1.0</p>
    </div>
  </SheetFrame>
</template>

<script setup>
import { ref } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import PawIcon from './PawIcon.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { useAchievements } from '../composables/useAchievements';
import { usePwaInstall } from '../composables/usePwaInstall';
import { exportStageCsv } from '../utils/csv';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';

const show = defineModel('show', { type: Boolean, default: false });
const {
  categories,
  expenses,
  currentStage,
  currentExpenses,
  currentCatTitle,
  setCategories,
  clearStageExpenses
} = useLedger();
const sheets = useSheets();
const { unlockedCount } = useAchievements();
const { standalone, isIos, promptInstall } = usePwaInstall();

const newCategory = ref('');
const showInstallTip = ref(false);

async function install() {
  if (standalone.value) {
    showToast('当前已作为应用运行');
    return;
  }
  const accepted = await promptInstall();
  showInstallTip.value = !accepted;
  if (accepted) showToast('已添加到主屏幕');
}

async function addCategory() {
  const name = newCategory.value.trim();
  if (!name) return;
  if (categories.value.includes(name)) {
    showToast('这个分类已经有了');
    return;
  }
  if (categories.value.length >= 20) {
    showToast('分类最多 20 个');
    return;
  }
  await setCategories([...categories.value, name]);
  newCategory.value = '';
  showToast(`已添加「${name}」`);
}

async function removeCategory(category) {
  if (category === '其他') {
    showToast('「其他」是默认分类，不能删除');
    return;
  }
  if (categories.value.length <= 1) {
    showToast('至少保留一个分类');
    return;
  }
  const inUse = expenses.value.some((expense) => expense.category === category);
  if (inUse) {
    try {
      await showConfirmDialog({
        title: '删除分类',
        message: `已有支出使用「${category}」，删除分类后历史记录仍会保留这个名称。继续？`,
        confirmButtonText: '继续删除',
        confirmButtonColor: DANGER_COLOR
      });
    } catch (err) {
      return;
    }
  }
  await setCategories(categories.value.filter((item) => item !== category));
  showToast(`已删除「${category}」`);
}

function exportCsv() {
  if (!currentStage.value) {
    showToast('还没有阶段');
    return;
  }
  const ok = exportStageCsv(currentStage.value, currentExpenses.value);
  if (ok) haptic('success');
  showToast(ok ? '已导出（含阶段标题）' : '这个阶段还没有支出');
}

function openSummary() {
  if (!currentStage.value) {
    showToast('还没有阶段');
    return;
  }
  if (!currentExpenses.value.length) {
    showToast('这个阶段还没有支出');
    return;
  }
  sheets.openSummary(currentStage.value);
}

async function clearCurrentStage() {
  if (!currentStage.value) return;
  if (!currentExpenses.value.length) {
    showToast('这个阶段还没有支出');
    return;
  }
  try {
    await showConfirmDialog({
      title: '清空支出',
      message: `清空「${currentStage.value.name}」里的全部支出？此操作不可恢复。`,
      confirmButtonText: '清空',
      confirmButtonColor: DANGER_COLOR
    });
  } catch (err) {
    return;
  }
  await clearStageExpenses(currentStage.value.id);
  haptic('warning');
  showToast('已清空当前阶段支出');
}
</script>
