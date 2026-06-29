<template>
    <div>
        <aside
            v-show="ai.isOpen"
            class="ai-panel"
            role="complementary"
            :aria-label="$t('aiPanelTitle')"
            :style="{ width: ai.settings.panelWidth + 'px' }"
        >
            <div
                class="ai-panel__resizer"
                :class="{ 'ai-panel__resizer--active': isResizing }"
                role="separator"
                aria-orientation="vertical"
                tabindex="0"
                :aria-label="$t('aiResizePanel')"
                @mousedown.prevent="startResize"
                @touchstart.prevent="startResize"
                @keydown="onResizerKeydown"
            ></div>
            <header class="ai-panel__header">
                <UIcon name="i-lucide-sparkles" />
                <span class="ai-panel__title">{{ $t("aiPanelTitle") }}</span>
                <span class="ai-panel__model" v-if="ai.isConfigured">{{ ai.activeModel }}</span>
                <div class="ml-auto flex items-center gap-1">
                    <UTooltip :text="$t('aiClearChat')" :delay-duration="300">
                        <UButton
                            icon="i-lucide-eraser"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            square
                            :disabled="ai.isStreaming || ai.messages.length === 0"
                            :aria-label="$t('aiClearChat')"
                            @click="ai.clearMessages()"
                        />
                    </UTooltip>
                    <UTooltip :text="$t('aiSettingsTitle')" :delay-duration="300">
                        <UButton
                            icon="i-lucide-settings"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            square
                            :aria-label="$t('aiSettingsTitle')"
                            @click="ai.openSettings()"
                        />
                    </UTooltip>
                    <UTooltip :text="$t('aiClosePanel')" :delay-duration="300">
                        <UButton
                            icon="i-lucide-x"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            square
                            :aria-label="$t('aiClosePanel')"
                            @click="ai.isOpen = false"
                        />
                    </UTooltip>
                </div>
            </header>

            <div class="ai-panel__body" ref="bodyRef">
                <div v-if="!ai.isConfigured" class="ai-panel__empty">
                    <UIcon name="i-lucide-key-round" class="size-8 opacity-60" />
                    <p class="text-sm">{{ $t("aiNeedsApiKey") }}</p>
                    <UButton :label="$t('aiOpenSettings')" size="sm" color="primary" @click="ai.openSettings()" />
                </div>

                <div v-else-if="ai.messages.length === 0" class="ai-panel__empty">
                    <UIcon name="i-lucide-message-circle-question" class="size-8 opacity-60" />
                    <p class="text-sm">{{ $t("aiEmptyHint") }}</p>
                    <div class="flex flex-col gap-1 w-full">
                        <button
                            v-for="(s, idx) in suggestions"
                            :key="idx"
                            class="ai-panel__suggestion"
                            type="button"
                            @click="sendSuggestion(s)"
                        >
                            {{ s }}
                        </button>
                    </div>
                </div>

                <div v-else class="ai-panel__messages">
                    <MessageBubble
                        v-for="m in displayMessages"
                        :key="m.id"
                        :message="m"
                        :tool-result-index="toolResultIndex"
                        @confirm-tool="onConfirmTool"
                        @reject-tool="onRejectTool"
                    />
                    <div v-if="ai.isStreaming && !hasLiveContent" class="ai-panel__thinking">
                        <UIcon name="i-lucide-loader-2" class="animate-spin" />
                        <span>{{ $t("aiThinking") }}</span>
                    </div>
                </div>
            </div>

            <div v-if="ai.lastError" class="ai-panel__error" role="alert">
                <UIcon name="i-lucide-triangle-alert" class="shrink-0 mt-0.5" />
                <span class="ai-panel__error-text">{{ ai.lastError }}</span>
                <div class="ai-panel__error-actions">
                    <UButton
                        v-if="
                            ai.lastErrorKind === 'auth' ||
                            ai.lastErrorKind === 'model_not_found' ||
                            ai.lastErrorKind === 'forbidden'
                        "
                        icon="i-lucide-settings"
                        size="xs"
                        variant="soft"
                        color="neutral"
                        :label="$t('aiSettingsTitle')"
                        @click="ai.openSettings()"
                    />
                    <UButton
                        v-if="canRetry"
                        icon="i-lucide-rotate-cw"
                        size="xs"
                        variant="soft"
                        color="primary"
                        :label="$t('aiRetry')"
                        :disabled="ai.isStreaming"
                        @click="retryLast"
                    />
                    <UButton
                        icon="i-lucide-x"
                        size="xs"
                        variant="ghost"
                        color="neutral"
                        square
                        :aria-label="$t('aiDismissError')"
                        @click="ai.clearError()"
                    />
                </div>
            </div>

            <footer class="ai-panel__footer">
                <UTextarea
                    v-model="draft"
                    :rows="2"
                    :placeholder="$t('aiInputPlaceholder')"
                    :disabled="ai.isStreaming"
                    class="flex-1"
                    autoresize
                    :ui="{ base: 'resize-none' }"
                    @keydown="onKeydown"
                />
                <UButton
                    v-if="!ai.isStreaming"
                    icon="i-lucide-send-horizontal"
                    color="primary"
                    size="sm"
                    :disabled="!draft.trim() || !ai.isConfigured"
                    :aria-label="$t('aiSend')"
                    @click="onSend"
                />
                <UButton
                    v-else
                    icon="i-lucide-circle-stop"
                    color="neutral"
                    variant="soft"
                    size="sm"
                    :aria-label="$t('aiCancel')"
                    @click="chat.cancel()"
                />
            </footer>
        </aside>

        <SettingsDialog />
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useAiStore } from "@/stores/ai";
import { useAiChat } from "@/composables/useAiChat";
import { i18n } from "@/js/localization";
import MessageBubble from "./MessageBubble.vue";
import SettingsDialog from "./SettingsDialog.vue";

