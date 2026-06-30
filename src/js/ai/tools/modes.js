import FC from "@/js/fc";
import MSP from "@/js/msp";
import MSPCodes from "@/js/msp/MSPCodes";
import CONFIGURATOR from "@/js/data_storage";
import { serial } from "@/js/serial";
import { mspHelper } from "@/js/msp/MSPHelper";

const CHANNEL_MIN = 900;
const CHANNEL_MAX = 2100;
const STEP = 25;

function isLive() {
    return Boolean(serial?.connected) && !CONFIGURATOR?.virtualMode;
}

function notConnected() {
    return { error: "No flight controller is connected (or running in virtual mode). Connect an FC first." };
}

async function loadModes() {
    // BOXNAMES + BOXIDS give the available modes and their permanent ids;
    // MODE_RANGES (+ EXTRA) give the current AUX assignments. MSP_RC tells us
    // how many AUX channels exist.
    await MSP.promise(MSPCodes.MSP_BOXNAMES);
    await MSP.promise(MSPCodes.MSP_BOXIDS);
    await MSP.promise(MSPCodes.MSP_MODE_RANGES);
    await MSP.promise(MSPCodes.MSP_MODE_RANGES_EXTRA);
    await MSP.promise(MSPCodes.MSP_RC);
}

/** Map a mode name (e.g. "ARM", "ANGLE") to its permanent box id. Case-insensitive. */
function resolveModeId(name) {
    const aux = FC.AUX_CONFIG ?? [];
    const ids = FC.AUX_CONFIG_IDS ?? [];
    const q = String(name ?? "")
        .trim()
        .toUpperCase();
    if (!q) return null;
    for (let i = 0; i < aux.length; i++) {
        if (String(aux[i]).trim().toUpperCase() === q) {
            return { id: ids[i], name: aux[i], index: i };
        }
    }
    return null;
}

function auxChannelLabel(auxChannelIndex) {
    // Mode ranges index AUX channels (AUX1 == auxChannelIndex 0).
    return `AUX${auxChannelIndex + 1}`;
}

function clampToStep(us) {
    const v = Math.round(us / STEP) * STEP;
    return Math.min(CHANNEL_MAX, Math.max(CHANNEL_MIN, v));
}

// ── get_modes ────────────────────────────────────────────────────────────────
export const getModesTool = {
    name: "get_modes",
    description: `List the flight controller's flight modes (ARM, ANGLE, HORIZON, BEEPER, etc.), which ones are currently assigned to an AUX channel range, and which AUX channels are available. Read this BEFORE assigning a mode so you know the exact mode name and current state. Reads live from the FC.`,
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
        if (!isLive()) return notConnected();
        try {
            await loadModes();
        } catch (e) {
            return { error: `Failed to read modes from FC: ${e?.message ?? String(e)}` };
        }

        const aux = FC.AUX_CONFIG ?? [];
        const ids = FC.AUX_CONFIG_IDS ?? [];
        const ranges = FC.MODE_RANGES ?? [];

        // Group active assignments by mode id.
        const assignmentsByModeId = new Map();
        ranges.forEach((r) => {
            if (!r || r.range.start >= r.range.end) return; // empty slot
            const list = assignmentsByModeId.get(r.id) ?? [];
            list.push({
                channel: auxChannelLabel(r.auxChannelIndex),
                auxChannelIndex: r.auxChannelIndex,
                rangeStart: r.range.start,
                rangeEnd: r.range.end,
            });
            assignmentsByModeId.set(r.id, list);
        });

        const modes = aux.map((name, i) => ({
            name,
            id: ids[i],
            assigned: assignmentsByModeId.has(ids[i]),
            assignments: assignmentsByModeId.get(ids[i]) ?? [],
        }));

        const auxChannelCount = Math.max(0, (FC.RC?.active_channels ?? 0) - 4); // first 4 are AETR
        return {
            success: true,
            modes,
            totalModeRangeSlots: ranges.length,
            usedModeRangeSlots: ranges.filter((r) => r && r.range.start < r.range.end).length,
            auxChannelsAvailable: auxChannelCount > 0 ? auxChannelCount : undefined,
            _hint: "To assign a mode, call set_mode_range with the exact mode name, an AUX channel (1-based), and a microsecond range (typically 1700-2100 for an ON switch position).",
        };
    },
};

