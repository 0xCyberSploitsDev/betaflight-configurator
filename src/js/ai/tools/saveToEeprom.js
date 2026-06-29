import MSP from "@/js/msp";
import MSPCodes from "@/js/msp/MSPCodes";

export const saveToEepromTool = {
    name: "save_to_eeprom",
    description: `Persist all pending parameter changes to the flight controller's EEPROM (non-volatile memory).

MUST be called after any set_parameter calls to make changes permanent. Parameters changed via MSP but not saved to EEPROM will be lost on the next FC reboot / power cycle.

The FC will reboot after saving, causing a temporary disconnection. The configurator will re-connect automatically once the FC comes back up.`,
    parameters: {
        type: "object",
        properties: {},
        required: [],
    },
    async execute() {
        return {
            _requiresConfirmation: true,
            description: "Write all pending changes to FC EEPROM (FC will reboot)",
            proposedInput: {},
        };
    },
};

export async function confirmSaveToEeprom() {
    await MSP.promise(MSPCodes.MSP_EEPROM_WRITE);
    return { success: true, message: "Settings saved to EEPROM. FC is rebooting." };
}
