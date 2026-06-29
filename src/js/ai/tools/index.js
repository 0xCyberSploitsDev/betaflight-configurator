import { getFcStateTool } from "./getFcState.js";
import { fetchBetaflightDocsTool } from "./fetchBetaflightDocs.js";
import { listBetaflightDocsTool } from "./listBetaflightDocs.js";
import { getConnectionInfoTool } from "./getConnectionInfo.js";
import { setParameterTool, confirmSetParameter } from "./setParameter.js";
import { saveToEepromTool, confirmSaveToEeprom } from "./saveToEeprom.js";

export const ALL_TOOLS = [
    getConnectionInfoTool,
    getFcStateTool,
    listBetaflightDocsTool,
    fetchBetaflightDocsTool,
    setParameterTool,
    saveToEepromTool,
];

const TOOL_BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));

const CONFIRM_BY_NAME = {
    set_parameter: confirmSetParameter,
    save_to_eeprom: confirmSaveToEeprom,
};

export function toolDefinitions() {
    return ALL_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));
}

export async function executeTool(name, input) {
    const tool = TOOL_BY_NAME.get(name);
    if (!tool) {
        return { error: `Unknown tool "${name}". Available: ${ALL_TOOLS.map((t) => t.name).join(", ")}` };
    }
    const safeInput = input && typeof input === "object" ? input : {};
    try {
        const result = await tool.execute(safeInput);
        if (result === undefined) {
            return { error: `Tool "${name}" returned no result.` };
        }
        return result;
    } catch (e) {
        console.error(`[AI] Tool "${name}" threw`, e);
        return {
            error: `Tool "${name}" threw: ${e?.message ?? String(e)}`,
            ...(e?.stack ? { _stack: e.stack.split("\n").slice(0, 3).join("\n") } : {}),
        };
    }
}

export async function confirmTool(name, input) {
    const fn = CONFIRM_BY_NAME[name];
    if (!fn) {
        return { error: `No confirmation handler for tool "${name}"` };
    }
    try {
        const result = await fn(input);
        if (result === undefined) {
            return { error: `Tool "${name}" confirmation returned no result.` };
        }
        return result;
    } catch (e) {
        console.error(`[AI] Confirm tool "${name}" threw`, e);
        return {
            error: `Tool "${name}" execution failed: ${e?.message ?? String(e)}`,
            ...(e?.stack ? { _stack: e.stack.split("\n").slice(0, 3).join("\n") } : {}),
        };
    }
}