const ai = useAiStore();
const chat = useAiChat();

const $t = (k) => i18n.getMessage(k);

const draft = ref("");
const bodyRef = ref(null);

const displayMessages = computed(() =>
    ai.messages.filter((m) => {
        if (m.role === "user" && m.content.every((c) => c.type === "tool_result")) {
            return false;
        }
        return true;
    }),
);

const toolResultIndex = computed(() => {
    const idx = {};
    for (const m of ai.messages) {
        if (m.role === "user") {
            for (const c of m.content) {
                if (c.type === "tool_result") {
                    idx[c.tool_use_id] = c;
                }
            }
        }
    }
    return idx;
});

const hasLiveContent = computed(() => {
    const last = ai.messages[ai.messages.length - 1];
    if (!last || last.role !== "assistant") return false;
    return Array.isArray(last.content) && last.content.length > 0;
});

const suggestions = [
    "What's connected to my FC right now?",
    "Explain my current PID values in plain English.",
    "I'm getting jitter on hover — where do I start?",
    "What does the 'iterm_relax' CLI setting do?",
];

async function onSend() {
    if (!draft.value.trim() || ai.isStreaming) return;
    const text = draft.value;
    draft.value = "";
    await chat.sendUserMessage(text);
    scrollToBottom();
}

async function sendSuggestion(text) {
    if (ai.isStreaming) return;
    await chat.sendUserMessage(text);
    scrollToBottom();
}

async function onConfirmTool(_toolUseId) {
    await chat.confirmPendingTool();
    scrollToBottom();
}

async function onRejectTool(_toolUseId) {
    await chat.rejectPendingTool();
    scrollToBottom();
}

const canRetry = computed(() => {
    if (ai.isStreaming) return false;
    if (!ai.lastErrorRetryable && ai.lastErrorKind !== "auth" && ai.lastErrorKind !== "model_not_found") {
        // Always allow retry if the user has at least one previous user message,
        // but emphasise it visually only when the error is marked retryable.
        return ai.messages.some((m) => m.role === "user");
    }
    return ai.messages.some((m) => m.role === "user");
});

async function retryLast() {
    const text = ai.retryLastMessage();
    if (!text) return;
    await chat.sendUserMessage(text);
    scrollToBottom();
}

function onKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSend();
    }
}

function scrollToBottom() {
    nextTick(() => {
        if (bodyRef.value) {
            bodyRef.value.scrollTop = bodyRef.value.scrollHeight;
        }
    });
}

watch(() => ai.messages.length, scrollToBottom);

const isResizing = ref(false);

function startResize(_event) {
    isResizing.value = true;
    const onMove = (e) => {
        const x = e.touches?.[0]?.clientX ?? e.clientX;
        if (typeof x !== "number") return;
        ai.setPanelWidth(window.innerWidth - x);
    };
    const onUp = () => {
        isResizing.value = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
}

function onResizerKeydown(event) {
    const step = event.shiftKey ? 40 : 10;
    if (event.key === "ArrowLeft") {
        event.preventDefault();
        ai.setPanelWidth(ai.settings.panelWidth + step);
    } else if (event.key === "ArrowRight") {
        event.preventDefault();
        ai.setPanelWidth(ai.settings.panelWidth - step);
    }
}

onBeforeUnmount(() => {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
});
</script>

<style scoped>
.ai-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 480px;
    max-width: 100vw;
    background-color: var(--ui-bg, #0f172a);
    color: var(--ui-text, #f3f4f6);
    border-left: 1px solid var(--ui-border, #334155);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.25);
}

.ai-panel__resizer {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    width: 8px;
    cursor: ew-resize;
    z-index: 1;
    background: transparent;
    transition: background-color 0.15s;
    touch-action: none;
}

.ai-panel__resizer:hover,
.ai-panel__resizer:focus-visible,
.ai-panel__resizer--active {
    background-color: var(--ui-primary, #3b82f6);
    outline: none;
}

.ai-panel__header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--ui-border, #334155);
    background-color: var(--ui-bg-elevated, #111827);
}

.ai-panel__title {
    font-weight: 600;
    font-size: 0.875rem;
}

.ai-panel__model {
    font-size: 0.75rem;
    color: var(--ui-text-muted, #9ca3af);
    font-family: monospace;
}

.ai-panel__body {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
}

.ai-panel__messages {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.ai-panel__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
    padding: 2rem 1rem;
    color: var(--ui-text-muted, #9ca3af);
}

.ai-panel__suggestion {
    text-align: left;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--ui-border, #334155);
    border-radius: 0.375rem;
    background-color: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.8125rem;
    transition: background-color 0.15s;
}

.ai-panel__suggestion:hover {
    background-color: var(--ui-bg-elevated, #1f2937);
}

.ai-panel__thinking {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    font-size: 0.8125rem;
    color: var(--ui-text-muted, #9ca3af);
}

.ai-panel__error {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background-color: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: 0.8125rem;
    border-top: 1px solid rgba(239, 68, 68, 0.3);
}

.ai-panel__error-text {
    flex: 1;
    line-height: 1.35;
    user-select: text;
    -webkit-user-select: text;
}

.ai-panel__error-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
}

.ai-panel__footer {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-top: 1px solid var(--ui-border, #334155);
    background-color: var(--ui-bg-elevated, #111827);
}

@media (max-width: 600px) {
    .ai-panel {
        width: 100vw;
    }
}
</style>
