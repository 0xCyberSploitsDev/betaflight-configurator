import semver from "semver";
import FC from "@/js/fc";
import CONFIGURATOR, { API_VERSION_1_47 } from "@/js/data_storage";
import MSP from "@/js/msp";
import MSPCodes from "@/js/msp/MSPCodes";
import { serial } from "@/js/serial";
import { getDebugModes } from "@/js/utils/debugModes";

function buildPidProfile() {
    const pids = FC.PIDS;
    if (!pids) return null;
    const adv = FC.ADVANCED_TUNING ?? {};
    const sliders = FC.TUNING_SLIDERS ?? {};
    const names = FC.PID_NAMES ?? [];

    const apiVersion = FC.CONFIG?.apiVersion ?? "0.0.0";
    let preApi147 = false;
    try {
        preApi147 = semver.lt(apiVersion, API_VERSION_1_47);
    } catch {
        preApi147 = false;
    }

    // Per-axis row in the UI table has columns: P, I, "D Max", "Derivative", "Feedforward".
    // Which backing field maps to which header depends on API version
    // (see PidSubTab.vue derivativeLabel/dMaxLabel logic):
    //   pre-1.47:  D Max column   = FC.PIDS[i][2]            ; Derivative column = ADVANCED_TUNING.dMax*
    //   1.47+ :    D Max column   = ADVANCED_TUNING.dMax*    ; Derivative column = FC.PIDS[i][2]
    const axis = (idx, advDMax, advFF) => {
        const row = pids[idx];
        if (!row) return null;
        const [P, I, D] = row;
        if (P == null && I == null && D == null) return null;

        const dMaxColumn = preApi147 ? D : advDMax;
        const derivativeColumn = preApi147 ? advDMax : D;

        return {
            name: names[idx] ?? null,
            P: P ?? null,
            I: I ?? null,
            dMax: dMaxColumn ?? null, // "D Max" column in the UI table
            derivative: derivativeColumn ?? null, // "Derivative" column in the UI table
            feedforward: advFF ?? null, // "Feedforward" column in the UI table
        };
    };

    const roll = axis(0, adv.dMaxRoll, adv.feedforwardRoll);
    const pitch = axis(1, adv.dMaxPitch, adv.feedforwardPitch);
    const yaw = axis(2, adv.dMaxYaw, adv.feedforwardYaw);

    if (!roll && !pitch && !yaw) return null;

    // Slot 3 packs the Angle/Horizon section: [angleStrength, horizonStrength, horizonTransition].
    // (Slot 4 is MAG, not Horizon — easy mistake to make.)
    const levelRow = pids[3];

    return {
        // ----- PID table (bottom-left of screenshot) -----
        axes: { roll, pitch, yaw },

        // ----- Tuning Sliders panel (top-left of screenshot) -----
        tuningSliders: {
            mode: sliders.slider_pids_mode ?? null,
            masterMultiplier: sliders.slider_master_multiplier ?? null,
            rollPitchRatio: sliders.slider_roll_pitch_ratio ?? null,
            damping_dGains: sliders.slider_d_gain ?? null,
            tracking_piGains: sliders.slider_pi_gain ?? null,
            stickResponse_ffGains: sliders.slider_feedforward_gain ?? null,
            dynamicDamping_dMax: sliders.slider_dmax_gain ?? null,
            driftWobble_iGains: sliders.slider_i_gain ?? null,
            pitchTracking: sliders.slider_pitch_pi_gain ?? null,
        },

        // ----- Feedforward panel -----
        feedforward: {
            jitterReduction: adv.feedforward_jitter_factor ?? null,
            smoothness: adv.feedforward_smooth_factor ?? null,
            averaging: adv.feedforward_averaging ?? null,
            boost: adv.feedforward_boost ?? null,
            maxRateLimit: adv.feedforward_max_rate_limit ?? null,
            transition: adv.feedforwardTransition ?? null,
        },

        // ----- TPA panel -----
        tpa: {
            mode: adv.tpaMode ?? null, // 0=PD, 1=D
            rate: adv.tpaRate ?? null,
            breakpoint: adv.tpaBreakpoint ?? null,
        },

        // ----- I Term Relax panel -----
        itermRelax: {
            axes: adv.itermRelax ?? null, // 0=off, 1=RP, 2=RPY, 3=RP_INC, 4=RPY_INC
            type: adv.itermRelaxType ?? null, // 0=gyro, 1=setpoint
            cutoff: adv.itermRelaxCutoff ?? null,
        },

        // ----- Anti Gravity panel -----
        antiGravity: {
            mode: adv.antiGravityMode ?? null, // 0=smooth, 1=step
            // `||` instead of `??` because the FC parser stores 0 in whichever
            // field doesn't apply for this API version; the non-zero one is the
            // real value.
            gain: adv.itermAcceleratorGain || adv.antiGravityGain || null,
        },

        itermRotation: adv.itermRotation ?? null,

        // ----- Dynamic Damping panel -----
        dynamicDamping: {
            gain: adv.dMaxGain ?? null,
            advance: adv.dMaxAdvance ?? null,
        },

        // ----- Throttle and Motor Settings panel -----
        throttleAndMotor: {
            throttleBoost: adv.throttleBoost ?? null,
            motorOutputLimit: adv.motorOutputLimit ?? null,
            dynamicIdleValue: adv.idleMinRpm ?? null,
            vbatSagCompensation: adv.vbat_sag_compensation ?? null,
            thrustLinearization: adv.thrustLinearization ?? null,
        },

        // ----- Level mode (Angle/Horizon) -----
        levelMode: {
            angleStrength: levelRow?.[0] ?? null, // FC.PIDS[3][0]
            horizonStrength: levelRow?.[1] ?? null, // FC.PIDS[3][1]
            horizonTransition: levelRow?.[2] ?? null, // FC.PIDS[3][2]
            angleLimit: adv.levelAngleLimit ?? null,
            levelSensitivity: adv.levelSensitivity ?? null,
        },

        // ----- Miscellaneous Settings panel -----
        misc: {
            cellCount: adv.autoProfileCellCount ?? null,
            acroTrainerAngleLimit: adv.acroTrainerAngleLimit ?? null,
            integratedYaw: adv.useIntegratedYaw ?? null,
            absoluteControl: adv.absoluteControlGain ?? null,
        },

        // ----- Metadata -----
        meta: {
            apiVersion,
            preApi147,
            note: preApi147
                ? "API < 1.47: axes.dMax = FC.PIDS[i][2], axes.derivative = FC.ADVANCED_TUNING.dMax*"
                : "API >= 1.47: axes.dMax = FC.ADVANCED_TUNING.dMax*, axes.derivative = FC.PIDS[i][2]",
        },
    };
}

