import "../../libraries/flightindicators.css";

import "../css/theme.css";
import "../css/main.less";
import "../css/opensans_webfontkit/fonts.css";
import "../components/MotorOutputReordering/Styles.css";
import "../components/EscDshotDirection/Styles.css";
import "../css/dark-theme.less";
import "./main";

import { i18n } from "./localization";
import { pinia } from "./pinia_instance";
import { useDialogStore } from "../stores/dialog";
import { registerSW } from "virtual:pwa-register";
import { isAndroid, isEmbeddedDeployment, isTauri } from "./utils/checkCompatibility.js";

// In the Tauri desktop shell the app is served from bundled local assets, so a
// service worker adds nothing and its precache actively serves STALE JS after a
// rebuild (the "prompt" SW never activates without user interaction, and the
// webview cache survives reinstalls). Tear down any previously-registered SW and
// purge its caches so each launch runs the freshly bundled code.
if (isTauri()) {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker
            .getRegistrations()
            .then((registrations) => registrations.forEach((r) => r.unregister()))
            .catch((e) => console.warn("[PWA] Failed to unregister service workers", e));
    }
    if (typeof caches !== "undefined") {
        caches
            .keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .catch((e) => console.warn("[PWA] Failed to clear caches", e));
    }
}

// Skip PWA/service-worker on embedded deployments (WebSocket-only host, plain HTTP),
// Android native builds, and the Tauri desktop shell where they are unnecessary
if (!isAndroid() && !isEmbeddedDeployment() && !isTauri()) {
    const dialogStore = useDialogStore(pinia);
    const updateSW = registerSW({
        onNeedRefresh() {
            console.log("Detected onNeedRefresh");
            dialogStore.open(
                "YesNoDialog",
                {
                    title: i18n.getMessage("pwaOnNeedRefreshTitle"),
                    text: i18n.getMessage("pwaOnNeedRefreshText"),
                    yesText: i18n.getMessage("yes"),
                    noText: i18n.getMessage("no"),
                },
                {
                    yes: () => {
                        dialogStore.close();
                        updateSW();
                    },
                    no: () => dialogStore.close(),
                },
            );
        },
        onOfflineReady() {
            console.log("Detected onOfflineReady");
            dialogStore.open(
                "InformationDialog",
                {
                    title: i18n.getMessage("pwaOnOffilenReadyTitle"),
                    text: i18n.getMessage("pwaOnOffilenReadyText"),
                    confirmText: i18n.getMessage("OK"),
                },
                { confirm: () => dialogStore.close() },
            );
        },
    });
}
