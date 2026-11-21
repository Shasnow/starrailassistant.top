<script setup lang="ts">
interface CategoryOption {
  id: string;
  label: string;
  count: number;
}

const props = defineProps<{
  options: CategoryOption[];
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function select(id: string): void {
  if (id !== props.modelValue) emit("update:modelValue", id);
}
</script>

<template>
  <div class="chips-row" role="group" aria-label="按流派筛选">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      class="chip"
      :aria-pressed="option.id === modelValue"
      :disabled="option.count === 0 && option.id !== modelValue"
      @click="select(option.id)"
    >
      {{ option.label }}<b>{{ option.count }}</b>
    </button>
  </div>
</template>