const SECTION_GETTERS = {
    summary: () => {
        const c = FC.CONFIG || {};
        return {
            connected: Boolean(isLiveConnection()),
            apiVersion: c.apiVersion ?? null,
            flightControllerIdentifier: c.flightControllerIdentifier ?? null,
            flightControllerVersion: c.flightControllerVersion ?? null,
            boardIdentifier: c.boardIdentifier ?? null,
            boardName: c.boardName ?? null,
            manufacturerId: c.manufacturerId ?? null,
            hardwareName: c.hardwareName ?? null,
            targetName: c.targetName ?? null,
            uid: c.uid ?? null,
            cpuload: c.cpuload ?? null,
            cycleTime: c.cycleTime ?? null,
        };
    },
    config: () => FC.CONFIG ?? null,
    features: () => FC.FEATURE_CONFIG ?? null,
    pid: () => buildPidProfile(),
    pidNames: () => FC.PID_NAMES ?? null,
    pidAdvanced: () => FC.ADVANCED_TUNING ?? null,
    rcTuning: () => FC.RC_TUNING ?? null,
    rcMap: () => FC.RC_MAP ?? null,
    rxConfig: () => FC.RX_CONFIG ?? null,
    motorConfig: () => FC.MOTOR_CONFIG ?? null,
    mixerConfig: () => FC.MIXER_CONFIG ?? null,
    sensorData: () => FC.SENSOR_DATA ?? null,
    sensorConfig: () => FC.SENSOR_CONFIG ?? null,
    failsafeConfig: () => FC.FAILSAFE_CONFIG ?? null,
    batteryConfig: () => FC.BATTERY_CONFIG ?? null,
    blackbox: () => {
        const bb = FC.BLACKBOX || {};
        const apiVersion = FC.CONFIG?.apiVersion ?? "";

        const DEVICE_NAMES = {
            0: "None (disabled)",
            1: "Flash (SPI/dataflash on-board)",
            2: "SD Card",
            3: "Serial",
            4: "USB MSC / Virtual",
        };

        let debugModeName = null;
        const debugMode = FC.PID_ADVANCED_CONFIG?.debugMode;
        if (debugMode !== undefined && debugMode !== null) {
            const modes = getDebugModes(apiVersion);
            debugModeName = modes[debugMode] ?? `unknown (${debugMode})`;
        }

        const allFields = [
            "PID",
            "RC Commands",
            "Setpoint",
            "Battery",
            "Magnetometer",
            "Altitude",
            "RSSI",
            "Gyro",
            "Accelerometer",
            "Debug Log",
            "Motor",
            "GPS",
            "RPM",
            "Gyro (Unfiltered)",
        ];
        if (apiVersion && semver.gte(apiVersion, API_VERSION_1_47)) {
            allFields.splice(8, 0, "Attitude");
            allFields.push("Servo");
        }

        const mask = bb.blackboxDisabledMask ?? 0;
        const disabledFields = [];
        for (let i = 0; i < allFields.length; i++) {
            if (mask & (1 << i)) disabledFields.push(allFields[i]);
        }

        const rateNum = bb.blackboxRateNum ?? 1;
        const rateDenom = bb.blackboxRateDenom ?? 1;

        return {
            supported: bb.supported ?? false,
            device: bb.blackboxDevice ?? 0,
            deviceName: DEVICE_NAMES[bb.blackboxDevice] ?? `unknown (${bb.blackboxDevice})`,
            rateNum,
            rateDenom,
            pDenom: bb.blackboxPDenom ?? 0,
            sampleRate: bb.blackboxSampleRate ?? 0,
            disabledMask: mask,
            disabledFields,
            debugMode: debugMode ?? null,
            debugModeName,
            _analysis: [
                `Logging ${bb.supported ? "supported" : "NOT supported"}.`,
                `Device: ${DEVICE_NAMES[bb.blackboxDevice] ?? "unknown"}.`,
                `Sampling ratio: ${rateNum}/${rateDenom}.`,
                disabledFields.length > 0 ? `Disabled fields: ${disabledFields.join(", ")}.` : null,
                debugModeName
                    ? `Debug mode: ${debugModeName}.`
                    : "Debug mode: not available (read motorAdvanced first).",
            ]
                .filter(Boolean)
                .join(" "),
        };
    },
    gpsConfig: () => FC.GPS_CONFIG ?? null,
    gpsData: () => FC.GPS_DATA ?? null,
    vtxConfig: () => FC.VTX_CONFIG ?? null,
    serialConfig: () => FC.SERIAL_CONFIG ?? null,
    filterConfig: () => FC.FILTER_CONFIG ?? null,
    motorAdvanced: () => FC.PID_ADVANCED_CONFIG ?? null,
};

