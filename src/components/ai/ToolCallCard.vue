<template>
    <div :class="['ai-tool', isError ? 'ai-tool--error' : '', requiresConfirmation ? 'ai-tool--pending' : '']">
        <button class="ai-tool__header" type="button" @click="expanded = !expanded">
            <UIcon :name="iconName" class="shrink-0" />
            <span class="ai-tool__name">{{ name }}</span>
            <span v-if="pending" class="ai-tool__status">…</span>
            <span v-else-if="requiresConfirmation" class="ai-tool__status ai-tool__status--pending">pending</span>
            <span v-else-if="isError" class="ai-tool__status ai-tool__status--error">error</span>
            <span v-else class="ai-tool__status">done</span>
            <UIcon :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="ml-auto shrink-0" />
        </button>
        <div v-if="expanded" class="ai-tool__body">
            <div v-if="input" class="ai-tool__section">
                <div class="ai-tool__label">input</div>
                <pre class="ai-tool__pre">{{ inputPretty }}</pre>
            </div>
            <div v-if="requiresConfirmation && confirmationDescription" class="ai-tool__section">
                <div class="ai-tool__label">proposed change</div>
                <div class="ai-tool__desc">{{ confirmationDescription }}</div>
            </div>
            <div v-if="!pending && !requiresConfirmation" class="ai-tool__section">
                <div class="ai-tool__label">result</div>
                <pre class="ai-tool__pre">{{ resultPretty }}</pre>
            </div>
        </div>
        <div v-if="requiresConfirmation" class="ai-tool__actions">
            <button class="ai-tool__btn ai-tool__btn--confirm" type="button" @click="$emit('confirm')">
                <UIcon name="i-lucide-check" />
                Accept
            </button>
            <button class="ai-tool__btn ai-tool__btn--reject" type="button" @click="$emit('reject')">
                <UIcon name="i-lucide-x" />
                Reject
            </button>
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
    requiresConfirmation: { type: Boolean, default: false },
    confirmationDescription: { type: String, default: "" },
});

defineEmits(["confirm", "reject"]);

const expanded = ref(false);

const iconName = computed(() => {
    if (props.pending) return "i-lucide-loader-2";
    if (props.requiresConfirmation) return "i-lucide-shield-alert";
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

.ai-tool--pending {
    border-color: #f59e0b;
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

.ai-tool__status--pending {
    color: #f59e0b;
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

.ai-tool__desc {
    padding: 0.375rem;
    background-color: var(--ui-bg-muted, #0b1220);
    border-radius: 0.25rem;
    font-size: 0.8125rem;
    color: #f59e0b;
    user-select: text;
    -webkit-user-select: text;
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

.ai-tool__actions {
    display: flex;
    gap: 0.375rem;
    padding: 0 0.5rem 0.5rem;
    border-top: 1px solid var(--ui-border, #374151);
}

.ai-tool__btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s;
}

.ai-tool__btn--confirm {
    background-color: #166534;
    color: #bbf7d0;
    border-color: #22c55e;
}

.ai-tool__btn--confirm:hover {
    background-color: #15803d;
}

.ai-tool__btn--reject {
    background-color: #7f1d1d;
    color: #fecaca;
    border-color: #ef4444;
}

.ai-tool__btn--reject:hover {
    background-color: #991b1b;
}
</style>
