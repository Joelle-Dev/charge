<template>
  <section class="settings-page">
    <section class="settings-card">
      <div class="settings-card-head">
        <h2>数据</h2>
        <span>{{ globalStats.count }} 笔</span>
      </div>
      <button class="settings-action" type="button" @click="showBackup = true">
        <span>
          数据与备份
          <small>导出完整备份、导入或换机</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6"></path>
        </svg>
      </button>
      <button class="settings-action" type="button" @click="openYearSummary">
        <span>
          历史支出
          <small>按日期范围查看年/月支出与趋势</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 20V10"></path>
          <path d="M10 20V4"></path>
          <path d="M16 20v-7"></path>
          <path d="M22 20H2"></path>
        </svg>
      </button>
      <button class="settings-action" type="button" @click="openSummary">
        <span>
          阶段小结卡
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
    </section>

    <section class="settings-card">
      <div class="settings-card-head">
        <h2>偏好</h2>
      </div>
      <button class="settings-action" type="button" @click="showCategories = true">
        <span>
          分类
          <small>{{ categories.length }} 个 · 添加、改名或删除</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6"></path>
        </svg>
      </button>
      <button class="settings-action" type="button" @click="sheets.openAchievements()">
        <span>
          果冻成就
          <small>{{ unlockedCount }} 枚爪印 · 当前称号 {{ currentCatTitle }}</small>
        </span>
        <PawIcon class="settings-paw" />
      </button>
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
    </section>

    <p class="settings-privacy settings-privacy-plain">
      所有账目和阶段都保存在这台设备的浏览器里，不会上传到服务器。语音识别由浏览器和系统提供，是否上传音频取决于浏览器实现。
    </p>

    <button class="settings-danger-link" type="button" @click="clearCurrentStage">
      清空当前阶段支出
    </button>

    <p class="settings-footer">守财小果 · 语音记账 · 数据只属于你</p>

    <CategorySheet v-model:show="showCategories" />

    <BackupSheet v-model:show="showBackup" @import="openImport" />

    <ImportSheet
      v-model:show="showImport"
      @imported="onImported"
    />
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { closeToast, showConfirmDialog, showLoadingToast, showToast } from 'vant';
import BackupSheet from '../components/BackupSheet.vue';
import CategorySheet from '../components/CategorySheet.vue';
import ImportSheet from '../components/ImportSheet.vue';
import PawIcon from '../components/PawIcon.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { useAchievements } from '../composables/useAchievements';
import { usePwaInstall } from '../composables/usePwaInstall';
import { exportStageCsvInWorker, saveBlob } from '../lib/dataClient';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';

const router = useRouter();
const {
  categories,
  currentStage,
  currentStageStats,
  currentCatTitle,
  globalStats,
  clearStageExpenses
} = useLedger();
const sheets = useSheets();
const { unlockedCount, initAchievements } = useAchievements();
const { standalone, isIos, promptInstall } = usePwaInstall();

const showInstallTip = ref(false);
const showImport = ref(false);
const showBackup = ref(false);
const showCategories = ref(false);

onMounted(() => {
  initAchievements().catch((err) => console.error(err));
});

function onImported() {
  showImport.value = false;
  router.push('/');
}

function openImport() {
  showBackup.value = false;
  showImport.value = true;
}

function openYearSummary() {
  router.push('/history');
}

function openSummary() {
  if (!currentStage.value) {
    showToast('还没有阶段');
    return;
  }
  if (!currentStageStats.value.count) {
    showToast('这个阶段还没有支出');
    return;
  }
  sheets.openSummary(currentStage.value);
}

async function install() {
  if (standalone.value) {
    showToast('当前已作为应用运行');
    return;
  }
  const accepted = await promptInstall();
  showInstallTip.value = !accepted;
  if (accepted) showToast('已添加到主屏幕');
}

async function exportCsv() {
  if (!currentStage.value) {
    showToast('还没有阶段');
    return;
  }
  if (!currentStageStats.value.count) {
    showToast('这个阶段还没有支出');
    return;
  }

  showLoadingToast({ message: '正在导出…', forbidClick: true, duration: 0 });
  try {
    const result = await exportStageCsvInWorker(currentStage.value);
    closeToast();
    if (result.empty) {
      showToast('这个阶段还没有支出');
      return;
    }
    saveBlob(result.blob, result.filename);
    haptic('success');
    showToast('已导出（含阶段标题）');
  } catch (err) {
    closeToast();
    console.error(err);
    showToast('导出失败，请重试');
  }
}

async function clearCurrentStage() {
  if (!currentStage.value) return;
  if (!currentStageStats.value.count) {
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
