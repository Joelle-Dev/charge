<template>
  <SheetFrame v-model:show="show" title="导入数据" max-height="92dvh">
    <p class="sheet-intro">
      支持完整备份 JSON 和支出 CSV。导入前会先预览，确认后才会写入账本。
    </p>

    <input
      ref="fileInput"
      type="file"
      accept=".json,.csv,application/json,text/csv"
      hidden
      @change="onFileChange"
    >
    <button class="secondary-btn import-pick" type="button" @click="fileInput?.click()">
      {{ preview ? '重新选择文件' : '选择 JSON / CSV 文件' }}
    </button>

    <p v-if="error" class="form-error import-error">{{ error }}</p>

    <div v-if="preview" class="import-preview">
      <div class="import-file">
        <strong>{{ preview.fileName }}</strong>
        <span>{{ formatLabel }} · {{ formatSize(preview.size) }}</span>
      </div>

      <div class="import-stats">
        <span v-if="preview.format === 'json'">
          <b>{{ preview.normalized.stages.length }}</b> 个阶段
        </span>
        <span>
          <b>{{ validCount }}</b> 笔支出
        </span>
        <span>
          <b>¥{{ formatMoney(validTotal) }}</b>
        </span>
        <span v-if="dateRange">{{ dateRange }}</span>
      </div>

      <div v-if="preview.errors.length" class="import-warnings">
        <strong>{{ preview.errors.length }} 条记录无法导入，将被忽略</strong>
        <ul>
          <li v-for="(item, index) in preview.errors.slice(0, 5)" :key="index">
            {{ typeof item === 'string' ? item : `第 ${item.line} 行：${item.message}` }}
          </li>
        </ul>
        <span v-if="preview.errors.length > 5">还有 {{ preview.errors.length - 5 }} 条…</span>
      </div>

      <template v-if="preview.format === 'json'">
        <div class="field">
          <span class="field-label">导入方式</span>
          <div class="chip-wrap">
            <button
              class="chip"
              :class="{ selected: mode === 'merge' }"
              type="button"
              @click="mode = 'merge'"
            >
              合并到现有数据
            </button>
            <button
              class="chip"
              :class="{ selected: mode === 'replace' }"
              type="button"
              @click="mode = 'replace'"
            >
              覆盖恢复
            </button>
          </div>
        </div>
        <p v-if="mode === 'replace'" class="import-danger-note">
          覆盖恢复会清空当前全部阶段、支出和分类，且无法撤销。
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
      <button class="primary-btn" type="button" :disabled="!canImport || busy" @click="confirmImport">
        {{ busy ? '导入中…' : confirmText }}
      </button>
      <button class="secondary-btn" type="button" :disabled="busy" @click="reset">取消</button>
    </div>

    <p class="sheet-note">
      JSON 会恢复阶段、支出、分类和成就；CSV 只导入支出。文件只在本机解析，不会上传。
    </p>
  </SheetFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import { useAchievements } from '../composables/useAchievements';
import { useLedger } from '../composables/useLedger';
import { parseBackup, prepareBackupImport } from '../utils/backup';
import { parseStageCsv } from '../utils/csv';
import { formatMoney, toDateInput } from '../utils/format';
import { haptic } from '../utils/haptics';
import { DANGER_COLOR } from '../utils/theme';

const show = defineModel('show', { type: Boolean, default: false });
const emit = defineEmits(['imported']);

const {
  stages,
  categories,
  currentStage,
  importBackup,
  importCsv
} = useLedger();
const { unlockedIds, setUnlocked } = useAchievements();

const fileInput = ref(null);
const preview = ref(null);
const error = ref('');
const busy = ref(false);
const mode = ref('merge');
const targetStageId = ref('__new__');
const newStageName = ref('导入数据');
const skipDuplicates = ref(true);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const validCount = computed(() => {
  if (!preview.value) return 0;
  return preview.value.format === 'json'
    ? preview.value.normalized.expenses.length
    : preview.value.parsed.expenses.length;
});

const validTotal = computed(() => {
  if (!preview.value) return 0;
  const items = preview.value.format === 'json'
    ? preview.value.normalized.expenses
    : preview.value.parsed.expenses;
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
});

const dateRange = computed(() => {
  if (!preview.value) return '';
  const items = preview.value.format === 'json'
    ? preview.value.normalized.expenses
    : preview.value.parsed.expenses;
  if (!items.length) return '';
  const dates = items.map((item) => new Date(item.spentAt)).filter((date) => !Number.isNaN(date.getTime()));
  if (!dates.length) return '';
  const from = toDateInput(new Date(Math.min(...dates.map((date) => date.getTime()))));
  const to = toDateInput(new Date(Math.max(...dates.map((date) => date.getTime()))));
  return from === to ? from : `${from} 至 ${to}`;
});

