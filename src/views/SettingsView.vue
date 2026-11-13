<template>
  <section class="settings-page">
    <section class="settings-card settings-profile-card">
      <button class="settings-profile" type="button" @click="showProfile = true">
        <ProfileAvatar :avatar="profile.avatar" :name="profile.name" :size="44" />
        <span class="settings-profile-copy">
          <strong>{{ profileName }}</strong>
          <small>{{ profile.name ? '铲屎官 · 点这里修改' : '点这里设置昵称和头像' }}</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6"></path>
        </svg>
      </button>
    </section>

    <section class="settings-card">
      <div class="settings-card-head">
        <h2>小账本</h2>
        <span>{{ globalStats.count }} 笔</span>
      </div>
      <button class="settings-action" type="button" @click="showBackup = true">
        <span>
          账本与备份
          <small :class="{ 'is-overdue': backupLoaded && backupInfo.overdue }">
            {{ backupLoaded ? backupInfo.text : '果冻在看看备份记录…' }}
            <template v-if="backupLoaded && !backupInfo.overdue"> · 导出全部账本、导入或搬新家</template>
          </small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6"></path>
        </svg>
      </button>
      <button class="settings-action" type="button" @click="openYearSummary">
        <span>
          小票
          <small>按月看支出小票、足迹和果冻的话</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 2.5h12v19l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"></path>
          <path d="M9 7h6"></path>
          <path d="M9 10.5h6"></path>
          <path d="M9 14h4"></path>
        </svg>
      </button>
      <button class="settings-action" type="button" @click="openSummary">
        <span>
          果冻的账本小结
          <small>果冻风格图片，可以分享或保存</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3"></rect>
          <circle cx="8.5" cy="9" r="1.5"></circle>
          <path d="m5 17 5-5 4 4 2-2 3 3"></path>
        </svg>
      </button>
      <button class="settings-action" type="button" @click="exportCsv">
        <span>
          导出这个账本的 CSV
          <small>可以用 Excel 打开，带着账本标题</small>
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
        <h2>本机存储</h2>
        <span>{{ storageLoaded ? (storageState.persisted ? '已保护' : '未保护') : '…' }}</span>
      </div>
      <div class="settings-storage">
        <div class="settings-storage-row">
          <span>已用空间</span>
          <strong>{{ storageLoaded ? storageUsageText : '—' }}</strong>
        </div>
        <p class="settings-storage-hint">{{ storageLoaded ? storageHint : '果冻在看看存储状态…' }}</p>
        <button
          v-if="storageState.canPersist"
          class="settings-storage-btn"
          type="button"
          :disabled="storageBusy"
          @click="requestStoragePersist"
        >
          {{ storageBusy ? '果冻在申请…' : '开启存储保护' }}
        </button>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-card-head">
        <h2>果冻的偏好</h2>
      </div>
      <button class="settings-action" type="button" @click="showCategories = true">
        <span>
          钱钱分类
          <small>{{ categories.length }} 个 · 可以换图标、排序、改名或删掉</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 6 6 6-6 6"></path>
        </svg>
      </button>
      <button class="settings-action" type="button" @click="sheets.openAchievements()">
        <span>
          果冻成就
          <small>{{ unlockedCount }} 枚爪印 · 现在叫 {{ currentCatTitle }}</small>
        </span>
        <PawIcon class="settings-paw" />
      </button>
      <button class="settings-action" type="button" @click="install">
        <span>
          把果冻放到桌面
          <small>{{ standalone ? '果冻已经住进桌面啦' : '像 App 一样从桌面打开' }}</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3v12"></path>
          <path d="m7 8 5-5 5 5"></path>
          <path d="M5 21h14"></path>
        </svg>
      </button>
      <div v-if="showInstallTip" class="install-tip">
        <template v-if="isIos">在 Safari 点底部 <b>分享</b>，再选 <b>添加到主屏幕</b>，果冻就住进去啦。</template>
        <template v-else>在浏览器菜单里选 <b>安装应用 / 添加到主屏幕</b> 就好啦。</template>
      </div>
    </section>

    <section class="settings-card">
      <div class="settings-card-head">
        <h2>再逛逛</h2>
      </div>
      <button class="settings-action" type="button" @click="shareApp">
        <span>
          把果冻分享给朋友
          <small>让朋友也来守财</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path>
          <path d="M12 16V4"></path>
          <path d="m8 8 4-4 4 4"></path>
        </svg>
      </button>
      <button class="settings-action" type="button" @click="showHelp = true">
        <span>
          果冻的使用说明
          <small>记账、批量记、备份和常见问题</small>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M9.5 9a2.5 2.5 0 1 1 3.8 2.2c-.8.5-1.3 1-1.3 2"></path>
          <path d="M12 17h.01"></path>
        </svg>
      </button>
    </section>

    <p class="settings-privacy settings-privacy-plain">
      账目、账本和你的昵称头像都乖乖待在这台设备里，不会上传。语音识别由浏览器和系统提供，要不要上传音频要看浏览器的实现。
    </p>

    <button class="settings-danger-link" type="button" @click="clearCurrentStage">
      清空这个账本的花销
    </button>

    <p class="settings-footer">
      守财小果 · 果冻陪你记账 · 数据只属于你
      <template v-if="buildLabel"> · {{ buildLabel }}</template>
    </p>

    <HelpSheet v-model:show="showHelp" />

    <CategorySheet v-model:show="showCategories" />

    <ProfileSheet v-model:show="showProfile" />

    <BackupSheet v-model:show="showBackup" @import="openImport" />

    <ImportSheet
      v-model:show="showImport"
      @imported="onImported"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { closeToast, showConfirmDialog, showLoadingToast, showToast } from 'vant';