const SECTION_MSP_CODES = {
    features: [MSPCodes.MSP_FEATURE_CONFIG],
    pid: [MSPCodes.MSP_PIDNAMES, MSPCodes.MSP_PID, MSPCodes.MSP_PID_ADVANCED, MSPCodes.MSP_SIMPLIFIED_TUNING],
    pidNames: [MSPCodes.MSP_PIDNAMES],
    pidAdvanced: [MSPCodes.MSP_PID_ADVANCED],
    rcTuning: [MSPCodes.MSP_RC_TUNING],
    rcMap: [MSPCodes.MSP_RX_MAP],
    rxConfig: [MSPCodes.MSP_RX_CONFIG],
    motorConfig: [MSPCodes.MSP_MOTOR_CONFIG],
    mixerConfig: [MSPCodes.MSP_MIXER_CONFIG],
    sensorData: [MSPCodes.MSP_RAW_IMU],
    sensorConfig: [MSPCodes.MSP_SENSOR_CONFIG],
    failsafeConfig: [MSPCodes.MSP_FAILSAFE_CONFIG],
    batteryConfig: [MSPCodes.MSP_BATTERY_CONFIG],
    blackbox: [MSPCodes.MSP_BLACKBOX_CONFIG],
    gpsConfig: [MSPCodes.MSP_GPS_CONFIG],
    gpsData: [MSPCodes.MSP_RAW_GPS],
    vtxConfig: [MSPCodes.MSP_VTX_CONFIG],
    serialConfig: [MSPCodes.MSP_CF_SERIAL_CONFIG],
    filterConfig: [MSPCodes.MSP_FILTER_CONFIG],
    motorAdvanced: [MSPCodes.MSP_ADVANCED_CONFIG],
};

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`MSP request timed out after ${ms}ms`)), ms)),
    ]);
}