// ── set_mode_range ───────────────────────────────────────────────────────────
export const setModeRangeTool = {
    name: "set_mode_range",
    description: `Assign a flight mode (e.g. ARM, ANGLE, BEEPER) to an AUX channel range, so the mode activates when that channel's value is within the range. This is how you set up an arm switch, a flight-mode switch, a beeper switch, etc.

Find the exact mode name first with get_modes. The range is in microseconds (1000-2000 typical, 900-2100 max, multiples of 25). A common "switch ON in high position" range is 1700-2100.

Requires user confirmation. After it is applied, the change is saved to EEPROM automatically (mode ranges are persisted as a group).`,
    parameters: {
        type: "object",
        properties: {
            mode: {
                type: "string",
                description: 'Exact mode name from get_modes, e.g. "ARM", "ANGLE", "BEEPER".',
            },
            auxChannel: {
                type: "number",
                description: "AUX channel number, 1-based (1 = AUX1). AUX1 is the first switch channel after AETR.",
            },
            rangeStart: {
                type: "number",
                description: "Range start in microseconds (900-2100, multiple of 25). Default 1700.",
            },
            rangeEnd: {
                type: "number",
                description: "Range end in microseconds (900-2100, multiple of 25). Default 2100.",
            },
        },
        required: ["mode", "auxChannel"],
    },
    async execute({ mode, auxChannel, rangeStart = 1700, rangeEnd = 2100 }) {
        if (!isLive()) return notConnected();

        try {
            await loadModes();
        } catch (e) {
            return { error: `Failed to read modes from FC: ${e?.message ?? String(e)}` };
        }

        const resolved = resolveModeId(mode);
        if (!resolved) {
            const names = (FC.AUX_CONFIG ?? []).join(", ");
            return { error: `Unknown mode "${mode}". Available modes: ${names}` };
        }

        if (!Number.isInteger(auxChannel) || auxChannel < 1) {
            return { error: "auxChannel must be a 1-based integer (1 = AUX1)." };
        }
        const auxChannelIndex = auxChannel - 1;

        const start = clampToStep(rangeStart);
        const end = clampToStep(rangeEnd);
        if (start >= end) {
            return { error: `rangeStart (${start}) must be less than rangeEnd (${end}).` };
        }

        // Find a free MODE_RANGES slot (id 0 / empty range) to occupy.
        const ranges = FC.MODE_RANGES ?? [];
        const freeSlot = ranges.findIndex((r) => r.id === 0 && r.range.start >= r.range.end);
        if (freeSlot === -1) {
            return {
                error: "No free mode-range slot available on this FC. Remove an existing mode assignment first (via the Modes tab or CLI `aux`).",
            };
        }

        return {
            _requiresConfirmation: true,
            description: `Assign mode ${resolved.name} to ${auxChannelLabel(auxChannelIndex)} when the channel is between ${start} and ${end} µs`,
            proposedInput: {
                mode: resolved.name,
                auxChannel,
                rangeStart: start,
                rangeEnd: end,
            },
        };
    },
};

export async function confirmSetModeRange({ mode, auxChannel, rangeStart = 1700, rangeEnd = 2100 }) {
    if (!isLive()) return notConnected();

    try {
        await loadModes();
    } catch (e) {
        return { error: `Failed to read modes from FC: ${e?.message ?? String(e)}` };
    }

    const resolved = resolveModeId(mode);
    if (!resolved) {
        return { error: `Unknown mode "${mode}".` };
    }

    const auxChannelIndex = auxChannel - 1;
    const start = clampToStep(rangeStart);
    const end = clampToStep(rangeEnd);

    const ranges = FC.MODE_RANGES;
    const extra = FC.MODE_RANGES_EXTRA;
    const freeSlot = ranges.findIndex((r) => r.id === 0 && r.range.start >= r.range.end);
    if (freeSlot === -1) {
        return { error: "No free mode-range slot available on this FC." };
    }

    ranges[freeSlot] = {
        id: resolved.id,
        auxChannelIndex,
        range: { start, end },
    };
    if (extra[freeSlot]) {
        extra[freeSlot] = { id: resolved.id, modeLogic: 0, linkedTo: 0 };
    }

    // sendModeRanges writes the whole MODE_RANGES array, then persist to EEPROM.
    await new Promise((resolve) => mspHelper.sendModeRanges(resolve));
    await MSP.promise(MSPCodes.MSP_EEPROM_WRITE);

    return {
        success: true,
        message: `Mode ${resolved.name} assigned to ${auxChannelLabel(auxChannelIndex)} (${start}-${end} µs) and saved to EEPROM.`,
    };
}