import BackupSheet from '../components/BackupSheet.vue';
import CategorySheet from '../components/CategorySheet.vue';
import HelpSheet from '../components/HelpSheet.vue';
import ImportSheet from '../components/ImportSheet.vue';
import PawIcon from '../components/PawIcon.vue';
import ProfileAvatar from '../components/ProfileAvatar.vue';
import ProfileSheet from '../components/ProfileSheet.vue';
import { useLedger } from '../composables/useLedger';
import { useSheets } from '../composables/useSheets';
import { useAchievements } from '../composables/useAchievements';
import { usePwaInstall } from '../composables/usePwaInstall';
import { useProfile } from '../composables/useProfile';
import { exportStageCsvInWorker, saveBlob } from '../lib/dataClient';
import { getSetting } from '../lib/db';
import { formatBytes, getStorageState, requestPersistence } from '../lib/storage';
import { backupReminder } from '../utils/backupReminder';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';
import { setActiveScope } from '../lib/privacy.js';

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
const { profile, profileName, initProfile } = useProfile();

const showInstallTip = ref(false);
const showImport = ref(false);
const storageState = ref({
  supported: false,
  persisted: false,
  canPersist: false,
  usage: 0,
  quota: 0
});
const storageBusy = ref(false);
const storageLoaded = ref(false);
const backupLoaded = ref(false);
const lastBackupAt = ref(null);
const backupInfo = computed(() => backupReminder(lastBackupAt.value));
const storageUsageText = computed(() => {
  const { usage, quota } = storageState.value;
  if (quota > 0) return `${formatBytes(usage)} / ${formatBytes(quota)}`;
  return usage > 0 ? formatBytes(usage) : '—';
});
const storageHint = computed(() => {
  const { supported, persisted, canPersist } = storageState.value;
  if (!supported) return '这个浏览器看不到存储状态，记得常打包备份。';
  if (persisted) return '已受保护，存储紧张时浏览器也不会自动清理果冻的账本（手动清数据除外）。';
  if (canPersist) return '开启后，存储紧张时浏览器不会自动清掉果冻的账本；换设备或手动清数据仍需备份。';
  return '浏览器可能自动清理本站数据，记得常打包备份。';
});
const buildLabel = (() => {
  const date = new Date(__APP_BUILD_TIME__);
  if (Number.isNaN(date.getTime())) return '';
  const label = date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `版本 ${label}`;
})();
const showBackup = ref(false);
const showCategories = ref(false);
const showHelp = ref(false);
const showProfile = ref(false);

