<template>
  <SheetFrame v-model:show="show" title="账本与备份">
    <p class="sheet-intro">完整备份里装着全部阶段、花销、分类和爪印。文件只在这台设备里生成，不会上传。</p>

    <p class="backup-last">上次打包：{{ lastBackupText }}</p>

    <div class="sheet-footer">
      <button class="primary-btn" type="button" @click="exportBackup">
        把全部账本打包带走
      </button>
      <button class="secondary-btn" type="button" @click="emit('import')">
        导入 / 搬新家
      </button>
    </div>

    <div class="backup-badges">
      <span>只住在本机</span>
      <span>不上传云端</span>
    </div>
  </SheetFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { closeToast, showLoadingToast, showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import { useAchievements } from '../composables/useAchievements';
import { useLedger } from '../composables/useLedger';
import { getSetting } from '../lib/db';
import { exportBackupInWorker, saveBlob } from '../lib/dataClient';
import { haptic } from '../utils/haptics';

const show = defineModel('show', { type: Boolean, default: false });
const emit = defineEmits(['import']);

const { stages } = useLedger();
const { initAchievements } = useAchievements();
const lastBackupAt = ref(null);

const lastBackupText = computed(() => {
  if (!lastBackupAt.value) return '还没打包过';
  const date = new Date(Number(lastBackupAt.value));
  if (Number.isNaN(date.getTime())) return '还没打包过';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
});

async function loadMeta() {
  try {
    const stored = await getSetting('lastBackupAt', null);
    lastBackupAt.value = stored ? Number(stored) : null;
  } catch (err) {
    lastBackupAt.value = null;
  }
}

watch(show, (visible) => {
  if (visible) loadMeta();
});

async function exportBackup() {
  if (!stages.value.length) {
    showToast('果冻还没有账本可以打包');
    return;
  }

  showLoadingToast({ message: '果冻在打包全部账本…', forbidClick: true, duration: 0 });
  try {
    await initAchievements().catch(() => {});
    const result = await exportBackupInWorker();
    closeToast();
    if (result.empty) {
      showToast('果冻还没有账本可以打包');
      return;
    }
    saveBlob(result.blob, result.filename);
    lastBackupAt.value = Date.now();
    haptic('success');
    showToast('全部账本打包好啦');
  } catch (err) {
    closeToast();
    console.error(err);
    showToast('打包失败啦，再试一次吧');
  }
}
</script>
