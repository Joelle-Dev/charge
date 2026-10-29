<template>
  <section class="settings-page">
    <header class="settings-page-head">
      <button class="records-back" type="button" aria-label="返回首页" @click="goHome">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6"></path>
        </svg>
      </button>
      <div class="settings-page-title">
        <h1>设置</h1>
        <p>数据、备份与偏好</p>
      </div>
      <span class="settings-version-pill">v1.0</span>
    </header>

    <section class="settings-hero">
      <div class="settings-hero-glow" aria-hidden="true"></div>
      <div class="settings-hero-top">
        <div class="settings-hero-copy">
          <span class="settings-eyebrow">数据安全</span>
          <strong>{{ globalStats.count }} 笔支出 · {{ stages.length }} 个阶段</strong>
        </div>
        <span class="settings-shield" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3 5 6v5c0 4.6 3 8 7 10 4-2 7-5.4 7-10V6l-7-3Z"></path>
            <path d="m9 12 2 2 4-4"></path>
          </svg>
        </span>
      </div>

      <div class="settings-hero-actions">
        <button class="settings-hero-primary" type="button" @click="exportFullBackup">
          导出完整备份
        </button>
        <button class="settings-hero-secondary" type="button" @click="showImport = true">
          导入 / 换机
        </button>
      </div>

      <p class="settings-last-backup">上次备份：{{ lastBackupText }}</p>

      <div class="settings-badges">
        <span>仅本机存储</span>
        <span>不上传云端</span>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-card-head">
        <h2>数据与分析</h2>
        <span>{{ globalStats.count }} 笔</span>
      </div>
      <button class="settings-action" type="button" @click="openYearSummary">
        <span>
          全年汇总
          <small>按年查看趋势、分类和阶段排行</small>
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
        <h2>分类</h2>
        <span>{{ categories.length }}/20</span>
      </div>
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
    </section>

    <section class="settings-card">
      <div class="settings-card-head">
        <h2>果冻</h2>
      </div>
      <button class="settings-action" type="button" @click="sheets.openAchievements()">
        <span>
          果冻成就
          <small>{{ unlockedCount }} 枚爪印 · 当前称号 {{ currentCatTitle }}</small>
        </span>
        <PawIcon class="settings-paw" />
      </button>
    </section>

    <section class="settings-card">
      <div class="settings-card-head">
        <h2>应用</h2>
      </div>
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
      <p class="settings-privacy">
        所有账目和阶段都保存在这台设备的浏览器里，不会上传到服务器。语音识别由浏览器和系统提供，是否上传音频取决于浏览器实现。
      </p>
    </section>

    <section class="settings-card settings-danger-card">
      <div class="settings-card-head">
        <h2>危险操作</h2>
      </div>
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
    </section>

    <p class="settings-footer">守财小果 · 语音记账 · 数据只属于你</p>

    <ImportSheet
      v-model:show="showImport"
      @imported="onImported"
      @backup-exported="loadMeta"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { closeToast, showConfirmDialog, showLoadingToast, showToast } from 'vant';
import ImportSheet from '../components/ImportSheet.vue';
import PawIcon from '../components/PawIcon.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { useAchievements } from '../composables/useAchievements';
import { usePwaInstall } from '../composables/usePwaInstall';
import { getSetting } from '../lib/db';
import { exportBackupInWorker, exportStageCsvInWorker, saveBlob } from '../lib/dataClient';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';

const router = useRouter();
const {
  stages,
  categories,
  currentStage,
  currentStageStats,
  currentCatTitle,
  globalStats,
  setCategories,
  clearStageExpenses,
  isCategoryUsed
} = useLedger();
const sheets = useSheets();
const { unlockedCount, initAchievements } = useAchievements();
const { standalone, isIos, promptInstall } = usePwaInstall();

const newCategory = ref('');
const showInstallTip = ref(false);
const showImport = ref(false);
const lastBackupAt = ref(null);

const lastBackupText = computed(() => {
  if (!lastBackupAt.value) return '还没有备份';
  return formatDateTime(lastBackupAt.value);
});

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '还没有备份';
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

async function loadMeta() {
  try {
    const stored = await getSetting('lastBackupAt', null);
    lastBackupAt.value = stored ? Number(stored) : null;
  } catch (err) {
    lastBackupAt.value = null;
  }
}

onMounted(() => {
  initAchievements().catch((err) => console.error(err));
  loadMeta();
});

function goHome() {
  router.push('/');
}

function onImported() {
  showImport.value = false;
  loadMeta();
  router.push('/');
}

function openYearSummary() {
  router.push('/year');
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
  const inUse = isCategoryUsed(category);
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

async function exportFullBackup() {
  if (!stages.value.length) {
    showToast('还没有数据可以备份');
    return;
  }

  showLoadingToast({ message: '正在导出完整备份…', forbidClick: true, duration: 0 });
  try {
    await initAchievements().catch(() => {});
    const result = await exportBackupInWorker();
    closeToast();
    if (result.empty) {
      showToast('还没有数据可以备份');
      return;
    }
    saveBlob(result.blob, result.filename);
    lastBackupAt.value = Date.now();
    loadMeta();
    haptic('success');
    showToast('已导出完整备份');
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
