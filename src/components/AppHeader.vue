<template>
  <header class="topbar">
    <button class="brand" type="button" aria-label="编辑我的资料" @click="openProfile">
      <ProfileAvatar :avatar="profile.avatar" :name="profile.name" :size="28" />
      <span class="brand-profile-name">{{ profileName }}</span>
    </button>

    <button class="stage-pill" type="button" aria-label="切换果冻的账本" @click="sheets.openStages()">
      <span class="stage-dot" :class="{ inactive: !currentStage }"></span>
      <span class="stage-pill-name">{{ currentStage ? currentStage.name : '选个账本吧' }}</span>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6"></path>
      </svg>
    </button>
  </header>
</template>

<script setup>
import { useRouter } from 'vue-router';
import ProfileAvatar from './ProfileAvatar.vue';
import { useLedger } from '../composables/useLedger';
import { useProfile } from '../composables/useProfile';
import { useSheets } from '../composables/useSheets';

const { currentStage } = useLedger();
const { profile, profileName } = useProfile();
const sheets = useSheets();
const router = useRouter();

function openProfile() {
  router.push('/settings');
}
</script>
