import FC from "@/js/fc";
import MSP from "@/js/msp";
import MSPCodes from "@/js/msp/MSPCodes";
import { mspHelper } from "@/js/msp/MSPHelper";

const SECTIONS = {
    pidAdvanced: {
        mspCode: MSPCodes.MSP_SET_PID_ADVANCED,
        fcGetter: () => FC.ADVANCED_TUNING,
        description:
            "PID advanced / tuning settings (throttleBoost, dMaxGain, itermRelax, feedforward_*, tpaMode, etc.)",
        fields: [
            "rollPitchItermIgnoreRate",
            "yawItermIgnoreRate",
            "yaw_p_limit",
            "deltaMethod",
            "vbatPidCompensation",
            "feedforwardTransition",
            "dtermSetpointWeight",
            "toleranceBand",
            "toleranceBandReduction",
            "itermThrottleGain",
            "pidMaxVelocity",
            "pidMaxVelocityYaw",
            "levelAngleLimit",
            "levelSensitivity",
            "itermThrottleThreshold",
            "antiGravityGain",
            "itermAcceleratorGain",
            "dtermSetpointWeight",
            "itermRotation",
            "smartFeedforward",
            "itermRelax",
            "itermRelaxType",
            "absoluteControlGain",
            "throttleBoost",
            "acroTrainerAngleLimit",
            "feedforwardRoll",
            "feedforwardPitch",
            "feedforwardYaw",
            "antiGravityMode",
            "dMaxRoll",
            "dMaxPitch",
            "dMaxYaw",
            "dMaxGain",
            "dMaxAdvance",
            "useIntegratedYaw",
            "integratedYawRelax",
            "itermRelaxCutoff",
            "motorOutputLimit",
            "autoProfileCellCount",
            "idleMinRpm",
            "feedforward_averaging",
            "feedforward_smooth_factor",
            "feedforward_boost",
            "feedforward_max_rate_limit",
            "feedforward_jitter_factor",
            "vbat_sag_compensation",
            "thrustLinearization",
            "tpaMode",
            "tpaRate",
            "tpaBreakpoint",
        ],
        valueHint: "integers (u8/u16) or 0-100 percentages; tpaRate is 0.00-1.00",
    },
    rcTuning: {
        mspCode: MSPCodes.MSP_SET_RC_TUNING,
        fcGetter: () => FC.RC_TUNING,
        description:
            "Rates and RC curve (RC_RATE, RC_EXPO, roll_rate, pitch_rate, yaw_rate, throttle_MID, throttle_EXPO, rates_type, throttleLimitType, throttleLimitPercent, etc.)",
        fields: [
            "RC_RATE",
            "RC_EXPO",
            "roll_rate",
            "pitch_rate",
            "yaw_rate",
            "dynamic_THR_PID",
            "throttle_MID",
            "throttle_EXPO",
            "dynamic_THR_breakpoint",
            "RC_YAW_EXPO",
            "rcYawRate",
            "rcPitchRate",
            "RC_PITCH_EXPO",
            "throttleLimitType",
            "throttleLimitPercent",
            "roll_rate_limit",
            "pitch_rate_limit",
            "yaw_rate_limit",
            "rates_type",
            "throttle_HOVER",
        ],
        valueHint:
            "most values are 0-100 percentages (divide raw by 100); rates_type: 0=betaflight, 1=raceflight, 2=kiss",
    },
    filterConfig: {
        mspCode: MSPCodes.MSP_SET_FILTER_CONFIG,
        fcGetter: () => FC.FILTER_CONFIG,
        description: "Gyro and D-term filter settings",
        fields: [
            "gyro_lpf1_stage1_type",
            "gyro_lpf1_stage1_hz",
            "gyro_lpf1_stage2_type",
            "gyro_lpf1_stage2_hz",
            "gyro_lpf1_dyn_min_hz",
            "gyro_lpf1_dyn_max_hz",
            "gyro_lpf2_type",
            "gyro_lpf2_hz",
            "dterm_lpf1_type",
            "dterm_lpf1_hz",
            "dterm_lpf1_dyn_min_hz",
            "dterm_lpf1_dyn_max_hz",
            "dterm_lpf2_type",
            "dterm_lpf2_hz",
            "gyro_notch_hz_0",
            "gyro_notch_cutoff_0",
            "gyro_notch_hz_1",
            "gyro_notch_cutoff_1",
            "dterm_notch_hz",
            "dterm_notch_cutoff",
            "gyro_rpm_notch_harmonics",
            "gyro_rpm_notch_min_hz",
            "dterm_rpm_notch_harmonics",
            "dterm_rpm_notch_min_hz",
            "gyro_rpm_notch_q",
            "dterm_rpm_notch_q",
            "rpm_notch_lpf_hz",
        ],
        valueHint: "integers (Hz, types) or 0 to disable",
    },
    batteryConfig: {
        mspCode: MSPCodes.MSP_SET_BATTERY_CONFIG,
        fcGetter: () => FC.BATTERY_CONFIG,
        description: "Battery voltage and capacity settings",
        fields: [
            "vbatmincellvoltage",
            "vbatmaxcellvoltage",
            "vbatwarningcellvoltage",
            "capacity",
            "voltageMeterSource",
            "currentMeterSource",
        ],
        valueHint: "vbat*cellvoltage: 0-50 (tenths of volts); capacity: mAh; source: 0=ADC, 1=ESC, 2=MSP",
    },
    features: {
        mspCode: MSPCodes.MSP_SET_FEATURE_CONFIG,
        fcGetter: () => FC.FEATURE_CONFIG,
        description: "Feature bitmask (RX_SERIAL, MOTOR_STOP, TELEMETRY, etc.)",
        fields: [],
        valueHint: "Feature toggling is handled via feature names, not bitmask — see set_feature tool instead",
    },
};

