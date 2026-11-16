<template>
  <SheetFrame v-model:show="show" :title="cropState ? '裁一下头像' : '我的资料'">
    <AvatarCropper
      v-if="cropState"
      :state="cropState"
      @cancel="cancelCrop"
      @done="finishCrop"
      @error="onCropError"
    />

    <template v-else>
      <p class="sheet-intro">昵称和头像只保存在这台设备，不会上传。完整备份会一起带上。</p>

      <div class="profile-preview">
        <button
          class="profile-preview-avatar"
          type="button"
          :disabled="busy"
          :aria-label="draftAvatar.type === 'image' ? '换一张照片头像' : '上传照片做头像'"
          @click="pickFile"
        >
          <ProfileAvatar :avatar="draftAvatar" :name="draftName" :size="80" />
          <span class="profile-preview-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 8h3l1.5-2h7L17 8h3v11H4z"></path>
              <circle cx="12" cy="13" r="3.2"></circle>
            </svg>
          </span>
        </button>
        <span class="profile-preview-name">{{ draftName.trim() || '小果' }}</span>
        <span class="profile-preview-hint">
          {{ draftAvatar.type === 'image' ? '点照片换一张，或挑个内置头像' : '点照片上传，或挑个内置头像' }}
        </span>
      </div>

      <label class="field">
        <span class="field-label">昵称</span>
        <input
          v-model="draftName"
          class="input"
          type="text"
          :maxlength="PROFILE_NAME_MAX"
          placeholder="怎么称呼你？"
        >
      </label>

      <div class="field">
        <span class="field-label">头像</span>
        <div class="profile-avatar-grid">
          <button
            class="profile-avatar-cell"
            :class="{ active: draftAvatar.type === 'initial' }"
            type="button"
            aria-label="用名字首字做头像"
            @click="chooseInitial"
          >
            <ProfileAvatar :avatar="{ type: 'initial' }" :name="draftName" :size="38" />
          </button>
          <button
            v-for="item in PROFILE_AVATARS"
            :key="item.id"
            class="profile-avatar-cell"
            :class="{ active: draftAvatar.type === 'preset' && draftAvatar.value === item.id }"
            type="button"
            :aria-label="`使用${item.label}头像`"
            @click="choosePreset(item.id)"
          >
            <ProfileAvatar :avatar="{ type: 'preset', value: item.id }" :size="38" />
          </button>
          <button
            class="profile-avatar-cell profile-avatar-upload"
            :class="{ active: draftAvatar.type === 'image' }"
            type="button"
            :disabled="busy"
            :aria-label="draftAvatar.type === 'image' ? '换一张照片头像' : '从相册上传头像'"
            @click="pickFile"
          >
            <ProfileAvatar
              v-if="draftAvatar.type === 'image'"
              :avatar="draftAvatar"
              :size="38"
            />
            <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 8h3l1.5-2h7L17 8h3v11H4z"></path>
              <circle cx="12" cy="13" r="3.2"></circle>
            </svg>
          </button>
        </div>
        <input
          ref="fileInput"
          class="profile-file-input"
          type="file"
          accept="image/*"
          @change="onFileChange"
        >
      </div>

      <div class="profile-actions">
        <button class="secondary-btn" type="button" :disabled="busy" @click="resetDraft">用默认资料</button>
        <button class="primary-btn" type="button" :disabled="busy" @click="save">保存</button>
      </div>
    </template>
  </SheetFrame>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { closeToast, showLoadingToast, showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import AvatarCropper from './AvatarCropper.vue';
import ProfileAvatar from './ProfileAvatar.vue';
import { useProfile } from '../composables/useProfile';
import {
  DEFAULT_PROFILE,
  PROFILE_AVATARS,
  PROFILE_NAME_MAX
} from '../utils/profile';
import { loadAvatarSource } from '../utils/avatarImage';
import { haptic } from '../utils/haptics';

const show = defineModel('show', { type: Boolean, default: false });
const { profile, saveProfile } = useProfile();

const draftName = ref('');
const draftAvatar = ref({ ...DEFAULT_PROFILE.avatar });
const cropState = ref(null);
const fileInput = ref(null);
const busy = ref(false);

function releaseCrop() {
  cropState.value?.close?.();
  cropState.value = null;
}

watch(show, (visible) => {
  if (!visible) {
    releaseCrop();
    return;
  }
  draftName.value = profile.value.name;
  draftAvatar.value = { ...profile.value.avatar };
});

function choosePreset(id) {
  draftAvatar.value = { type: 'preset', value: id };
  haptic('light');
}

function chooseInitial() {
  draftAvatar.value = { type: 'initial', value: '' };
  haptic('light');
}

function pickFile() {
  if (busy.value) return;
  fileInput.value?.click();
}

async function onFileChange(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  busy.value = true;
  showLoadingToast({ message: '果冻在看看这张图…', forbidClick: true, duration: 0 });
  try {
    const source = await loadAvatarSource(file);
    closeToast();
    releaseCrop();
    cropState.value = source;
  } catch (err) {
    closeToast();
    showToast(err?.message || '这张图没处理成，换一张试试');
  } finally {
    busy.value = false;
  }
}

function cancelCrop() {
  releaseCrop();
  haptic('light');
}

function finishCrop(dataUrl) {
  releaseCrop();
  draftAvatar.value = { type: 'image', value: dataUrl };
  showToast('头像准备好啦，记得保存');
}

function onCropError(err) {
  showToast(err?.message || '这张图没处理成，换一张试试');
}

function resetDraft() {
  draftName.value = '';
  draftAvatar.value = { ...DEFAULT_PROFILE.avatar };
  haptic('light');
}

async function save() {
  if (busy.value) return;
  busy.value = true;
  try {
    await saveProfile({ name: draftName.value, avatar: draftAvatar.value });
    haptic('success');
    showToast('资料存好啦');
    show.value = false;
  } catch (err) {
    console.error(err);
    showToast('资料没存上，再试一次吧');
  } finally {
    busy.value = false;
  }
}

onBeforeUnmount(releaseCrop);
</script>
