import { resolveSetting, listSettings } from "../settingsRegistry.js";

const NAVIGABLE = listSettings();

export const navigateToSettingTool = {
    name: "navigate_to_setting",
    description: `The Configurator switches to the correct tab/sub-tab and highlights the target setting when you provide a setting identifier or name. You supply the identifier — the application handles all UI changes.

Works whether or not a flight controller is connected. Does NOT read or change any FC value — this is purely a navigation request that the application executes on your behalf.

When to use: the user asks to navigate, open a tab, go to a setting, or be shown where something lives. English examples: "navigate to filters", "go to PID tuning", "show me anti-gravity gain", "where is craft name", "open the receiver tab", "take me to rates". French examples: "navigue vers les filtres", "va sur la configuration", "montre-moi anti-gravity gain", "ouvre les rates", "où est craft name".

Pass a "setting" id from the list below. You can also pass a free-form name (e.g. "anti gravity gain", "filters", "rates") and it will be matched. Prefer the canonical id when you know it. If the target is vague, pick the closest entry and navigate anyway, then ask if that was the right place.

Navigable settings (id — label):
${NAVIGABLE.map((s) => `- ${s.id} — ${s.label}`).join("\n")}`,
    parameters: {
        type: "object",
        properties: {
            setting: {
                type: "string",
                description:
                    "The setting id (preferred) or a descriptive name of the setting/field to navigate to and highlight.",
            },
        },
        required: ["setting"],
    },
    async execute({ setting }) {
        const entry = resolveSetting(setting);
        if (!entry) {
            return {
                error: `Unknown setting "${setting}". Valid ids: ${NAVIGABLE.map((s) => s.id).join(", ")}`,
            };
        }

        // The composable (useAiChat) detects `_navigate` and performs the
        // tab switch + field highlight. Tools stay free of UI/DOM coupling.
        return {
            _navigate: true,
            tab: entry.tab,
            subTab: entry.subTab ?? null,
            fieldKey: entry.fieldKey ?? null,
            success: true,
            label: entry.label,
            message: `Opened ${entry.label} for the user.`,
        };
    },
};
