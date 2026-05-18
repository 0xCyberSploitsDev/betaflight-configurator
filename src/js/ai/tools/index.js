import { getFcStateTool } from "./getFcState.js";
import { fetchBetaflightDocsTool } from "./fetchBetaflightDocs.js";
import { listBetaflightDocsTool } from "./listBetaflightDocs.js";
import { getConnectionInfoTool } from "./getConnectionInfo.js";

export const ALL_TOOLS = [getConnectionInfoTool, getFcStateTool, listBetaflightDocsTool, fetchBetaflightDocsTool];

const TOOL_BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));

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
