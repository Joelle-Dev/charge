<template>
  <SheetFrame v-model:show="show" title="选个分类">
    <p class="sheet-intro">给这一笔挑个分类，选好就回去。</p>

    <div class="category-picker-grid" role="listbox" aria-label="选择分类">
      <button
        v-for="category in options"
        :key="category"
        class="record-category-cell"
        :class="{ selected: category === selected }"
        :style="{ '--swatch': categoryColor(category) }"
        type="button"
        role="option"
        :aria-selected="category === selected"
        @click="pick(category)"
      >
        <span class="record-category-icon"><CategoryIcon :name="iconFor(category)" /></span>
        <span class="record-category-label">{{ category }}</span>
      </button>

      <button
        class="record-category-cell record-category-create"
        type="button"
        aria-label="管理分类"
        @click="showManager = true"
      >
        <span class="record-category-create-plus" aria-hidden="true">＋</span>
      </button>
    </div>

    <CategorySheet v-model:show="showManager" />
  </SheetFrame>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import SheetFrame from './SheetFrame.vue';
import CategoryIcon from './CategoryIcon.vue';
import CategorySheet from './CategorySheet.vue';
import { useLedger } from '../composables/useLedger';
import { categoryColor } from '../utils/format';

const props = defineProps({
  categories: { type: Array, default: () => [] },
  selected: { type: String, default: '' }
});
const emit = defineEmits(['select']);
const show = defineModel('show', { type: Boolean, default: false });
const showManager = ref(false);
const { iconFor } = useLedger();

const options = computed(() => (
  props.selected && !props.categories.includes(props.selected)
    ? [props.selected, ...props.categories]
    : props.categories
));

watch(show, (visible) => {
  if (!visible) showManager.value = false;
});

function pick(category) {
  emit('select', category);
  show.value = false;
}
</script>
