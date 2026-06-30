import { onMounted, onUnmounted, nextTick, watch } from "vue";
import { highlightState, clearHighlight } from "@/js/ai/navigationBus";

const FLASH_CLASS = "ai-highlight-flash";
const FLASH_DURATION_MS = 2600;

/**
 * Wires a tab component to the AI navigation bus so the assistant can scroll
 * to and flash a specific field via the `navigate_to_setting` tool.
 *
 * Usage in a tab's <script setup>:
 *   useAiSettingHighlight("pid_tuning", {
 *       onSubTab: (subTab) => { activeSubtab.value = subTab; },
 *   });
 *
 * The matching field must carry a `data-ai-field="<fieldKey>"` attribute.
 *
 * @param {string} tabName - VueTabComponents key this component renders.
 * @param {{ onSubTab?: (subTab: string) => void, root?: () => (HTMLElement|null) }} [options]
 */
export function useAiSettingHighlight(tabName, options = {}) {
    const { onSubTab, root } = options;
    let flashTimer = null;

    function findField(fieldKey) {
        const scope = (root?.() ?? document) || document;
        return scope.querySelector(`[data-ai-field="${CSS.escape(fieldKey)}"]`);
    }

    function flash(el) {
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove(FLASH_CLASS);
        // Force reflow so re-adding the class restarts the animation.
        void el.offsetWidth;
        el.classList.add(FLASH_CLASS);
        if (flashTimer) clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
            el.classList.remove(FLASH_CLASS);
            flashTimer = null;
        }, FLASH_DURATION_MS);
    }

    async function handle(request) {
        if (!request || request.tab !== tabName) return;

        // Switch sub-tab first if requested, then wait for the DOM to render it.
        if (request.subTab && typeof onSubTab === "function") {
            onSubTab(request.subTab);
        }

        clearHighlight();

        if (!request.fieldKey) return;

        await nextTick();
        // The sub-tab content may mount a frame later; retry a few times.
        let attempts = 0;
        const tryFlash = () => {
            const el = findField(request.fieldKey);
            if (el) {
                flash(el);
            } else if (attempts < 10) {
                attempts += 1;
                setTimeout(tryFlash, 60);
            }
        };
        tryFlash();
    }

    const stop = watch(
        () => highlightState.request,
        (request) => {
            if (request) handle(request);
        },
    );

    onMounted(() => {
        // Honor a request that arrived during the tab switch, before mount.
        if (highlightState.request) {
            handle(highlightState.request);
        }
    });

    onUnmounted(() => {
        stop();
        if (flashTimer) clearTimeout(flashTimer);
    });
}
