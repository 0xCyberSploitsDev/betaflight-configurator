import CONFIGURATOR from "@/js/data_storage";
import FC from "@/js/fc";
import { serial } from "@/js/serial";

// useMspCliSession pulls in serial_backend and the Vue tab graph; import it
// lazily inside the action functions so this tool module (and therefore the
// tools registry in index.js) stays free of that heavy, cyclic dependency
// graph at evaluation time.
async function cliSession() {
    return import("@/composables/useMspCliSession");
}

// Mirror of MIN_FC_VERSION_FOR_MSP_CLI from useMspCliSession; duplicated here so
// the tool description (built at module load) does not force the heavy import.
const MIN_FC_VERSION_FOR_MSP_CLI = "4.5.4";

// CLI commands whose first token only READS state — safe to run without
// confirmation because they never mutate the configuration. Anything not in
// this set is treated as a write and routed through the confirmation flow.
const READ_ONLY_COMMANDS = new Set([
    "get",
    "dump",
    "diff",
    "status",
    "version",
    "tasks",
    "help",
    "resource", // `resource` / `resource list` only list when given no assignment
    "serial", // `serial` with no args lists ports
    "feature", // `feature` with no args lists features
    "map", // `map` with no args prints the current map
    "mixer", // `mixer` with no args prints the current mixer
    "led", // `led` with no args lists led config
    "color", // `color` with no args lists colors
    "mode_color",
    "aux", // `aux` with no args lists modes
    "adjrange",
    "rxrange",
    "rxfail",
    "vtx",
    "vtxtable",
    "beeper",
    "battery_profile",
    "profile",
    "rateprofile",
    "smix",
]);

// Commands that reboot the FC (config persisted to / loaded from EEPROM) and
// therefore require a save-and-reconnect cycle rather than a plain send.
const REBOOTING_COMMANDS = new Set(["save", "defaults", "exit", "bl", "dfu"]);

// Commands that are destructive enough to call out explicitly in the
// confirmation prompt so the user understands the blast radius.
const DESTRUCTIVE_COMMANDS = new Set(["defaults", "bl", "dfu"]);

