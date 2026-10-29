<template>
  <SheetFrame v-model:show="show" title="数据与备份">
    <p class="sheet-intro">完整备份包含全部阶段、支出、分类和成就。文件只在本机生成，不会上传。</p>

    <p class="backup-last">上次备份：{{ lastBackupText }}</p>

    <div class="sheet-footer">
      <button class="primary-btn" type="button" @click="exportBackup">
        导出完整备份
      </button>
      <button class="secondary-btn" type="button" @click="emit('import')">
        导入 / 换机
      </button>
    </div>

    <div class="backup-badges">
      <span>仅本机存储</span>
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
  if (!lastBackupAt.value) return '还没有备份';
  const date = new Date(Number(lastBackupAt.value));
  if (Number.isNaN(date.getTime())) return '还没有备份';
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
    haptic('success');
    showToast('已导出完整备份');
  } catch (err) {
    closeToast();
    console.error(err);
    showToast('导出失败，请重试');
  }
}
</script>
