<template>
  <span
    class="profile-avatar"
    :class="{ 'is-image': avatar?.type === 'image', 'is-preset': avatar?.type === 'preset' && !!src, 'is-initial': !src }"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.42)}px` }"
  >
    <img v-if="src" :src="src" alt="" draggable="false" />
    <span v-else class="profile-avatar-initial" aria-hidden="true">{{ initial }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { profileAvatarSource } from '../utils/profileAvatarSources';
import { profileDisplayName } from '../utils/profile';

const props = defineProps({
  avatar: { type: Object, default: () => ({ type: 'initial', value: '' }) },
  name: { type: String, default: '' },
  size: { type: Number, default: 44 }
});

const src = computed(() => profileAvatarSource(props.avatar));
const initial = computed(() => profileDisplayName({ name: props.name }).slice(0, 1));
</script>
