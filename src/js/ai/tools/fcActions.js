import MSP from "@/js/msp";
import MSPCodes from "@/js/msp/MSPCodes";
import CONFIGURATOR from "@/js/data_storage";
import { serial } from "@/js/serial";

function isLive() {
    return Boolean(serial?.connected) && !CONFIGURATOR?.virtualMode;
}

function notConnected() {
    return { error: "No flight controller is connected (or running in virtual mode). Connect an FC first." };
}

// ── Accelerometer calibration ────────────────────────────────────────────────
export const calibrateAccelerometerTool = {
    name: "calibrate_accelerometer",
    description: `Calibrate the accelerometer. The craft MUST be sitting completely flat and still on a level surface during calibration. Takes ~1 second.

This is required after a fresh build, after remounting the flight controller, or when the artificial horizon drifts. Requires user confirmation.`,
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
        if (!isLive()) return notConnected();
        return {
            _requiresConfirmation: true,
            description: "Calibrate the accelerometer — the craft MUST be flat and completely still",
            proposedInput: {},
        };
    },
};

export async function confirmCalibrateAccelerometer() {
    if (!isLive()) return notConnected();
    await MSP.promise(MSPCodes.MSP_ACC_CALIBRATION);
    return {
        success: true,
        message:
            "Accelerometer calibration command sent. The FC calibrates for ~1s; the craft must have stayed flat and still.",
    };
}

// ── Magnetometer (compass) calibration ───────────────────────────────────────
export const calibrateMagnetometerTool = {
    name: "calibrate_magnetometer",
    description: `Start magnetometer (compass) calibration. After confirming, the user must ROTATE the craft 360° around all three axes (roll, pitch, yaw) within ~30 seconds while the FC samples the magnetic field.

Only relevant for builds with an external/onboard compass (GPS units). Requires user confirmation.`,
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
        if (!isLive()) return notConnected();
        return {
            _requiresConfirmation: true,
            description: "Start magnetometer calibration — rotate the craft 360° on all axes for ~30s",
            proposedInput: {},
        };
    },
};

export async function confirmCalibrateMagnetometer() {
    if (!isLive()) return notConnected();
    await MSP.promise(MSPCodes.MSP_MAG_CALIBRATION);
    return {
        success: true,
        message:
            "Magnetometer calibration started. Tell the user to rotate the craft a full 360° around roll, pitch and yaw within the next ~30 seconds.",
    };
}

// ── Reboot ───────────────────────────────────────────────────────────────────
export const rebootFcTool = {
    name: "reboot_fc",
    description: `Reboot the flight controller. The configurator will lose connection briefly and reconnect automatically. Unsaved (un-persisted) parameter changes are LOST on reboot — persist them with save_to_eeprom first if needed. Requires user confirmation.`,
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
        if (!isLive()) return notConnected();
        return {
            _requiresConfirmation: true,
            description: "Reboot the flight controller (unsaved changes will be lost)",
            proposedInput: {},
        };
    },
};

export async function confirmRebootFc() {
    if (!isLive()) return notConnected();
    // Defer to the shared reboot flow so the configurator re-establishes the
    // link (sets the reboot timestamp, allows auto-connect). Imported lazily to
    // avoid pulling Vue/dialog stores into the tool module's top-level graph.
    const { reinitializeConnection } = await import("@/js/serial_backend");
    reinitializeConnection(true);
    CONFIGURATOR.connectionValid = false;
    return {
        success: true,
        message: "Reboot command sent. The FC is restarting and the configurator will reconnect automatically.",
    };
}
