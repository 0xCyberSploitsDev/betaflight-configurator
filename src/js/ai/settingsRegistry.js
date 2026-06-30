/**
 * Registry of UI settings the AI assistant can navigate the user to.
 *
 * This module is PURE DATA — it must not import Vue, Pinia, or touch the DOM,
 * so it can be safely imported by the AI tool layer (which is intentionally
 * decoupled from the UI). The chat composable consumes the resolved entry to
 * actually switch tabs and highlight fields.
 *
 * Each entry:
 *  - id:       canonical, stable identifier used by the model.
 *  - tab:      VueTabComponents key (see vue_tab_registry.js).
 *  - subTab:   optional sub-tab value within the tab (e.g. "pid"/"rates"/"filter").
 *  - fieldKey: optional value matching a `data-ai-field="..."` anchor in the DOM.
 *              When present, that field is scrolled into view and flashed.
 *  - label:    human-readable label shown to the user / returned to the model.
 *  - aliases:  alternative names/keywords the model might use; matched loosely.
 */

export const SETTING_REGISTRY = [
    // ── PID Tuning → PID sub-tab ──────────────────────────────────────────
    {
        id: "anti_gravity_gain",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "anti_gravity_gain",
        label: "Anti Gravity Gain",
        aliases: ["anti gravity", "antigravity", "anti_gravity", "ag gain", "antiGravityGain"],
    },
    {
        id: "throttle_boost",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "throttle_boost",
        label: "Throttle Boost",
        aliases: ["throttle boost", "throttleBoost"],
    },
    {
        id: "feedforward_boost",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "feedforward_boost",
        label: "Feedforward Boost",
        aliases: ["ff boost", "feedforward boost"],
    },
    {
        id: "feedforward_transition",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "feedforward_transition",
        label: "Feedforward Transition",
        aliases: ["ff transition", "feedforward transition"],
    },
    {
        id: "feedforward_smoothness",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "feedforward_smooth_factor",
        label: "Feedforward Smoothness",
        aliases: ["ff smoothness", "feedforward smooth", "smooth factor"],
    },
    {
        id: "feedforward_jitter",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "feedforward_jitter_factor",
        label: "Feedforward Jitter Reduction",
        aliases: ["ff jitter", "jitter factor", "jitter reduction"],
    },
    {
        id: "feedforward_averaging",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "feedforward_averaging",
        label: "Feedforward Averaging",
        aliases: ["ff averaging"],
    },
    {
        id: "feedforward_max_rate_limit",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "feedforward_max_rate_limit",
        label: "Feedforward Max Rate Limit",
        aliases: ["ff max rate", "max rate limit"],
    },
    {
        id: "d_max_gain",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "d_max_gain",
        label: "D-Max Gain",
        aliases: ["dmax gain", "d max gain", "dMaxGain"],
    },
    {
        id: "d_max_advance",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "d_max_advance",
        label: "D-Max Advance",
        aliases: ["dmax advance", "d max advance", "dMaxAdvance"],
    },
    {
        id: "tpa_rate",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "tpa_rate",
        label: "TPA Rate",
        aliases: ["tpa", "tpa rate", "throttle pid attenuation"],
    },
    {
        id: "tpa_breakpoint",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "tpa_breakpoint",
        label: "TPA Breakpoint",
        aliases: ["tpa breakpoint", "tpa break point"],
    },
    {
        id: "tpa_mode",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "tpa_mode",
        label: "TPA Mode",
        aliases: ["tpa mode"],
    },
    {
        id: "iterm_relax",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "iterm_relax",
        label: "I-term Relax",
        aliases: ["iterm relax", "i term relax", "itermRelax"],
    },
    {
        id: "iterm_relax_cutoff",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "iterm_relax_cutoff",
        label: "I-term Relax Cutoff",
        aliases: ["iterm relax cutoff", "relax cutoff"],
    },
    {
        id: "iterm_rotation",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "iterm_rotation",
        label: "I-term Rotation",
        aliases: ["iterm rotation", "i term rotation"],
    },
    {
        id: "motor_output_limit",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "motor_output_limit",
        label: "Motor Output Limit",
        aliases: ["motor output limit", "motor limit"],
    },
    {
        id: "idle_min_rpm",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "idle_min_rpm",
        label: "Idle Min RPM (Dynamic Idle)",
        aliases: ["idle min rpm", "dynamic idle", "idle rpm"],
    },
    {
        id: "vbat_sag_compensation",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "vbat_sag_compensation",
        label: "VBat Sag Compensation",
        aliases: ["vbat sag", "sag compensation", "voltage sag"],
    },
    {
        id: "thrust_linearization",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "thrust_linearization",
        label: "Thrust Linearization",
        aliases: ["thrust linearization", "thrust linear"],
    },
    {
        id: "acro_trainer_angle_limit",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: "acro_trainer_angle_limit",
        label: "Acro Trainer Angle Limit",
        aliases: ["acro trainer", "acro trainer angle"],
    },

    // ── PID Tuning → Rates sub-tab ────────────────────────────────────────
    {
        id: "rates",
        tab: "pid_tuning",
        subTab: "rates",
        fieldKey: null,
        label: "Rates (PID Tuning → Rates)",
        aliases: ["rates", "rate profile", "rc rate", "super rate", "rates tab"],
    },

    // ── PID Tuning → Filter sub-tab ───────────────────────────────────────
    {
        id: "gyro_lowpass",
        tab: "pid_tuning",
        subTab: "filter",
        fieldKey: "gyro_lowpass_hz",
        label: "Gyro Lowpass 1 Filter",
        aliases: ["gyro lowpass", "gyro lpf", "gyro lpf1", "gyro filter"],
    },
    {
        id: "dterm_lowpass",
        tab: "pid_tuning",
        subTab: "filter",
        fieldKey: "dterm_lowpass_hz",
        label: "D-term Lowpass 1 Filter",
        aliases: ["dterm lowpass", "dterm lpf", "d term filter", "dterm filter"],
    },
    {
        id: "filters",
        tab: "pid_tuning",
        subTab: "filter",
        fieldKey: null,
        label: "Filters (PID Tuning → Filter)",
        aliases: [
            "filters",
            "filter tab",
            "filtering",
            "notch",
            "rpm filter",
            "filtres",
            "filtre",
            "filtrage",
            "filter settings",
            "filter sub-tab",
        ],
    },

    // ── Tab-level navigation targets (whole tab, no specific field) ───────
    {
        id: "tab_pid_tuning",
        tab: "pid_tuning",
        subTab: "pid",
        fieldKey: null,
        label: "PID Tuning tab",
        aliases: ["pid tuning", "pid tab", "pids", "pid tuning tab", "tuning", "onglet pid"],
    },
    {
        id: "tab_rates",
        tab: "pid_tuning",
        subTab: "rates",
        fieldKey: null,
        label: "Rates (PID Tuning → Rates)",
        aliases: ["rates tab", "rate tab", "onglet rates"],
    },
    {
        id: "tab_configuration",
        tab: "configuration",
        subTab: null,
        fieldKey: null,
        label: "Configuration tab",
        aliases: [
            "configuration",
            "config",
            "configuration tab",
            "config tab",
            "onglet configuration",
            "onglet config",
        ],
    },
    {
        id: "tab_receiver",
        tab: "receiver",
        subTab: null,
        fieldKey: null,
        label: "Receiver tab",
        aliases: ["receiver", "receiver tab", "rx", "rx tab", "récepteur", "recepteur", "onglet receiver"],
    },

    // ── Configuration tab ─────────────────────────────────────────────────
    {
        id: "craft_name",
        tab: "configuration",
        subTab: null,
        fieldKey: "craft_name",
        label: "Craft Name",
        aliases: ["craft name", "quad name", "model name", "craftName"],
    },
    {
        id: "pilot_name",
        tab: "configuration",
        subTab: null,
        fieldKey: "pilot_name",
        label: "Pilot Name",
        aliases: ["pilot name", "pilotName"],
    },
    {
        id: "pid_process_denom",
        tab: "configuration",
        subTab: null,
        fieldKey: "pid_process_denom",
        label: "PID Loop Frequency (PID process denom)",
        aliases: ["pid process denom", "pid loop frequency", "pid denom", "looptime", "pid loop"],
    },
    {
        id: "fpv_cam_angle",
        tab: "configuration",
        subTab: null,
        fieldKey: "fpv_cam_angle",
        label: "FPV Camera Angle",
        aliases: ["fpv cam angle", "camera angle", "fpv camera angle", "cam angle"],
    },
    {
        id: "small_angle",
        tab: "configuration",
        subTab: null,
        fieldKey: "small_angle",
        label: "Small Angle (max arming angle)",
        aliases: ["small angle", "max arming angle", "arming angle"],
    },
    {
        id: "gyro_cal_on_first_arm",
        tab: "configuration",
        subTab: null,
        fieldKey: "gyro_cal_on_first_arm",
        label: "Calibrate Gyro on First Arm",
        aliases: ["gyro cal on first arm", "calibrate gyro on arm", "gyro calibration arm"],
    },
    {
        id: "auto_disarm_delay",
        tab: "configuration",
        subTab: null,
        fieldKey: "auto_disarm_delay",
        label: "Auto Disarm Delay",
        aliases: ["auto disarm delay", "disarm delay", "auto disarm"],
    },
    {
        id: "dshot_beacon_tone",
        tab: "configuration",
        subTab: null,
        fieldKey: "dshot_beacon_tone",
        label: "DShot Beacon Tone",
        aliases: ["dshot beacon", "dshot beeper", "beacon tone", "dshot beacon tone"],
    },

    // ── Receiver tab ──────────────────────────────────────────────────────
    {
        id: "receiver_mode",
        tab: "receiver",
        subTab: null,
        fieldKey: "receiver_mode",
        label: "Receiver Mode",
        aliases: ["receiver mode", "rx mode", "receiver type"],
    },
    {
        id: "serialrx_provider",
        tab: "receiver",
        subTab: null,
        fieldKey: "serialrx_provider",
        label: "Serial Receiver Provider",
        aliases: ["serialrx provider", "serial rx", "serial receiver", "rx provider", "sbus", "crsf", "ibus"],
    },
    {
        id: "spi_rx_protocol",
        tab: "receiver",
        subTab: null,
        fieldKey: "spi_rx_protocol",
        label: "SPI Receiver Protocol",
        aliases: ["spi rx", "spi receiver", "spi protocol"],
    },
    {
        id: "telemetry",
        tab: "receiver",
        subTab: null,
        fieldKey: "telemetry",
        label: "Telemetry",
        aliases: ["telemetry", "telemetry feature"],
    },
    {
        id: "rssi_adc",
        tab: "receiver",
        subTab: null,
        fieldKey: "rssi_adc",
        label: "RSSI ADC",
        aliases: ["rssi adc", "analog rssi"],
    },
    {
        id: "rssi_channel",
        tab: "receiver",
        subTab: null,
        fieldKey: "rssi_channel",
        label: "RSSI Channel",
        aliases: ["rssi channel", "rssi on channel"],
    },
    {
        id: "channel_map",
        tab: "receiver",
        subTab: null,
        fieldKey: "channel_map",
        label: "Channel Map (AETR/TAER)",
        aliases: ["channel map", "rc map", "aetr", "taer", "channel mapping"],
    },
    {
        id: "stick_range",
        tab: "receiver",
        subTab: null,
        fieldKey: "stick_range",
        label: "Stick Range (min/center/max)",
        aliases: ["stick range", "stick min", "stick max", "stick center", "rc range"],
    },
    {
        id: "rc_smoothing",
        tab: "receiver",
        subTab: null,
        fieldKey: "rc_smoothing",
        label: "RC Smoothing",
        aliases: ["rc smoothing", "rc smooth", "smoothing"],
    },
];

