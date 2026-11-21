<script setup lang="ts">
defineProps<{
  name:
    | "heart"
    | "bookmark"
    | "download"
    | "info"
    | "trash"
    | "share"
    | "chevron"
    | "copy"
    | "close"
    | "user"
    | "clock"
    | "upload"
    | "alert"
    | "empty";
}>();
</script>

<template>
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <template v-if="name === 'heart'">
      <path d="M12 20.5s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.6a4.5 4.5 0 0 1 7.5 2.9c0 5.4-7.5 10-7.5 10Z" />
    </template>
    <template v-else-if="name === 'bookmark'">
      <path d="M6 4h12v17l-6-4-6 4V4Z" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" />
    </template>
    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5h.01" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" />
    </template>
    <template v-else-if="name === 'share'">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2" />
    </template>
    <template v-else-if="name === 'chevron'">
      <path d="m6 9 6 6 6-6" />
    </template>
    <template v-else-if="name === 'copy'">
      <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m6 6 12 12M18 6 6 18" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </template>
    <template v-else-if="name === 'upload'">
      <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </template>
    <template v-else-if="name === 'alert'">
      <path d="M12 4 3 20h18L12 4Z" /><path d="M12 9v5" /><path d="M12 17h.01" />
    </template>
    <template v-else>
      <path d="M4 8 12 4l8 4v8l-8 4-8-4V8Z" /><path d="m4 8 8 4 8-4" /><path d="M12 12v8" />
    </template>
  </svg>
</template>