export const setParameterTool = {
    name: "set_parameter",
    description: `Write a single FC parameter via MSP. ONLY use this tool when the user EXPLICITLY asks you to change a value — never write without a direct user instruction.

Each call changes exactly ONE field. After writing, suggest the user call save_to_eeprom to persist.

Available sections and their writable fields:
${Object.entries(SECTIONS)
        .map(
            ([key, s]) => `- ${key}: ${s.description}\n  Writable fields: ${s.fields.join(", ")}\n  Values: ${s.valueHint}`,
        )
        .join("\n")}`,
    parameters: {
        type: "object",
        properties: {
            section: {
                type: "string",
                description: "Which parameter section to modify",
                enum: Object.keys(SECTIONS),
            },
            field: {
                type: "string",
                description:
                    "The exact field name in FC.* to modify. Check available fields in the section description.",
            },
            value: {
                type: "number",
                description:
                    "The new numeric value for the field. Must be within the valid range for that field type (u8: 0-255, u16: 0-65535, percentages: 0-100).",
            },
        },
        required: ["section", "field", "value"],
    },
    async execute({ section, field, value }) {
        const sec = SECTIONS[section];
        if (!sec) {
            return { error: `Unknown section "${section}". Valid: ${Object.keys(SECTIONS).join(", ")}` };
        }
        if (!sec.fields.includes(field)) {
            return {
                error: `Unknown field "${field}" for section "${section}". Valid fields: ${sec.fields.join(", ")}`,
            };
        }

        const obj = sec.fcGetter();
        if (!obj || obj[field] === undefined) {
            return {
                error: `FC state for section "${section}" has not been loaded yet. Read it first with get_fc_state(section="${section}") before writing.`,
            };
        }

        const currentValue = obj[field];
        if (value === currentValue) {
            return { _hint: `No change needed — ${section}.${field} is already ${JSON.stringify(currentValue)}.` };
        }

        return {
            _requiresConfirmation: true,
            description: `Set ${section}.${field} from ${JSON.stringify(currentValue)} to ${JSON.stringify(value)}`,
            proposedInput: { section, field, value },
        };
    },
};

export async function confirmSetParameter({ section, field, value }) {
    const sec = SECTIONS[section];
    if (!sec) {
        return { error: `Unknown section "${section}"` };
    }

    const obj = sec.fcGetter();
    if (!obj) {
        return { error: `FC state for section "${section}" is not available` };
    }

    obj[field] = value;
    await MSP.promise(sec.mspCode, mspHelper.crunch(sec.mspCode));

    return {
        success: true,
        section,
        field,
        value,
        message: `${section}.${field} set to ${JSON.stringify(value)}`,
    };
}
