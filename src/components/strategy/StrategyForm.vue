<script setup lang="ts">
import type { StrategyDraft } from "@/components/strategy/draft";

interface Field {
  key: keyof StrategyDraft;
  label: string;
  kind: "text" | "number" | "textarea";
  rows?: number;
  placeholder?: string;
  /** 该字段在编辑模式下也不可修改 */
  locked?: boolean;
}

const { readonly = false } = defineProps<{ readonly?: boolean }>();

const draft = defineModel<StrategyDraft>({ required: true });

const fields: Field[] = [
  { key: "title", label: "标题", kind: "text" },
  { key: "description", label: "描述", kind: "textarea", rows: 4 },
  { key: "author", label: "作者", kind: "text", locked: true },
  { key: "uploader", label: "上传者", kind: "text" },
  { key: "share_code", label: "分享码", kind: "text", placeholder: "游戏内分享码（可选）" },
  { key: "min_coins", label: "最低金币", kind: "number" },
  { key: "min_level", label: "最低等级", kind: "number" },
  { key: "mid_level", label: "中期等级", kind: "number" },
  { key: "on_field", label: "前台角色", kind: "textarea", rows: 6 },
  { key: "off_field", label: "后台角色", kind: "textarea", rows: 6 },
];
</script>

<template>
  <div class="strategy-form">
    <label v-for="field in fields" :key="field.key" class="form-row">
      <span class="form-label">{{ field.label }}</span>
      <textarea
        v-if="field.kind === 'textarea'"
        v-model="draft[field.key]"
        class="strategy-input"
        :class="{ 'is-readonly': readonly }"
        :rows="field.rows"
        :readonly="readonly"
      ></textarea>
      <input
        v-else-if="field.kind === 'number'"
        v-model.number="draft[field.key]"
        class="strategy-input"
        :class="{ 'is-readonly': readonly }"
        type="number"
        min="0"
        :readonly="readonly"
      />
      <input
        v-else
        v-model="draft[field.key]"
        class="strategy-input"
        :class="{ 'is-readonly': readonly }"
        type="text"
        :placeholder="field.placeholder"
        :readonly="readonly || field.locked"
        :title="field.locked ? '作者字段不可修改' : undefined"
      />
    </label>
  </div>
</template>
