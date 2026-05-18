<template>
    <div :class="['ai-bubble', isUser ? 'ai-bubble--user' : 'ai-bubble--assistant']">
        <div v-if="isUser && textContent" class="ai-bubble__text">{{ textContent }}</div>
        <div v-else-if="textContent" class="ai-bubble__md" v-html="renderedHtml"></div>
        <span v-if="!isUser && isStreaming" class="ai-bubble__cursor" aria-hidden="true"></span>
        <ToolCallCard
            v-for="call in toolCalls"
            :key="call.id"
            :name="call.name"
            :input="call.input"
            :result="call.result"
            :is-error="call.isError"
            :pending="call.pending"
        />
    </div>
</template>

<script setup>
import { computed } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import ToolCallCard from "./ToolCallCard.vue";

const props = defineProps({
    message: { type: Object, required: true },
    toolResultIndex: { type: Object, required: true },
});

const safeContent = computed(() => {
    const c = props.message?.content;
    return Array.isArray(c) ? c : [];
});

const isUser = computed(() => props.message?.role === "user");
const isStreaming = computed(() => Boolean(props.message?.streaming));

const textContent = computed(() => {
    return safeContent.value
        .filter((c) => c && c.type === "text" && typeof c.text === "string")
        .map((c) => c.text)
        .join("\n")
        .trim();
});

const renderedHtml = computed(() => {
    if (!textContent.value) return "";
    try {
        const html = marked.parse(textContent.value, { breaks: true, gfm: true });
        return DOMPurify.sanitize(html, { ADD_ATTR: ["target", "rel"] });
    } catch (e) {
        console.warn("[AI] Markdown render failed, falling back to plain text", e);
        // Escape to plain text so we never leak unrendered HTML into v-html.
        return textContent.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
});

const toolCalls = computed(() => {
    if (props.message?.role !== "assistant") return [];
    return safeContent.value
        .filter((c) => c && c.type === "tool_use" && typeof c.name === "string")
        .map((use) => {
            const result = props.toolResultIndex?.[use.id];
            return {
                id: use.id,
                name: use.name,
                input: use.input ?? null,
                result: result?.content,
                isError: Boolean(result?.is_error),
                pending: !result,
            };
        });
});
</script>

<style scoped>
.ai-bubble {
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    max-width: 100%;
    word-break: break-word;
    font-size: 0.875rem;
    line-height: 1.4;
    user-select: text;
    -webkit-user-select: text;
}

.ai-bubble * {
    user-select: text;
    -webkit-user-select: text;
}

.ai-bubble--user {
    align-self: flex-end;
    background-color: var(--ui-primary, #2563eb);
    color: white;
    max-width: 85%;
}

.ai-bubble--assistant {
    align-self: flex-start;
    background-color: var(--ui-bg-elevated, #1f2937);
    color: var(--ui-text, #f3f4f6);
    width: 100%;
}

.ai-bubble__text {
    white-space: pre-wrap;
}

.ai-bubble__cursor {
    display: inline-block;
    width: 0.5em;
    height: 1em;
    margin-left: 1px;
    vertical-align: text-bottom;
    background-color: currentColor;
    opacity: 0.7;
    animation: ai-bubble-cursor-blink 1s steps(2, start) infinite;
}

@keyframes ai-bubble-cursor-blink {
    to {
        opacity: 0;
    }
}

.ai-bubble__md :deep(p) {
    margin: 0 0 0.5rem 0;
}
.ai-bubble__md :deep(p:last-child) {
    margin-bottom: 0;
}
.ai-bubble__md :deep(ul) {
    margin: 0 0 0.5rem 0;
    padding-left: 1.25rem;
    list-style-type: disc;
    list-style-position: outside;
}
.ai-bubble__md :deep(ol) {
    margin: 0 0 0.5rem 0;
    padding-left: 1.5rem;
    list-style-type: decimal;
    list-style-position: outside;
}
.ai-bubble__md :deep(ul ul) {
    list-style-type: circle;
}
.ai-bubble__md :deep(ul ul ul) {
    list-style-type: square;
}
.ai-bubble__md :deep(li) {
    margin: 0.125rem 0;
    display: list-item;
}
.ai-bubble__md :deep(li > p) {
    margin: 0;
}
.ai-bubble__md :deep(b),
.ai-bubble__md :deep(strong) {
    font-weight: 800;
    color: var(--ui-text-highlighted, #ffffff);
}
.ai-bubble__md :deep(i),
.ai-bubble__md :deep(em) {
    font-style: italic;
}
.ai-bubble__md :deep(h1),
.ai-bubble__md :deep(h2),
.ai-bubble__md :deep(h3) {
    font-weight: 800;
    color: var(--ui-text-highlighted, #ffffff);
}
.ai-bubble__md :deep(code) {
    background-color: var(--ui-bg-muted, #0b1220);
    border-radius: 0.25rem;
    padding: 0.05rem 0.3rem;
    font-size: 0.8125rem;
    font-family: monospace;
}
.ai-bubble__md :deep(pre) {
    background-color: var(--ui-bg-muted, #0b1220);
    border-radius: 0.375rem;
    padding: 0.5rem 0.625rem;
    margin: 0.25rem 0 0.5rem;
    overflow-x: auto;
    font-size: 0.8125rem;
}
.ai-bubble__md :deep(pre code) {
    background: transparent;
    padding: 0;
    font-size: inherit;
}
.ai-bubble__md :deep(a) {
    color: var(--ui-primary, #3b82f6);
    text-decoration: underline;
}
.ai-bubble__md :deep(h1),
.ai-bubble__md :deep(h2),
.ai-bubble__md :deep(h3) {
    font-weight: 600;
    margin: 0.5rem 0 0.25rem;
    font-size: 0.9375rem;
}
.ai-bubble__md :deep(strong) {
    font-weight: 600;
}
.ai-bubble__md :deep(blockquote) {
    border-left: 3px solid var(--ui-border, #334155);
    margin: 0.25rem 0 0.5rem;
    padding: 0 0 0 0.625rem;
    color: var(--ui-text-muted, #9ca3af);
}
.ai-bubble__md :deep(hr) {
    border: 0;
    border-top: 1px solid var(--ui-border, #334155);
    margin: 0.5rem 0;
}
.ai-bubble__md :deep(table) {
    border-collapse: collapse;
    margin: 0.25rem 0 0.5rem;
    font-size: 0.8125rem;
}
.ai-bubble__md :deep(th),
.ai-bubble__md :deep(td) {
    border: 1px solid var(--ui-border, #334155);
    padding: 0.25rem 0.5rem;
}
</style>