function firstToken(command) {
    return command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

/**
 * A read-only invocation is one whose verb is read-only AND that carries no
 * argument that turns it into a write (e.g. `resource MOTOR 1 A03` writes,
 * `resource` alone lists; `feature GPS` writes, `feature` alone lists).
 * `get <name>` is always read-only; `set` is never read-only.
 */
export function isReadOnly(command) {
    const trimmed = command.trim();
    if (!trimmed) return false;

    const verb = firstToken(trimmed);

    // `set name = value` mutates; `set` / `set name` (query) only reads.
    if (verb === "set") {
        return !trimmed.includes("=");
    }

    if (!READ_ONLY_COMMANDS.has(verb)) {
        return false;
    }

    // For verbs that both list (no args) and configure (with args), only the
    // bare form — or an explicit `list` subcommand — is treated as read-only.
    const hasArgs = trimmed.split(/\s+/).length > 1;
    if (!hasArgs) return true;

    const VERBS_THAT_WRITE_WITH_ARGS = new Set([
        "resource",
        "serial",
        "feature",
        "map",
        "mixer",
        "led",
        "color",
        "mode_color",
        "aux",
        "adjrange",
        "rxrange",
        "rxfail",
        "vtx",
        "vtxtable",
        "beeper",
        "battery_profile",
        "profile",
        "rateprofile",
        "smix",
    ]);
    if (VERBS_THAT_WRITE_WITH_ARGS.has(verb)) {
        // `<verb> list` is a read; everything else with args is a write.
        return trimmed.split(/\s+/)[1].toLowerCase() === "list";
    }

    // get/dump/diff/status/version/tasks/help with args stay read-only.
    return true;
}

async function preflight() {
    if (!serial?.connected || CONFIGURATOR?.virtualMode) {
        return { error: "No flight controller is connected (or running in virtual mode). Connect an FC first." };
    }
    const { isMspCliSupported } = await cliSession();
    if (!isMspCliSupported()) {
        return {
            error: `CLI access requires FC firmware >= ${MIN_FC_VERSION_FOR_MSP_CLI}. Current: ${
                FC.CONFIG?.flightControllerVersion || "unknown"
            }.`,
        };
    }
    return null;
}

async function runRead(command) {
    const { send } = await cliSession();
    const lines = await send(command);
    return {
        success: true,
        command,
        output: lines,
        _hint:
            lines.length === 0
                ? "The FC returned no output for this command. It may be unsupported on this firmware."
                : undefined,
    };
}

export const runCliCommandTool = {
    name: "run_cli_command",
    description: `Run ONE Betaflight CLI command on the connected flight controller and return its raw output. The CLI exposes ~all FC settings — far more than the MSP tools — including \`get\`/\`set\` for any parameter, \`diff\`/\`dump\`, \`resource\`, \`feature\`, \`serial\`, \`map\`, \`aux\`, etc.

Read-only commands (get, dump, diff, status, version, tasks, and bare listing commands like \`feature\`, \`resource\`, \`aux\`) run immediately and return their output.

Write commands (anything with \`set ... = ...\`, \`feature X\`, \`resource ...\`, etc.) require user confirmation before executing — the tool returns a confirmation prompt the user must Accept.

To persist changes, run \`save\` (this reboots the FC and reconnects automatically). \`defaults\` wipes the configuration and is flagged as destructive.

Workflow for changing a setting via CLI:
1. \`get <name>\` to read the current value.
2. \`set <name> = <value>\` (confirmed) to change it.
3. \`save\` (confirmed) to persist and reboot.

Pass exactly one command per call. Do not chain commands with newlines or semicolons. Requires FC firmware >= ${MIN_FC_VERSION_FOR_MSP_CLI}.`,
    parameters: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description:
                    'A single Betaflight CLI command, e.g. "get gyro_lpf1_static_hz", "set anti_gravity_gain = 80", "diff all", "feature", "save".',
            },
        },
        required: ["command"],
    },
    async execute({ command }) {
        const cmd = typeof command === "string" ? command.trim() : "";
        if (!cmd) {
            return { error: "command must be a non-empty string." };
        }
        if (/[\r\n]/.test(cmd) || cmd.includes(";")) {
            return { error: "Pass exactly ONE command — no newlines or ';' chaining." };
        }

        const pf = await preflight();
        if (pf) return pf;

        if (isReadOnly(cmd)) {
            return runRead(cmd);
        }

        const verb = firstToken(cmd);
        const destructive = DESTRUCTIVE_COMMANDS.has(verb);
        return {
            _requiresConfirmation: true,
            description: destructive
                ? `Run DESTRUCTIVE CLI command "${cmd}" on the flight controller`
                : `Run CLI command "${cmd}" on the flight controller`,
            proposedInput: { command: cmd },
        };
    },
};

export async function confirmRunCliCommand({ command }) {
    const cmd = typeof command === "string" ? command.trim() : "";
    if (!cmd) {
        return { error: "command must be a non-empty string." };
    }

    const pf = preflight();
    if (pf) return pf;

    const verb = firstToken(cmd);

    // save / defaults persist + reboot; reconnect after the FC restarts.
    if (REBOOTING_COMMANDS.has(verb)) {
        if (verb === "save") {
            const result = await saveAndReconnect();
            return {
                success: result.ok,
                command: cmd,
                message: result.ok
                    ? "save executed. FC is rebooting; the configurator will reconnect automatically."
                    : `save failed: ${result.error?.message ?? String(result.error)}`,
                ...(result.ok ? {} : { error: result.error?.message ?? String(result.error) }),
            };
        }

        // defaults / exit / bl / dfu: send the command, then reconnect.
        let cmdError = null;
        try {
            await send(cmd, { timeoutMs: 5000 });
        } catch (error) {
            cmdError = error;
        } finally {
            scheduleReconnect();
        }
        return {
            success: cmdError === null,
            command: cmd,
            message:
                cmdError === null
                    ? `"${cmd}" executed. FC is rebooting; the configurator will reconnect automatically.`
                    : `"${cmd}" failed: ${cmdError?.message ?? String(cmdError)}`,
            ...(cmdError === null ? {} : { error: cmdError?.message ?? String(cmdError) }),
        };
    }

    const lines = await send(cmd);
    const errors = lines.filter((l) => l.startsWith("###ERROR"));
    return {
        success: errors.length === 0,
        command: cmd,
        output: lines,
        ...(errors.length > 0 ? { error: errors.join("\n") } : {}),
        _hint:
            errors.length === 0
                ? "Change applied to the FC's running config. Run save_to_eeprom or `save` (via run_cli_command) to persist."
                : undefined,
    };
}
