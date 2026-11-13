<template>
  <SheetFrame v-model:show="show" title="钱钱分类" @opened="onOpened">
    <p class="sheet-intro">分类用来汇总和听懂你的话。可以换图标、拖动排序，点名字改，自定义的名字也会被果冻记住。</p>

    <div
      ref="listRef"
      class="category-manage"
      :class="{ 'is-dragging': draggingName }"
    >
      <div
        v-for="category in categories"
        :key="category"
        :ref="(el) => setRowRef(category, el)"
        :style="[rowStyle(category), { '--swatch': categoryColor(category) }]"
        class="category-row"
        :class="{
          editing: editing === category,
          'is-dragging': draggingName === category
        }"
      >
        <button
          class="category-row-icon"
          type="button"
          :aria-label="`给 ${category} 换图标`"
          @click="openIconPicker(category)"
        >
          <CategoryIcon :name="iconFor(category)" />
        </button>
        <button
          class="category-row-name"
          type="button"
          :aria-label="category === DEFAULT_CATEGORY ? category : `修改分类 ${category}`"
          @click="startEdit(category)"
        >
          {{ category }}
        </button>
        <div class="category-row-actions">
          <button
            v-if="category !== DEFAULT_CATEGORY"
            class="category-row-drag"
            type="button"
            :disabled="movableCategories.length < 2"
            :aria-label="`拖动排序 ${category}`"
            @pointerdown.prevent.stop="startDrag($event, category)"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="6" r="1.6"></circle>
              <circle cx="15" cy="6" r="1.6"></circle>
              <circle cx="9" cy="12" r="1.6"></circle>
              <circle cx="15" cy="12" r="1.6"></circle>
              <circle cx="9" cy="18" r="1.6"></circle>
              <circle cx="15" cy="18" r="1.6"></circle>
            </svg>
          </button>
          <button
            v-if="category !== DEFAULT_CATEGORY"
            class="category-row-btn is-danger"
            type="button"
            :aria-label="`删除分类 ${category}`"
            @click="removeCategory(category)"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <div v-if="iconTarget" class="icon-picker">
      <p class="icon-picker-title">给「{{ iconTarget }}」挑个图标</p>
      <div class="icon-picker-groups">
        <div v-for="group in ICON_GROUPS" :key="group.label" class="icon-picker-group">
          <p class="icon-picker-group-title">{{ group.label }}</p>
          <div class="icon-picker-grid">
            <button
              v-for="icon in group.icons"
              :key="icon"
              class="icon-picker-cell"
              :class="{ active: iconFor(iconTarget) === icon }"
              type="button"
              :aria-label="`图标 ${icon}`"
              @click="pickIcon(icon)"
            >
              <CategoryIcon :name="icon" />
            </button>
          </div>
        </div>
      </div>
      <button class="text-btn" type="button" @click="pickIcon('')">用默认的样子</button>
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
import { computed, nextTick, onUnmounted, ref } from 'vue';
import { closeToast, showConfirmDialog, showLoadingToast, showToast } from 'vant';
import SheetFrame from './SheetFrame.vue';
import CategoryIcon from './CategoryIcon.vue';
import { useLedger } from '../composables/useLedger';
import { DEFAULT_CATEGORY } from '../lib/parser';
import { ICON_GROUPS } from '../utils/categories';
import { categoryColor } from '../utils/format';
import { DANGER_COLOR } from '../utils/theme';
import { haptic } from '../utils/haptics';

const show = defineModel('show', { type: Boolean, default: false });
const props = defineProps({
  autoFocus: { type: Boolean, default: false }
});
const emit = defineEmits(['created']);
const {
  categories,
  setCategories,
  renameCategory,
  reorderCategories,
  isCategoryUsed,
  iconFor,
  setCategoryIcon
} = useLedger();

const draft = ref('');
const editing = ref('');
const iconTarget = ref('');
const inputRef = ref(null);
const listRef = ref(null);
const draggingName = ref('');
const dragOffset = ref(0);
const dropIndex = ref(0);

const AUTO_SCROLL_EDGE = 56;
const AUTO_SCROLL_MAX = 12;

const movableCategories = computed(() =>
  categories.value.filter((category) => category !== DEFAULT_CATEGORY)
);

const rowRefs = new Map();
let dragState = null;
let bodyEl = null;
let autoScrollFrame = 0;
let lastClientY = 0;

function setRowRef(name, el) {
  if (el) rowRefs.set(name, el);
  else rowRefs.delete(name);
}

function rowStyle(category) {
  if (!dragState) return undefined;

  if (category === draggingName.value) {
    return { transform: `translate3d(0, ${dragOffset.value}px, 0)` };
  }

  if (category === DEFAULT_CATEGORY) return undefined;

  const index = dragState.items.findIndex((item) => item.name === category);
  if (index < 0) return undefined;

  const { from, height, gap } = dragState;
  if (dropIndex.value > from && index > from && index <= dropIndex.value) {
    return { transform: `translate3d(0, ${-(height + gap)}px, 0)` };
  }
  if (dropIndex.value < from && index >= dropIndex.value && index < from) {
    return { transform: `translate3d(0, ${height + gap}px, 0)` };
  }
  return undefined;
}

