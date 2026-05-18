import CONFIGURATOR from "@/js/data_storage";
import GUI from "@/js/gui";
import { serial } from "@/js/serial";

export const getConnectionInfoTool = {
    name: "get_connection_info",
    description:
        "Get information about whether the configurator is connected to a flight controller, and over what transport. The `live` field is the source of truth for whether MSP requests will actually reach the FC.",
    parameters: {
        type: "object",
        properties: {},
    },
    async execute() {
        const serialConnected = Boolean(serial?.connected);
        const virtualMode = Boolean(CONFIGURATOR?.virtualMode);
        return {
            // True iff MSP requests will actually be sent on the wire.
            live: serialConnected && !virtualMode,
            serialConnected,
            virtualMode,
            connectionValidUi: Boolean(CONFIGURATOR?.connectionValid),
            cliActive: Boolean(CONFIGURATOR?.cliActive),
            connectedTo: GUI?.connected_to ?? null,
            connectingTo: GUI?.connecting_to ?? null,
            protocolName: serial?.protocol ?? null,
            connectionId: serial?.connectionId ?? null,
            connectedPort: (() => {
                try {
                    return serial?.getConnectedPort?.() ?? null;
                } catch {
                    return null;
                }
            })(),
        };
    },
};