const formatLabel = computed(() => (
  preview.value?.format === 'json' ? '完整备份 JSON' : '支出 CSV'
));

const canImport = computed(() => {
  if (!preview.value) return false;
  if (preview.value.format === 'json') {
    return preview.value.normalized.stages.length > 0 ||
      preview.value.normalized.expenses.length > 0;
  }
  if (!preview.value.parsed.expenses.length) return false;
  if (targetStageId.value === '__new__' && !newStageName.value.trim()) return false;
  return true;
});

const confirmText = computed(() => {
  if (preview.value?.format === 'json') {
    return mode.value === 'merge' ? '合并导入' : '覆盖恢复';
  }
  return `导入 ${validCount.value} 笔`;
});

function formatSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function reset() {
  preview.value = null;
  error.value = '';
  mode.value = 'merge';
  targetStageId.value = '__new__';
  newStageName.value = '导入数据';
  skipDuplicates.value = true;
  busy.value = false;
  if (fileInput.value) fileInput.value.value = '';
}

async function onFileChange(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  error.value = '';
  preview.value = null;

  if (file.size > MAX_FILE_SIZE) {
    error.value = '文件超过 50MB，请拆分后再导入';
    return;
  }

  let text = '';
  try {
    text = await file.text();
  } catch (err) {
    error.value = '读取文件失败，请重试';
    return;
  }
  const extension = file.name.split('.').pop()?.toLowerCase();
  const isJson = extension === 'json' || text.trim().startsWith('{');

  if (isJson) {
    const result = parseBackup(text);
    if (result.error) {
      error.value = result.error;
      return;
    }
    if (!result.data.stages.length && !result.data.expenses.length) {
      error.value = '备份里没有可导入的数据';
      return;
    }
    preview.value = {
      format: 'json',
      fileName: file.name,
      size: file.size,
      normalized: result.data,
      errors: result.errors || []
    };
    mode.value = 'merge';
    return;
  }

  const result = parseStageCsv(text);
  if (result.error) {
    error.value = result.error;
    return;
  }

  const matchedStage = result.stageName
    ? stages.value.find((stage) => stage.name === result.stageName)
    : null;
  targetStageId.value = matchedStage?.id || '__new__';
  newStageName.value = matchedStage?.name || result.stageName || '导入数据';
  skipDuplicates.value = true;
  preview.value = {
    format: 'csv',
    fileName: file.name,
    size: file.size,
    parsed: result,
    errors: result.errors
  };
}

async function confirmImport() {
  if (!preview.value || !canImport.value || busy.value) return;
  busy.value = true;
  error.value = '';

  try {
    if (preview.value.format === 'json') {
      const prepared = prepareBackupImport(preview.value.normalized, {
        mode: mode.value,
        existingStages: stages.value,
        existingCategories: categories.value,
        existingAchievements: unlockedIds.value,
        existingCurrentStageId: currentStage.value?.id || null
      });

      if (mode.value === 'replace') {
        try {
          await showConfirmDialog({
            title: '覆盖恢复',
            message: '将清空当前全部阶段、支出和分类，然后用备份恢复。确定继续？',
            confirmButtonText: '覆盖恢复',
            confirmButtonColor: DANGER_COLOR
          });
        } catch (err) {
          busy.value = false;
          return;
        }
      }

      await importBackup(prepared, mode.value);
      await setUnlocked(prepared.achievementUnlocked, mode.value);
      haptic('success');
      showToast(`已导入 ${prepared.counts.stages} 个阶段、${prepared.counts.expenses} 笔支出`);
    } else {
      const parsed = preview.value.parsed;
      const categoriesFromRows = [...new Set(parsed.expenses.map((item) => item.category))];
      const result = await importCsv({
        stageId: targetStageId.value === '__new__' ? null : targetStageId.value,
        stageName: newStageName.value,
        budget: parsed.budget,
        expenses: parsed.expenses,
        categories: categoriesFromRows,
        skipDuplicates: skipDuplicates.value
      });

      haptic('success');
      if (result.imported) {
        showToast(`已导入 ${result.imported} 笔${result.skipped ? `，跳过 ${result.skipped} 笔重复` : ''}`);
      } else {
        showToast(result.skipped ? `没有新支出，跳过 ${result.skipped} 笔重复` : '没有可导入的支出');
      }
    }

    emit('imported');
    show.value = false;
    reset();
  } catch (err) {
    console.error(err);
    error.value = '导入失败，请检查文件后重试';
  } finally {
    busy.value = false;
  }
}

watch(show, (visible) => {
  if (!visible) reset();
});
</script>