setActiveScope('settings');

onMounted(() => {
  initProfile().catch((err) => console.error(err));
  initAchievements().catch((err) => console.error(err));
  refreshStorage();
  loadBackupAt();
});

watch(showBackup, (visible) => {
  if (!visible) loadBackupAt();
});

async function loadBackupAt() {
  try {
    const stored = await getSetting('lastBackupAt', null);
    lastBackupAt.value = stored ? Number(stored) : null;
  } catch (err) {
    lastBackupAt.value = null;
  } finally {
    backupLoaded.value = true;
  }
}

async function refreshStorage() {
  try {
    storageState.value = await getStorageState();
  } catch (err) {
    // Keep the current state when the browser refuses to report.
  } finally {
    storageLoaded.value = true;
  }
}

async function requestStoragePersist() {
  if (storageBusy.value) return;
  storageBusy.value = true;
  try {
    const result = await requestPersistence();
    await refreshStorage();
    if (result.persisted) {
      haptic('success');
      showToast('存储保护开启啦');
    } else {
      showToast('浏览器暂时没给保护，记得常打包备份');
    }
  } catch (err) {
    showToast('没申请成功，再试一次吧');
  } finally {
    storageBusy.value = false;
  }
}

function onImported() {
  showImport.value = false;
  router.push('/');
}

function openImport() {
  showBackup.value = false;
  showImport.value = true;
}

function openYearSummary() {
  router.push('/diary');
}

async function shareApp() {
  const url = `${window.location.origin}${window.location.pathname}`;
  const data = {
    title: '守财小果',
    text: '果冻陪你一句一句记小账',
    url
  };

  if (navigator.share) {
    try {
      await navigator.share(data);
      haptic('light');
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    haptic('light');
    showToast('链接已复制，发给朋友吧');
  } catch (err) {
    showToast(url);
  }
}

function openSummary() {
  if (!currentStage.value) {
    showToast('果冻还没有账本呢');
    return;
  }
  if (!currentStageStats.value.count) {
    showToast('这个账本果冻还没花过钱');
    return;
  }
  sheets.openSummary(currentStage.value);
}

async function install() {
  if (standalone.value) {
    showToast('果冻已经住进桌面啦');
    return;
  }
  const accepted = await promptInstall();
  showInstallTip.value = !accepted;
  if (accepted) showToast('果冻已经住进桌面啦');
}

async function exportCsv() {
  if (!currentStage.value) {
    showToast('果冻还没有账本呢');
    return;
  }
  if (!currentStageStats.value.count) {
    showToast('这个账本果冻还没花过钱');
    return;
  }

  showLoadingToast({ message: '果冻在打包账本…', forbidClick: true, duration: 0 });
  try {
    const result = await exportStageCsvInWorker(currentStage.value);
    closeToast();
    if (result.empty) {
      showToast('这个账本果冻还没花过钱');
      return;
    }
    saveBlob(result.blob, result.filename);
    haptic('success');
    showToast('打包好啦（带着账本标题）');
  } catch (err) {
    closeToast();
    console.error(err);
    showToast('打包失败啦，再试一次吧');
  }
}

async function clearCurrentStage() {
  if (!currentStage.value) return;
  if (!currentStageStats.value.count) {
    showToast('这个账本果冻还没花过钱');
    return;
  }
  try {
    await showConfirmDialog({
      title: '清空这个账本的花销',
      message: `要把「${currentStage.value.name}」里的花销都清掉吗？清掉就找不回来啦。`,
      confirmButtonText: '清空吧',
      confirmButtonColor: DANGER_COLOR
    });
  } catch (err) {
    return;
  }
  await clearStageExpenses(currentStage.value.id);
  haptic('warning');
  showToast('这个账本的花销清空啦');
}
</script>