function normalize(str) {
    return String(str ?? "")
        .toLowerCase()
        .replace(/[_\-.]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Resolve a free-form query (id, label, or alias) to a registry entry.
 * Matching strategy, in order of confidence:
 *   1. exact id match
 *   2. exact normalized label / alias match
 *   3. substring match against id / label / aliases
 * @param {string} query
 * @returns {object|null} the matched registry entry, or null.
 */
export function resolveSetting(query) {
    if (!query) return null;

    const exactId = SETTING_REGISTRY.find((e) => e.id === query);
    if (exactId) return exactId;

    const q = normalize(query);
    if (!q) return null;

    const exact = SETTING_REGISTRY.find((e) => {
        if (normalize(e.id) === q || normalize(e.label) === q) return true;
        return (e.aliases ?? []).some((a) => normalize(a) === q);
    });
    if (exact) return exact;

    return (
        SETTING_REGISTRY.find((e) => {
            const haystacks = [e.id, e.label, ...(e.aliases ?? [])].map(normalize);
            return haystacks.some((h) => h.includes(q) || q.includes(h));
        }) ?? null
    );
}

/** Compact list of navigable setting ids + labels for tool descriptions. */
export function listSettings() {
    return SETTING_REGISTRY.map(({ id, label, tab, subTab }) => ({ id, label, tab, subTab }));
}
