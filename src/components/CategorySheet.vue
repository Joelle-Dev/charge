<template>
  <SheetFrame v-model:show="show" title="分类">
    <p class="sheet-intro">分类用于汇总和语音识别。点分类名称可以改名，自定义名称也会作为识别关键词。</p>

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
        :placeholder="editing ? '修改分类名称' : '新分类，比如：宠物'"
        @keydown.enter.prevent="submit"
      >
      <button v-if="editing" class="secondary-btn" type="button" @click="cancelEdit">取消</button>
      <button class="secondary-btn" type="button" @click="submit">
        {{ editing ? '保存' : '添加' }}
      </button>
    </div>

    <p class="sheet-note">最多 20 个分类，「其他」为默认分类，不能改名或删除。</p>
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
          title: '修改分类',
          message: `已有支出使用「${editing.value}」，改名后这些记录会一起更新。继续？`,
          confirmButtonText: '继续改名'
        });
      } catch (err) {
        return;
      }
    }
    showLoadingToast({ message: '正在更新分类…', forbidClick: true, duration: 0 });
    try {
      await renameCategory(editing.value, name);
      closeToast();
      haptic('success');
      showToast(`已改名为「${name}」`);
      cancelEdit();
    } catch (err) {
      closeToast();
      showToast(err?.message || '改名失败');
    }
    return;
  }

  if (categories.value.includes(name)) {
    showToast('这个分类已经有了');
    return;
  }
  if (categories.value.length >= 20) {
    showToast('分类最多 20 个');
    return;
  }
  await setCategories([...categories.value, name]);
  draft.value = '';
  haptic('light');
  showToast(`已添加「${name}」`);
}

async function removeCategory(category) {
  if (category === DEFAULT_CATEGORY) {
    showToast('「其他」是默认分类，不能删除');
    return;
  }
  if (categories.value.length <= 1) {
    showToast('至少保留一个分类');
    return;
  }
  if (isCategoryUsed(category)) {
    try {
      await showConfirmDialog({
        title: '删除分类',
        message: `已有支出使用「${category}」，删除分类后历史记录仍会保留这个名称。继续？`,
        confirmButtonText: '继续删除',
        confirmButtonColor: DANGER_COLOR
      });
    } catch (err) {
      return;
    }
  }
  await setCategories(categories.value.filter((item) => item !== category));
  if (editing.value === category) cancelEdit();
  haptic('light');
  showToast(`已删除「${category}」`);
}
</script>
