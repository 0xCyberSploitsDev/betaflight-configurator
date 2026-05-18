<template>
    <UModal v-model:open="open" :title="$t('aiSettingsTitle')" :ui="{ overlay: 'z-3000', content: 'max-w-xl z-3001' }">
        <template #body>
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold">{{ $t("aiProvider") }}</label>
                    <USelect :items="providerOptions" v-model="form.provider" size="sm" :ui="{ content: 'z-[3100]' }" />
                </div>

                <div v-if="form.provider === 'anthropic'" class="flex flex-col gap-2">
                    <label class="text-sm font-semibold">{{ $t("aiAnthropicApiKey") }}</label>
                    <UInput
                        v-model="form.anthropicApiKey"
                        type="password"
                        size="sm"
                        placeholder="sk-ant-..."
                        autocomplete="off"
                    />
                    <label class="text-sm font-semibold mt-2">{{ $t("aiModel") }}</label>
                    <UInput v-model="form.anthropicModel" size="sm" placeholder="claude-sonnet-4-6" />
                    <div class="ai-model-hint">
                        <span>{{ $t("aiModelHintRecommended") }}:</span>
                        <button
                            v-for="m in anthropicRecommended"
                            :key="m"
                            type="button"
                            class="ai-model-hint__chip"
                            @click="form.anthropicModel = m"
                        >
                            {{ m }}
                        </button>
                    </div>
                </div>

                <div v-if="form.provider === 'openai'" class="flex flex-col gap-2">
                    <label class="text-sm font-semibold">{{ $t("aiOpenaiApiKey") }}</label>
                    <UInput
                        v-model="form.openaiApiKey"
                        type="password"
                        size="sm"
                        placeholder="sk-..."
                        autocomplete="off"
                    />
                    <label class="text-sm font-semibold mt-2">{{ $t("aiModel") }}</label>
                    <UInput v-model="form.openaiModel" size="sm" placeholder="gpt-5" />
                    <div class="ai-model-hint">
                        <span>{{ $t("aiModelHintRecommended") }}:</span>
                        <button
                            v-for="m in openaiRecommended"
                            :key="m"
                            type="button"
                            class="ai-model-hint__chip"
                            @click="form.openaiModel = m"
                        >
                            {{ m }}
                        </button>
                    </div>
                </div>

                <UiBox type="warning">
                    <span class="text-xs">{{ $t("aiKeyStorageWarning") }}</span>
                </UiBox>

                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold">{{ $t("aiSystemPromptOverride") }}</label>
                    <UTextarea
                        v-model="form.systemPromptOverride"
                        :rows="4"
                        size="sm"
                        :placeholder="$t('aiSystemPromptDefault')"
                    />
                </div>
            </div>
        </template>
        <template #footer>
            <div class="flex justify-end gap-2 w-full">
                <UButton :label="$t('cancel')" variant="ghost" @click="cancel" />
                <UButton :label="$t('save')" color="primary" @click="save" />
            </div>
        </template>
    </UModal>
</template>

<script setup>
import { reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAiStore } from "@/stores/ai";
import { i18n } from "@/js/localization";
import UiBox from "@/components/elements/UiBox.vue";

const ai = useAiStore();
const { settings, settingsDialogOpen } = storeToRefs(ai);

const $t = (k) => i18n.getMessage(k);

const form = reactive({ ...settings.value });
const open = ref(settingsDialogOpen.value);

watch(settingsDialogOpen, (v) => {
    open.value = v;
    if (v) {
        Object.assign(form, settings.value);
    }
});

watch(open, (v) => {
    if (!v) {
        ai.closeSettings();
    }
});

const providerOptions = [
    { label: "Anthropic Claude", value: "anthropic" },
    { label: "OpenAI", value: "openai" },
];

const anthropicRecommended = ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"];

const openaiRecommended = ["gpt-5", "gpt-5-mini", "o4-mini"];

function save() {
    ai.saveSettings({ ...form });
    ai.closeSettings();
}

function cancel() {
    ai.closeSettings();
}
</script>

<style scoped>
.ai-model-hint {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.7rem;
    color: var(--ui-text-muted, #9ca3af);
}

.ai-model-hint__chip {
    font-family: monospace;
    font-size: 0.7rem;
    padding: 0.05rem 0.375rem;
    border: 1px solid var(--ui-border, #334155);
    border-radius: 0.25rem;
    background: transparent;
    color: inherit;
    cursor: pointer;
}

.ai-model-hint__chip:hover {
    background-color: var(--ui-bg-elevated, #1f2937);
    color: var(--ui-text, #f3f4f6);
}
</style>
