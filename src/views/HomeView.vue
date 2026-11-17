<template>
  <LoadingState v-if="!ready" class="home-loading" :text="loadingHint" />
  <Transition v-else name="stage-fade" mode="out-in">
    <EmptyState v-if="!currentStage" key="empty" />
    <div v-else key="dashboard" class="dashboard ledger-home" :class="{ 'is-entering': entering }">
      <header class="ledger-home-head">
        <div class="ledger-home-side">
        </div>
        <div class="ledger-home-title">
          <h1>{{ mergeMode ? '合并账本' : '我的账本' }}</h1>
        </div>
        <div class="ledger-home-actions">
          <button
            v-if="mergeMode"
            class="ledger-mode-btn is-active"
            type="button"
            @click="exitMergeMode"
          >
            退出合并
          </button>
          <button
            v-else-if="canMerge"
            class="ledger-mode-btn"
            type="button"
            @click="enterMergeMode"
          >
            合并账本
          </button>
        </div>
      </header>

      <button class="ledger-home-greeting" type="button" aria-label="编辑我的资料" @click="openProfile">
        <ProfileAvatar :avatar="profile.avatar" :name="profile.name" :size="48" />
        <span class="ledger-home-greeting-copy">
          <strong>{{ greeting }}，{{ profileName }}</strong>
          <small>今天也和果冻一起守住钱钱吧</small>
        </span>
      </button>

      <HeroSummary />

      <div v-if="backupNotice" class="backup-notice" role="status">
        <span>{{ backupNotice }}</span>
        <button class="backup-notice-link" type="button" @click="openBackup">去打包</button>
        <button class="backup-notice-close" type="button" aria-label="先不提醒" @click="dismissBackupNotice">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <StageLedgerList />
    </div>
  </Transition>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useLedger } from '../composables/useLedger';
import { useProfile } from '../composables/useProfile';
import EmptyState from '../components/EmptyState.vue';
import LoadingState from '../components/LoadingState.vue';
import HeroSummary from '../components/HeroSummary.vue';
import ProfileAvatar from '../components/ProfileAvatar.vue';
import StageLedgerList from '../components/StageLedgerList.vue';
import { greetingForHour } from '../utils/profile';
import { backupReminder } from '../utils/backupReminder';
import { getSetting, setSetting } from '../lib/db';

const {
  ready,
  loadingHint,
  currentStage,
  mergeMode,
  canMerge,
  enterMergeMode,
  exitMergeMode
} = useLedger();
const { profile, profileName } = useProfile();
const router = useRouter();

const greeting = computed(() => greetingForHour(new Date().getHours()));

const entering = ref(false);
let enteredOnce = false;
let enterTimer = 0;

// 备份提醒：只在设置了「今天先不提醒」之外的隔天出现，避免天天弹。
const BACKUP_SNOOZE_KEY = 'backupNoticeSnoozedAt';
let backupSnoozedAt = 0;
const backupInfo = ref(null);

const backupNotice = computed(() => {
  if (!currentStage.value || !backupInfo.value?.overdue) return '';
  if (isSnoozedToday()) return '';
  return backupInfo.value.text;
});

function isSnoozedToday() {
  if (!backupSnoozedAt) return false;
  const snoozed = new Date(backupSnoozedAt);
  const today = new Date();
  return snoozed.toDateString() === today.toDateString();
}

async function loadBackupNotice() {
  try {
    const [lastBackupAt, snoozed] = await Promise.all([
      getSetting('lastBackupAt', null),
      getSetting(BACKUP_SNOOZE_KEY, null)
    ]);
    backupSnoozedAt = Number(snoozed) || 0;
    backupInfo.value = backupReminder(lastBackupAt ? Number(lastBackupAt) : null);
  } catch (err) {
    backupInfo.value = null;
  }
}

async function dismissBackupNotice() {
  backupSnoozedAt = Date.now();
  try {
    await setSetting(BACKUP_SNOOZE_KEY, backupSnoozedAt);
  } catch (err) {
    // 存不进去也没关系，本次会话内先隐藏。
  }
}

function openBackup() {
  router.push('/settings');
}

function openProfile() {
  router.push('/settings');
}

onMounted(loadBackupNotice);

watch(ready, (isReady) => {
  if (!isReady || enteredOnce) return;
  enteredOnce = true;
  entering.value = true;
  enterTimer = window.setTimeout(() => { entering.value = false; }, 900);
}, { immediate: true });

onUnmounted(() => window.clearTimeout(enterTimer));
</script>
