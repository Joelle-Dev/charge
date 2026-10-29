<template>
  <SheetFrame v-model:show="show" title="导入数据" max-height="92dvh">
    <p class="sheet-intro">
      支持完整备份（换机）和支出 CSV。导入前会先预览，确认后才会写入账本。
    </p>

    <label
      class="secondary-btn import-pick"
      :class="{ 'is-disabled': parsing || busy || exportingCurrent }"
    >
      {{ preview ? '重新选择文件' : '选择备份或 CSV 文件' }}
      <input
        ref="fileInput"
        class="import-file-input"
        type="file"
        :disabled="parsing || busy || exportingCurrent"
        @change="onFileChange"
      >
    </label>

    <p v-if="error" class="form-error import-error">{{ error }}</p>
    <p v-if="parsing" class="import-hint">正在解析文件，请稍候…</p>
    <p v-if="busy && progressText" class="import-hint">{{ progressText }}</p>

    <div v-if="preview" class="import-preview">
      <div class="import-file">
        <strong>{{ preview.fileName }}</strong>
        <span>{{ formatLabel }} · {{ formatSize(preview.size) }}</span>
      </div>

      <div class="import-stats">
        <span v-if="preview.format === 'backup'">
          <b>{{ preview.manifest.stages.length }}</b> 个阶段
        </span>
        <span v-if="preview.format === 'backup'">
          <b>{{ preview.manifest.categories?.length || 0 }}</b> 个分类
        </span>
        <span v-if="preview.format === 'backup'">
          <b>{{ preview.manifest.achievementUnlocked?.length || 0 }}</b> 个成就
        </span>
        <span>
          <b>{{ validCount }}</b> 笔支出
        </span>
        <span>
          <b>¥{{ formatMoney(validTotal) }}</b>
        </span>
        <span v-if="dateRange">{{ dateRange }}</span>
      </div>

      <div v-if="preview.errorCount" class="import-warnings">
        <strong>{{ preview.errorCount }} 条记录无法导入，将被忽略</strong>
        <ul>
          <li v-for="(item, index) in preview.errors.slice(0, 5)" :key="index">
            {{ typeof item === 'string' ? item : `第 ${item.line} 行：${item.message}` }}
          </li>
        </ul>
        <span v-if="preview.errorCount > 5">还有 {{ preview.errorCount - 5 }} 条…</span>
      </div>

      <template v-if="preview.format === 'backup'">
        <div v-if="existingData" class="field">
          <span class="field-label">导入方式</span>
          <div class="chip-wrap">
            <button
              class="chip"
              :class="{ selected: mode === 'replace' }"
              type="button"
              @click="mode = 'replace'"
            >
              覆盖恢复
            </button>
            <button
              class="chip"
              :class="{ selected: mode === 'merge' }"
              type="button"
              @click="mode = 'merge'"
            >
              合并导入
            </button>
          </div>
        </div>

        <p v-if="mode === 'replace'" class="import-danger-note">
          覆盖恢复会清空当前阶段、支出、分类和成就，且无法撤销。
        </p>
        <p v-else class="import-hint">
          保留现有数据，备份里的阶段会作为新阶段导入；同一份备份重复导入会产生重复数据。
        </p>

        <button
          v-if="existingData"
          class="text-btn import-export-current"
          type="button"
          :disabled="busy || exportingCurrent"
          @click="exportCurrentBackup"
        >
          {{ exportingCurrent ? '正在导出当前数据…' : '先导出当前数据' }}
        </button>

        <p v-if="!existingData" class="import-hint">
          新手机还没有数据，将直接恢复完整备份。
        </p>
      </template>

      <template v-else>
        <label class="field">
          <span class="field-label">导入到阶段</span>
          <select v-model="targetStageId" class="select">
            <option value="__new__">新建阶段</option>
            <option v-for="stage in stages" :key="stage.id" :value="stage.id">
              {{ stage.name }}{{ stage.archived ? '（已归档）' : '' }}
            </option>
          </select>
        </label>

        <label v-if="targetStageId === '__new__'" class="field">
          <span class="field-label">新阶段名称</span>
          <input v-model="newStageName" class="input" type="text" maxlength="24" placeholder="导入数据">
        </label>

        <div class="chip-wrap import-options">
          <button
            class="chip"
            :class="{ selected: skipDuplicates }"
            type="button"
            @click="skipDuplicates = !skipDuplicates"
          >
            跳过重复支出
          </button>
        </div>
      </template>
    </div>

    <div v-if="preview" class="form-actions">
      <button class="primary-btn" type="button" :disabled="!canImport || busy || exportingCurrent" @click="confirmImport">
        {{ busy ? '导入中…' : confirmText }}
      </button>
      <button class="secondary-btn" type="button" :disabled="busy" @click="reset">取消</button>
    </div>

    <p class="sheet-note">
      完整备份包含全部阶段、支出、分类和成就；CSV 只导入支出。文件只在本机解析，不会上传。
    </p>
  </SheetFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { closeToast, showConfirmDialog, showLoadingToast, showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import { useAchievements } from '../composables/useAchievements';
import { useLedger } from '../composables/useLedger';
import {
  clearParsedCsv,
  clearPendingBackup,
  exportBackupInWorker,
  importBackupFile,
  importParsedCsv,
  parseBackupFile,
  parseCsvFile,
  saveBlob
} from '../lib/dataClient';
import { BACKUP_MAX_SIZE, isBackupFile, isBackupManifest } from '../lib/backupFormat';
import { formatMoney } from '../utils/format';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';

const show = defineModel('show', { type: Boolean, default: false });
const emit = defineEmits(['imported', 'backupExported']);

const {
  stages,
  currentStage,
  ensureSearchIndex,
  reloadAfterImport
} = useLedger();
const { initAchievements, reloadAchievements } = useAchievements();

const fileInput = ref(null);
const preview = ref(null);
const error = ref('');
const busy = ref(false);
const parsing = ref(false);
const exportingCurrent = ref(false);
const progressText = ref('');
const mode = ref('replace');
const targetStageId = ref('__new__');
const newStageName = ref('导入数据');
const skipDuplicates = ref(true);
let parseToken = 0;

const MAX_CSV_SIZE = 50 * 1024 * 1024;

const existingData = computed(() => stages.value.length > 0);

const validCount = computed(() => {
  if (!preview.value) return 0;
  if (preview.value.format === 'backup') return preview.value.manifest.counts.expenses;
  return preview.value.summary.count;
});

const validTotal = computed(() => {
  if (!preview.value) return 0;
  if (preview.value.format === 'backup') return preview.value.manifest.stats?.total || 0;
  return preview.value.summary.total;
});

const dateRange = computed(() => {
  if (!preview.value) return '';
  if (preview.value.format === 'backup') {
    const min = preview.value.manifest.stats?.minDate;
    const max = preview.value.manifest.stats?.maxDate;
    if (!min || !max) return '';
    return min === max ? min : `${min} 至 ${max}`;
  }
  const { from, to } = preview.value.summary;
  if (!from) return '';
  return from === to ? from : `${from} 至 ${to}`;
});

const formatLabel = computed(() => (
  preview.value?.format === 'backup' ? '完整备份' : '支出 CSV'
));

const canImport = computed(() => {
  if (!preview.value) return false;
  if (preview.value.format === 'backup') {
    return preview.value.manifest.counts.expenses > 0 ||
      preview.value.manifest.stages.length > 0;
  }
  if (!preview.value.summary?.count) return false;
  if (targetStageId.value === '__new__' && !newStageName.value.trim()) return false;
  return true;
});

const confirmText = computed(() => {
  if (preview.value?.format === 'backup') {
    return mode.value === 'replace' ? '覆盖恢复' : '合并导入';
  }
  return `导入 ${validCount.value} 笔`;
});

function formatSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function phaseLabel(phase, elapsed) {
  const labels = {
    start: '正在准备整理…',
    clear: '正在清理旧索引…',
    read: '正在读取账本…',
    stats: '正在生成统计…',
    writeStats: '正在写入统计…',
    buildSearch: '正在建立搜索索引…',
    writeSearch: '正在写入搜索索引…',
    stages: '正在恢复阶段…'
  };
  const base = labels[phase] || '正在整理数据…';
  return elapsed ? `${base} ${Math.round(elapsed / 1000)}s` : base;
}

function reset() {
  parseToken += 1;
  preview.value = null;
  error.value = '';
  mode.value = 'replace';
  targetStageId.value = '__new__';
  newStageName.value = '导入数据';
  skipDuplicates.value = true;
  busy.value = false;
  parsing.value = false;
  exportingCurrent.value = false;
  progressText.value = '';
  clearParsedCsv();
  clearPendingBackup();
  if (fileInput.value) fileInput.value.value = '';
}

async function parseCsvPreview(file, token) {
  parsing.value = true;
  try {
    const summary = await parseCsvFile(file);
    if (token !== parseToken) return;
    if (!summary.count) {
      error.value = 'CSV 里没有可导入的支出';
      return;
    }

    if (currentStage.value) {
      targetStageId.value = currentStage.value.id;
      newStageName.value = currentStage.value.name;
    } else {
      targetStageId.value = '__new__';
      newStageName.value = summary.stageName || '导入数据';
    }
    skipDuplicates.value = true;
    preview.value = {
      format: 'csv',
      fileName: file.name,
      size: file.size,
      summary,
      errors: summary.errors || [],
      errorCount: summary.errorCount || 0
    };
  } catch (err) {
    if (token === parseToken) {
      console.error(err);
      error.value = err?.message || '解析 CSV 失败，请检查文件';
    }
  } finally {
    if (token === parseToken) parsing.value = false;
  }
}

async function parseBackupPreview(file, token) {
  if (file.size > BACKUP_MAX_SIZE) {
    error.value = '备份文件过大';
    return;
  }

  parsing.value = true;
  try {
    const result = await parseBackupFile(file);
    if (token !== parseToken) return;
    mode.value = 'replace';
    preview.value = {
      format: 'backup',
      fileName: file.name,
      size: file.size,
      manifest: result.manifest,
      errors: [],
      errorCount: 0
    };
  } catch (err) {
    if (token === parseToken) {
      console.error(err);
      error.value = err?.message || '解析完整备份失败';
    }
  } finally {
    if (token === parseToken) parsing.value = false;
  }
}

async function detectFileKind(file, extension) {
  if (isBackupFile(file.name)) return 'backup';

  let head = '';
  try {
    head = await file.slice(0, 8192).text();
  } catch (err) {
    return 'unknown';
  }

  const firstLine = head.split(/\r?\n/)[0]?.trim().replace(/^\uFEFF/, '');
  if (firstLine) {
    try {
      const parsed = JSON.parse(firstLine);
      if (isBackupManifest(parsed)) return 'backup';
    } catch (err) {
      // Not a backup manifest.
    }
  }

  if (extension === 'csv') return 'csv';
  if (head.includes('日期') && head.includes('金额')) return 'csv';
  if (extension === 'json') return 'json';
  return 'unknown';
}

async function onFileChange(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file || parsing.value || busy.value) return;

  const token = ++parseToken;
  error.value = '';
  preview.value = null;
  progressText.value = '';
  clearParsedCsv();
  clearPendingBackup();

  const extension = file.name.split('.').pop()?.toLowerCase();
  const kind = await detectFileKind(file, extension);
  if (token !== parseToken) return;

  if (kind === 'backup') {
    if (file.size > BACKUP_MAX_SIZE) {
      error.value = '备份文件过大';
      return;
    }
    await parseBackupPreview(file, token);
    return;
  }

  if (kind === 'csv') {
    if (file.size > MAX_CSV_SIZE) {
      error.value = '文件超过 50MB，请拆分后再导入';
      return;
    }
    await parseCsvPreview(file, token);
    return;
  }

  if (kind === 'json') {
    error.value = '完整备份请使用 .scbackup 文件';
    return;
  }

  error.value = '无法识别文件，请选择完整备份或 CSV 文件';
}

