<template>
  <SheetFrame v-model:show="show" title="我的资料">
    <p class="sheet-intro">昵称和头像只保存在这台设备，不会上传。完整备份会一起带上。</p>

    <div class="profile-preview">
      <ProfileAvatar :avatar="draftAvatar" :name="draftName" :size="76" />
      <span class="profile-preview-name">{{ draftName.trim() || '小果' }}</span>
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
          <ProfileAvatar :avatar="{ type: 'initial' }" :name="draftName" :size="34" />
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
          <ProfileAvatar :avatar="{ type: 'preset', value: item.id }" :size="40" />
        </button>
      </div>
      <div class="profile-upload-row">
        <button class="secondary-btn" type="button" :disabled="busy" @click="pickFile">
          {{ draftAvatar.type === 'image' ? '换一张照片' : '从相册上传' }}
        </button>
        <span v-if="draftAvatar.type === 'image'" class="profile-upload-hint">正在用照片头像</span>
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
  </SheetFrame>
</template>

<script setup>
import { ref, watch } from 'vue';
import { closeToast, showLoadingToast, showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import ProfileAvatar from './ProfileAvatar.vue';
import { useProfile } from '../composables/useProfile';
import {
  DEFAULT_PROFILE,
  PROFILE_AVATARS,
  PROFILE_NAME_MAX
} from '../utils/profile';
import { fileToAvatarDataUrl } from '../utils/avatarImage';
import { haptic } from '../utils/haptics';

const show = defineModel('show', { type: Boolean, default: false });
const { profile, saveProfile } = useProfile();

const draftName = ref('');
const draftAvatar = ref({ ...DEFAULT_PROFILE.avatar });
const fileInput = ref(null);
const busy = ref(false);

watch(show, (visible) => {
  if (!visible) return;
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
  showLoadingToast({ message: '果冻在裁头像…', forbidClick: true, duration: 0 });
  try {
    const dataUrl = await fileToAvatarDataUrl(file);
    draftAvatar.value = { type: 'image', value: dataUrl };
    closeToast();
    haptic('light');
    showToast('头像准备好啦，记得保存');
  } catch (err) {
    closeToast();
    showToast(err?.message || '这张图没处理成，换一张试试');
  } finally {
    busy.value = false;
  }
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
</script>
