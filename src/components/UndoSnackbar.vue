<template>
  <Teleport to="body">
    <Transition name="undo-fade">
      <div v-if="undoState.visible" class="undo-snackbar" role="status" aria-live="polite">
        <span class="undo-snackbar-text">{{ undoState.message }}</span>
        <button class="undo-snackbar-action" type="button" @click="runUndo">撤销</button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useUndo } from '../composables/useUndo';

const { undoState, runUndo } = useUndo();
</script>
