<template>
  <div class="loading-state" v-if="!ready">
    <span class="loading-paw" aria-hidden="true"><PawIcon /></span>
    {{ loadingHint }}
  </div>
  <Transition v-else name="stage-fade" mode="out-in">
    <EmptyState v-if="!currentStage" key="empty" />
    <div v-else :key="currentStage.id" class="dashboard ledger-home" :class="{ 'is-entering': entering }">
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
      <StageLedgerList />
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useLedger } from '../composables/useLedger';
import { useProfile } from '../composables/useProfile';
import EmptyState from '../components/EmptyState.vue';
import HeroSummary from '../components/HeroSummary.vue';
import ProfileAvatar from '../components/ProfileAvatar.vue';
import StageLedgerList from '../components/StageLedgerList.vue';
import PawIcon from '../components/PawIcon.vue';
import { greetingForHour } from '../utils/profile';

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

function openProfile() {
  router.push('/settings');
}

const entering = ref(false);
let enteredOnce = false;
let enterTimer = 0;

watch(ready, (isReady) => {
  if (!isReady || enteredOnce) return;
  enteredOnce = true;
  entering.value = true;
  enterTimer = window.setTimeout(() => { entering.value = false; }, 1400);
}, { immediate: true });
</script>
