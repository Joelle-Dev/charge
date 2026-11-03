<template>
  <SheetFrame v-model:show="show" title="钱钱分类">
    <p class="sheet-intro">分类用来汇总和听懂你的话。点名字可以改，自定义的名字也会被果冻记住。</p>

    <div class="category-manage">
      <span
        v-for="category in categories"
        :key="category"
        class="category-tag"
        :class="{ editing: editing === category }"
      >
        <button
          class="category-tag-label"
          type="button"
          :aria-label="category === DEFAULT_CATEGORY ? category : `修改分类 ${category}`"
          @click="startEdit(category)"
        >
          {{ category }}
        </button>
        <button
          v-if="category !== DEFAULT_CATEGORY"
          class="category-tag-remove"
          type="button"
          :aria-label="`删除分类 ${category}`"
          @click="removeCategory(category)"
        >
          ×
        </button>
      </span>
    </div>

    <div class="add-category">
      <input
        ref="inputRef"
        v-model="draft"
        class="input"
        type="text"
        maxlength="10"
        :placeholder="editing ? '给分类改个名字' : '新分类，比如：猫粮'"
        @keydown.enter.prevent="submit"
      >
      <button v-if="editing" class="secondary-btn" type="button" @click="cancelEdit">取消</button>
      <button class="secondary-btn" type="button" @click="submit">
        {{ editing ? '保存' : '添加' }}
      </button>
    </div>

    <p class="sheet-note">最多 40 个分类，「其他」是果冻的默认分类，不能改名或删掉。</p>
  </SheetFrame>
</template>

<script setup>
import { nextTick, ref } from 'vue';
import { closeToast, showConfirmDialog, showLoadingToast, showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import { useLedger } from '../composables/useLedger';
import { DEFAULT_CATEGORY } from '../lib/parser';
import { DANGER_COLOR } from '../utils/theme';
import { haptic } from '../utils/haptics';

const show = defineModel('show', { type: Boolean, default: false });
const { categories, setCategories, renameCategory, isCategoryUsed } = useLedger();

const draft = ref('');
const editing = ref('');
const inputRef = ref(null);

async function startEdit(category) {
  if (category === DEFAULT_CATEGORY) return;
  editing.value = category;
  draft.value = category;
  haptic('light');
  await nextTick();
  inputRef.value?.focus();
  inputRef.value?.select?.();
}

function cancelEdit() {
  editing.value = '';
  draft.value = '';
}

async function submit() {
  const name = draft.value.trim();
  if (!name) return;

  if (editing.value) {
    if (name === editing.value) {
      cancelEdit();
      return;
    }
    if (isCategoryUsed(editing.value)) {
      try {
        await showConfirmDialog({
          title: '给分类改名',
          message: `已经有支出用着「${editing.value}」啦，改名后这些记录会一起变，继续吗？`,
          confirmButtonText: '一起改吧'
        });
      } catch (err) {
        return;
      }
    }
    showLoadingToast({ message: '果冻在改分类…', forbidClick: true, duration: 0 });
    try {
      await renameCategory(editing.value, name);
      closeToast();
      haptic('success');
      showToast(`改好啦，现在叫「${name}」`);
      cancelEdit();
    } catch (err) {
      closeToast();
      showToast(err?.message || '改名失败啦，再试一次吧');
    }
    return;
  }

  if (categories.value.includes(name)) {
    showToast('这个分类已经有啦');
    return;
  }
  if (categories.value.length >= 40) {
    showToast('分类最多只能有 40 个哦');
    return;
  }
  await setCategories([...categories.value, name]);
  draft.value = '';
  haptic('light');
  showToast(`「${name}」加进来啦`);
}

async function removeCategory(category) {
  if (category === DEFAULT_CATEGORY) {
    showToast('「其他」是果冻的默认分类，不能删哦');
    return;
  }
  if (categories.value.length <= 1) {
    showToast('至少要给果冻留一个分类嘛');
    return;
  }
  if (isCategoryUsed(category)) {
    try {
      await showConfirmDialog({
        title: '删掉这个分类',
        message: `已经有支出用着「${category}」啦，删掉后旧记录还会保留这个名字，继续吗？`,
        confirmButtonText: '删掉吧',
        confirmButtonColor: DANGER_COLOR
      });
    } catch (err) {
      return;
    }
  }
  await setCategories(categories.value.filter((item) => item !== category));
  if (editing.value === category) cancelEdit();
  haptic('light');
  showToast(`「${category}」删掉啦`);
}
</script>