async function exportCurrentBackup() {
  if (exportingCurrent.value || busy.value) return;
  exportingCurrent.value = true;
  showLoadingToast({ message: '正在导出当前数据…', forbidClick: true, duration: 0 });
  try {
    await initAchievements().catch(() => {});
    const result = await exportBackupInWorker();
    closeToast();
    if (result.empty) {
      showToast('当前没有数据可以导出');
      return;
    }
    saveBlob(result.blob, result.filename);
    haptic('success');
    showToast('已导出当前数据');
    emit('backupExported');
  } catch (err) {
    closeToast();
    console.error(err);
    showToast('导出失败，请重试');
  } finally {
    exportingCurrent.value = false;
  }
}

async function importBackup() {
  if (mode.value === 'replace' && existingData.value) {
    try {
      await showConfirmDialog({
        title: '覆盖恢复',
        message: `将清空现有 ${stages.value.length} 个阶段和全部支出，然后恢复备份。建议先导出当前数据。`,
        confirmButtonText: '覆盖恢复',
        confirmButtonColor: DANGER_COLOR
      });
    } catch (err) {
      return false;
    }
  }

  progressText.value = '正在准备恢复…';
  await ensureSearchIndex();
  const result = await importBackupFile({ mode: mode.value }, {
    onProgress: (message) => {
      if (message.phase === 'validate') {
        progressText.value = `正在校验备份… ${message.written}/${message.total}`;
      } else if (message.phase === 'expenses') {
        progressText.value = `正在写入支出… ${message.written}/${message.total}`;
      } else if (message.phase === 'export') {
        return;
      } else {
        progressText.value = phaseLabel(message.phase, message.elapsed);
      }
    }
  });

  await reloadAfterImport();
  await reloadAchievements();
  haptic('success');
  showToast(
    mode.value === 'replace'
      ? `已恢复 ${result.stages} 个阶段、${result.imported} 笔支出`
      : `已合并 ${result.stages} 个阶段、${result.imported} 笔支出`
  );
  return true;
}