function isLiveConnection() {
    return Boolean(serial?.connected) && !CONFIGURATOR?.virtualMode;
}

async function fetchSection(section) {
    const codes = SECTION_MSP_CODES[section];
    if (!codes || codes.length === 0) return;
    for (const code of codes) {
        const data = await withTimeout(MSP.promise(code), 3000);
        // MSP.send_message bails silently (returning no data) when serial isn't
        // actually connected or virtualMode is on — surface that as an error
        // instead of letting the caller see stale/empty FC.* fields.
        if (data === undefined) {
            throw new Error(
                `MSP request ${code} returned no data — the FC is not actually contactable (serial.connected=${serial?.connected}, virtualMode=${CONFIGURATOR?.virtualMode}).`,
            );
        }
    }
}

const SECTION_DESCRIPTIONS = {
    summary:
        "Curated overview: apiVersion, board/target name, FC identifier+version, manufacturer, uid, cpu load, cycle time. Start here.",
    config: "Full FC.CONFIG — most generic metadata.",
    features: "FEATURE_CONFIG — bitfield of which features are enabled.",
    pid: "EVERYTHING shown on the 'PID Profile Settings' sub-tab. Per-axis P/I/dMax/Derivative/Feedforward, tuning sliders (damping, tracking, master multiplier...), feedforward (jitter reduction, smoothness, averaging, boost, max rate limit, transition), TPA (mode/rate/breakpoint), iTerm Relax, anti-gravity, iTerm rotation, dynamic damping (gain/advance), throttle and motor settings (throttle boost, motor output limit, dynamic idle, vbat sag, thrust linearization), level mode (angle/horizon strength + angle limit), miscellaneous (cell count, acro trainer angle limit, integrated yaw, absolute control). Auto-fetches all relevant MSPs. This is the right section for ANY PID-related question.",
    pidNames: "Axis name labels only — rarely useful on its own.",
    pidAdvanced:
        "Full FC.ADVANCED_TUNING: iterm relax, anti-gravity, dterm setpoint, feedforward smoothness/boost/transition, throttle boost, dynamic damping, motor output limit, level mode angle/sensitivity. Use after 'pid' if you need more advanced settings.",
    rcTuning: "Rates, throttle curve, RC expo — use for 'how aggressive are my rates?'.",
    rcMap: "Channel mapping (which RX channel is throttle/yaw/etc).",
    rxConfig: "Receiver / RC link configuration.",
    motorConfig: "Motor PWM rate, min/max throttle, idle.",
    mixerConfig: "Mixer type (quad-x, etc) and motor direction reversal.",
    sensorData: "Live gyro/accel/mag/baro readings — populated continuously while connected.",
    sensorConfig: "Which physical sensors are enabled.",
    failsafeConfig: "Failsafe behaviour and stage timings.",
    batteryConfig: "Cell count, voltage thresholds, current meter scaling.",
    blackbox:
        "Blackbox logging configuration: device type (none/flash/SD/serial/USB MSC), sampling ratio (rateNum/rateDenom), PID decimation (pDenom), sample rate index, disabled debug fields mask, resolved debug mode name. Enriched with human-readable device name and disabled field list.",
    gpsConfig: "GPS protocol / sbas mode.",
    gpsData: "Live GPS fix, sat count, lat/lon.",
    vtxConfig: "VTX band, channel, power level.",
    serialConfig: "UART port assignments.",
    filterConfig: "Gyro/Dterm filter setup (lowpass, notch, dynamic, RPM).",
    motorAdvanced:
        "FC.PID_ADVANCED_CONFIG — motor/ESC PWM rate, ESC protocol, gyro process denom, motor idle. (NOT the same as pidAdvanced.)",
};

