<template>
    <div :class="['ai-tool', isError ? 'ai-tool--error' : '']">
        <button class="ai-tool__header" type="button" @click="expanded = !expanded">
            <UIcon :name="iconName" class="shrink-0" />
            <span class="ai-tool__name">{{ name }}</span>
            <span v-if="pending" class="ai-tool__status">…</span>
            <span v-else-if="isError" class="ai-tool__status ai-tool__status--error">error</span>
            <span v-else class="ai-tool__status">done</span>
            <UIcon :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="ml-auto shrink-0" />
        </button>
        <div v-if="expanded" class="ai-tool__body">
            <div v-if="input" class="ai-tool__section">
                <div class="ai-tool__label">input</div>
                <pre class="ai-tool__pre">{{ inputPretty }}</pre>
            </div>
            <div v-if="!pending" class="ai-tool__section">
                <div class="ai-tool__label">result</div>
                <pre class="ai-tool__pre">{{ resultPretty }}</pre>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, ref } from "vue";

const props = defineProps({
    name: { type: String, required: true },
    input: { type: [Object, null], default: null },
    result: { type: [String, null], default: null },
    isError: { type: Boolean, default: false },
    pending: { type: Boolean, default: false },
});

const expanded = ref(false);

const iconName = computed(() => {
    if (props.pending) return "i-lucide-loader-2";
    if (props.isError) return "i-lucide-alert-triangle";
    return "i-lucide-wrench";
});

const inputPretty = computed(() => {
    if (!props.input) return "";
    try {
        return JSON.stringify(props.input, null, 2);
    } catch {
        return String(props.input);
    }
});

const resultPretty = computed(() => {
    if (props.result == null) return "";
    if (typeof props.result === "string") {
        try {
            return JSON.stringify(JSON.parse(props.result), null, 2);
        } catch {
            return props.result;
        }
    }
    try {
        return JSON.stringify(props.result, null, 2);
    } catch {
        return String(props.result);
    }
});
</script>

<style scoped>
.ai-tool {
    border: 1px solid var(--ui-border, #374151);
    border-radius: 0.375rem;
    background-color: var(--ui-bg, #111827);
    margin-top: 0.5rem;
    font-size: 0.8125rem;
}

.ai-tool--error {
    border-color: #ef4444;
}

.ai-tool__header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    padding: 0.375rem 0.5rem;
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    text-align: left;
}

.ai-tool__name {
    font-family: monospace;
    font-weight: 600;
}

.ai-tool__status {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ui-text-muted, #9ca3af);
}

.ai-tool__status--error {
    color: #ef4444;
}

.ai-tool__body {
    padding: 0 0.5rem 0.5rem;
    border-top: 1px solid var(--ui-border, #374151);
}

.ai-tool__section + .ai-tool__section {
    margin-top: 0.5rem;
}

.ai-tool__label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ui-text-muted, #9ca3af);
    margin: 0.375rem 0 0.125rem;
}

.ai-tool__pre {
    margin: 0;
    padding: 0.375rem;
    background-color: var(--ui-bg-muted, #0b1220);
    border-radius: 0.25rem;
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: monospace;
    font-size: 0.75rem;
    user-select: text;
    -webkit-user-select: text;
}
</style>
