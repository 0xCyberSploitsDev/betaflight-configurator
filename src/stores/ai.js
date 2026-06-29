import { defineStore } from "pinia";
import { computed, ref } from "vue";

const STORAGE_KEY = "betaflight.ai.settings.v1";

const DEFAULT_SETTINGS = {
    provider: "anthropic",
    anthropicApiKey: "",
    anthropicModel: "claude-sonnet-4-6",
    openaiApiKey: "",
    openaiModel: "gpt-5",
    openaiCompatibleApiKey: "",
    openaiCompatibleModel: "qwen2.5-coder:7b",
    openaiCompatibleBaseUrl: "http://localhost:11434",
    systemPromptOverride: "",
    panelWidth: 480,
};

const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH_RATIO = 0.8;

function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULT_SETTINGS };
        }
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function persistSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn("[AI] Failed to persist settings", e);
    }
}

export const useAiStore = defineStore("ai", () => {
    const settings = ref(loadSettings());
    const messages = ref([]);
    const isOpen = ref(false);
    const isStreaming = ref(false);
    const lastError = ref(null);
    const lastErrorKind = ref(null);
    const lastErrorRetryable = ref(false);
    const settingsDialogOpen = ref(false);

    // Pending tool confirmation: null or { toolName, toolUseId, input, description }
    const pendingConfirmation = ref(null);

    const isConfigured = computed(() => {
        if (settings.value.provider === "anthropic") {
            return Boolean(settings.value.anthropicApiKey);
        }
        if (settings.value.provider === "openai") {
            return Boolean(settings.value.openaiApiKey);
        }
        if (settings.value.provider === "openai-compatible") {
            return Boolean(settings.value.openaiCompatibleBaseUrl);
        }
        return false;
    });

    const activeModel = computed(() => {
        if (settings.value.provider === "anthropic") return settings.value.anthropicModel;
        if (settings.value.provider === "openai") return settings.value.openaiModel;
        if (settings.value.provider === "openai-compatible") return settings.value.openaiCompatibleModel;
        return "";
    });

    const activeApiKey = computed(() => {
        if (settings.value.provider === "anthropic") return settings.value.anthropicApiKey;
        if (settings.value.provider === "openai") return settings.value.openaiApiKey;
        if (settings.value.provider === "openai-compatible") return settings.value.openaiCompatibleApiKey;
        return "";
    });

    function saveSettings(next) {
        settings.value = { ...settings.value, ...next };
        persistSettings(settings.value);
    }

    function setPanelWidth(width) {
        const viewportMax =
            typeof window !== "undefined" ? Math.floor(window.innerWidth * PANEL_MAX_WIDTH_RATIO) : 1200;
        const clamped = Math.max(PANEL_MIN_WIDTH, Math.min(viewportMax, Math.round(width)));
        if (clamped === settings.value.panelWidth) return;
        settings.value = { ...settings.value, panelWidth: clamped };
        persistSettings(settings.value);
    }

    function appendMessage(message) {
        messages.value.push(message);
    }

    function replaceLastMessage(message) {
        if (messages.value.length === 0) {
            messages.value.push(message);
            return;
        }
        messages.value[messages.value.length - 1] = message;
    }

    function clearMessages() {
        messages.value = [];
        clearError();
    }

    function clearError() {
        lastError.value = null;
        lastErrorKind.value = null;
        lastErrorRetryable.value = false;
    }

    function retryLastMessage() {
        const lastUserMessage = [...messages.value].reverse().find((m) => {
            return m.role === "user" && m.content.some((c) => c.type === "text");
        });
        if (!lastUserMessage) return null;
        const text = lastUserMessage.content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n");

        // Drop any messages after the last user text turn so the retry sees a clean tail.
        const idx = messages.value.indexOf(lastUserMessage);
        messages.value = messages.value.slice(0, idx);
        clearError();
        return text;
    }

    function togglePanel() {
        isOpen.value = !isOpen.value;
    }

    function openSettings() {
        settingsDialogOpen.value = true;
    }

    function closeSettings() {
        settingsDialogOpen.value = false;
    }

    function setPendingConfirmation(pc) {
        pendingConfirmation.value = pc;
    }

    function clearPendingConfirmation() {
        pendingConfirmation.value = null;
    }

    return {
        settings,
        messages,
        isOpen,
        isStreaming,
        lastError,
        lastErrorKind,
        lastErrorRetryable,
        settingsDialogOpen,
        pendingConfirmation,
        isConfigured,
        activeModel,
        activeApiKey,
        saveSettings,
        setPanelWidth,
        appendMessage,
        replaceLastMessage,
        clearMessages,
        clearError,
        retryLastMessage,
        togglePanel,
        openSettings,
        closeSettings,
        setPendingConfirmation,
        clearPendingConfirmation,
    };
});