const SECTION_DESCRIPTION_BLOCK = Object.entries(SECTION_DESCRIPTIONS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

function isEmptyValue(value) {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) {
        if (value.length === 0) return true;
        return value.every(isEmptyValue);
    }
    if (typeof value === "object") {
        const keys = Object.keys(value);
        if (keys.length === 0) return true;
        return keys.every((k) => isEmptyValue(value[k]));
    }
    return false;
}

export const getFcStateTool = {
    name: "get_fc_state",
    description: `Read the current values of one section of the flight controller's state over MSP. Returns numbers and settings as data. If the section is empty, this tool automatically sends the matching MSP request(s) and re-reads.

This tool reads data only — it does not navigate between tabs. For navigation requests (navigate, go to, open, show me, where is, and French equivalents), use navigate_to_setting instead.

Available sections:
${SECTION_DESCRIPTION_BLOCK}`,
    parameters: {
        type: "object",
        properties: {
            section: {
                type: "string",
                description:
                    "Which section to read. Prefer 'summary' first to confirm connection state, then ask for specific sections by their semantic meaning (see the description for what each returns).",
                enum: Object.keys(SECTION_GETTERS),
            },
        },
        required: ["section"],
    },
    async execute({ section }) {
        const getter = SECTION_GETTERS[section];
        if (!getter) {
            return {
                error: `Unknown section "${section}". Valid: ${Object.keys(SECTION_GETTERS).join(", ")}`,
            };
        }

        try {
            // Always re-fetch the underlying MSP data when this section has codes
            // mapped and we're connected. The cached value is initialised to
            // structural defaults (zeros / nulls) which can't be distinguished
            // from "really 0" without going to the wire — same reason
            // PidTuningTab re-fetches every time it opens.
            let refreshed = false;
            let fetchError = null;
            if (SECTION_MSP_CODES[section] && isLiveConnection()) {
                try {
                    await fetchSection(section);
                    refreshed = true;
                } catch (e) {
                    fetchError = e;
                }
            }

            const value = getter();

            if (fetchError) {
                return {
                    section,
                    value,
                    _hint: `MSP fetch failed: ${fetchError?.message ?? String(fetchError)}. Returning cached value (may be stale or default). The FC may not support this MSP command on its firmware version.`,
                };
            }

            if (isEmptyValue(value)) {
                if (!isLiveConnection()) {
                    return {
                        section,
                        value,
                        _hint: "No flight controller is currently connected. Ask the user to connect their FC.",
                    };
                }
                return {
                    section,
                    value,
                    _hint: "FC responded but data is empty. Firmware may not support this MSP command.",
                };
            }

            return { section, value, ...(refreshed ? { _refreshed: true } : {}) };
        } catch (e) {
            return { error: `Failed to read section: ${e?.message ?? String(e)}` };
        }
    },
};
