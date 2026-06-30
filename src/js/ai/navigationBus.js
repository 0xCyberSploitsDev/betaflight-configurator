import { reactive, readonly } from "vue";

/**
 * Reactive bridge that lets the AI assistant request the UI to highlight a
 * specific setting field after a tab switch.
 *
 * Flow:
 *   1. useAiChat intercepts a `_navigate` tool result and calls
 *      `requestHighlight({ tab, subTab, fieldKey })` after switching tabs.
 *   2. The target tab component (via `useAiSettingHighlight`) watches the
 *      `request` ref, selects the right sub-tab, scrolls the matching
 *      `[data-ai-field="<fieldKey>"]` element into view and flashes it.
 *
 * The `nonce` guarantees that repeated requests for the SAME field still
 * trigger the watcher (the payload object identity changes every time).
 */

const state = reactive({
    request: null, // { tab, subTab, fieldKey, nonce } | null
});

let nonce = 0;

/**
 * Ask the UI to highlight a setting. Safe to call from non-UI code.
 * @param {{ tab: string, subTab?: string|null, fieldKey?: string|null }} payload
 */
export function requestHighlight(payload) {
    if (!payload || !payload.tab) return;
    nonce += 1;
    state.request = {
        tab: payload.tab,
        subTab: payload.subTab ?? null,
        fieldKey: payload.fieldKey ?? null,
        nonce,
    };
}

/** Clear the pending request once a consumer has handled it. */
export function clearHighlight() {
    state.request = null;
}

/** Read-only reactive view of the current highlight request. */
export const highlightState = readonly(state);