function startDrag(event, category) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (movableCategories.value.length < 2) return;

  const list = listRef.value;
  const row = rowRefs.get(category);
  if (!list || !row) return;

  stopDrag();

  const from = movableCategories.value.indexOf(category);
  if (from < 0) return;

  bodyEl = list.closest('.sheet-body');
  const listRect = list.getBoundingClientRect();
  const items = movableCategories.value.map((name) => {
    const rect = (rowRefs.get(name) || row).getBoundingClientRect();
    return { name, top: rect.top - listRect.top, height: rect.height };
  });
  const gap = items.length > 1
    ? Math.max(0, items[1].top - items[0].top - items[0].height)
    : 0;
  const height = row.getBoundingClientRect().height;
  const defaultRow = rowRefs.get(DEFAULT_CATEGORY);
  const defaultRect = defaultRow?.getBoundingClientRect();
  const defaultTop = defaultRect ? defaultRect.top - listRect.top : items[items.length - 1].top;

  dragState = {
    items,
    from,
    height,
    gap,
    startTop: items[from].top,
    minTop: items[0].top,
    maxTop: defaultTop - gap - height,
    startClientY: event.clientY,
    startScrollTop: bodyEl?.scrollTop || 0,
    pointerId: event.pointerId
  };
  draggingName.value = category;
  dragOffset.value = 0;
  dropIndex.value = from;
  lastClientY = event.clientY;

  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragEnd);
  haptic('light');
  scheduleAutoScroll();
}

function onDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  lastClientY = event.clientY;
  updateDragPosition();
  if (event.cancelable) event.preventDefault();
}

function updateDragPosition() {
  if (!dragState) return;
  const list = listRef.value;
  if (!list) return;

  const scrollTop = bodyEl?.scrollTop || 0;
  const rawDelta = lastClientY - dragState.startClientY;
  const minDelta = dragState.minTop - dragState.startTop;
  const maxDelta = dragState.maxTop - dragState.startTop;
  const clampedDelta = Math.max(minDelta, Math.min(maxDelta, rawDelta));
  dragOffset.value = clampedDelta + (scrollTop - dragState.startScrollTop);

  const listRect = list.getBoundingClientRect();
  const contentY = lastClientY - listRect.top;
  let target = 0;
  for (let i = 0; i < dragState.items.length; i += 1) {
    if (i === dragState.from) continue;
    const item = dragState.items[i];
    if (contentY > item.top + item.height / 2) target += 1;
  }
  target = Math.max(0, Math.min(dragState.items.length - 1, target));

  if (target !== dropIndex.value) {
    dropIndex.value = target;
    haptic('light');
  }
}

function scheduleAutoScroll() {
  cancelAnimationFrame(autoScrollFrame);
  const step = () => {
    if (!dragState || !bodyEl) return;
    const rect = bodyEl.getBoundingClientRect();
    let speed = 0;

    if (lastClientY < rect.top + AUTO_SCROLL_EDGE) {
      const ratio = (rect.top + AUTO_SCROLL_EDGE - lastClientY) / AUTO_SCROLL_EDGE;
      speed = -AUTO_SCROLL_MAX * Math.min(1, ratio);
    } else if (lastClientY > rect.bottom - AUTO_SCROLL_EDGE) {
      const ratio = (lastClientY - (rect.bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE;
      speed = AUTO_SCROLL_MAX * Math.min(1, ratio);
    }

    if (speed !== 0) {
      const before = bodyEl.scrollTop;
      bodyEl.scrollTop = before + speed;
      if (bodyEl.scrollTop !== before) updateDragPosition();
    }
    autoScrollFrame = requestAnimationFrame(step);
  };
  autoScrollFrame = requestAnimationFrame(step);
}

async function onDragEnd(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { from } = dragState;
  const target = dropIndex.value;
  stopDrag();
  if (target === from) return;
  haptic('success');
  await reorderCategories(from, target);
}

function stopDrag() {
  cancelAnimationFrame(autoScrollFrame);
  autoScrollFrame = 0;
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragEnd);
  dragState = null;
  draggingName.value = '';
  dragOffset.value = 0;
  bodyEl = null;
}

onUnmounted(stopDrag);

function onOpened() {
  if (!props.autoFocus) return;
  editing.value = '';
  draft.value = '';
  iconTarget.value = '';
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select?.();
  });
}

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

const busy = ref(false);

function openIconPicker(category) {
  iconTarget.value = iconTarget.value === category ? '' : category;
  haptic('light');
}

async function pickIcon(icon) {
  const target = iconTarget.value;
  if (!target || busy.value) return;
  busy.value = true;
  try {
    await setCategoryIcon(target, icon);
    iconTarget.value = '';
    haptic('light');
    showToast(icon ? `「${target}」换上新图标啦` : `「${target}」用回默认样子`);
  } catch (err) {
    console.error('换图标失败', err);
    showToast('没换上，再试一次吧');
  } finally {
    busy.value = false;
  }
}

async function submit() {
  if (busy.value) return;
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
    busy.value = true;
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
    } finally {
      busy.value = false;
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
  busy.value = true;
  try {
    await setCategories([...categories.value, name]);
    draft.value = '';
    emit('created', name);
    haptic('light');
    showToast(`「${name}」加进来啦`);
  } catch (err) {
    console.error('添加分类失败', err);
    showToast('没加上，再试一次吧');
  } finally {
    busy.value = false;
  }
}

async function removeCategory(category) {
  if (busy.value) return;
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
  busy.value = true;
  try {
    await setCategories(categories.value.filter((item) => item !== category));
    await setCategoryIcon(category, '');
    if (editing.value === category) cancelEdit();
    if (iconTarget.value === category) iconTarget.value = '';
    haptic('light');
    showToast(`「${category}」删掉啦`);
  } catch (err) {
    console.error('删除分类失败', err);
    showToast('没删掉，再试一次吧');
  } finally {
    busy.value = false;
  }
}
</script>