async function importCsv() {
  const summary = preview.value.summary;
  progressText.value = '正在准备导入…';
  await ensureSearchIndex();
  const result = await importParsedCsv({
    stageId: targetStageId.value === '__new__' ? null : targetStageId.value,
    stageName: newStageName.value,
    budget: summary.budget,
    categories: summary.categories,
    skipDuplicates: skipDuplicates.value
  }, {
    onProgress: (message) => {
      if (message.phase === 'dedup') {
        progressText.value = `正在检查重复支出… ${message.checked}/${message.total} 个月`;
      } else if (message.phase === 'write') {
        progressText.value = `正在写入支出… ${message.written}/${message.total} 笔`;
      } else {
        progressText.value = phaseLabel(message.phase, message.elapsed);
      }
    }
  });

  await reloadAfterImport();
  haptic('success');
  if (result.imported) {
    showToast(`已导入 ${result.imported} 笔${result.skipped ? `，跳过 ${result.skipped} 笔重复` : ''}`);
  } else {
    showToast(result.skipped ? `没有新支出，跳过 ${result.skipped} 笔重复` : '没有可导入的支出');
  }
}

async function confirmImport() {
  if (!preview.value || !canImport.value || busy.value) return;
  busy.value = true;
  error.value = '';

  try {
    let imported = true;
    if (preview.value.format === 'backup') {
      imported = await importBackup();
    } else {
      await importCsv();
    }
    if (!imported) {
      busy.value = false;
      return;
    }

    emit('imported');
    show.value = false;
    reset();
  } catch (err) {
    console.error(err);
    error.value = err?.message || '导入失败，请检查文件后重试';
  } finally {
    busy.value = false;
  }
}

watch(show, (visible) => {
  if (!visible) reset();
});
</script>
