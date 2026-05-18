export class AiError extends Error {
    constructor(message, { provider, status, retryable = false, kind = "unknown", cause } = {}) {
        super(message);
        this.name = "AiError";
        this.provider = provider;
        this.status = status;
        this.retryable = retryable;
        this.kind = kind;
        if (cause) this.cause = cause;
    }
}

function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

const PROVIDER_LABEL = {
    anthropic: "Anthropic",
    openai: "OpenAI",
};

const SETTINGS_HINT = "Open AI Settings (gear icon in the panel header) to update.";

export function humanizeHttpError(provider, response, bodyText) {
    const body = safeJsonParse(bodyText);
    const upstreamMsg = body?.error?.message || body?.error || bodyText || `HTTP ${response.status}`;
    const label = PROVIDER_LABEL[provider] ?? provider ?? "Provider";
    const status = response.status;

    switch (status) {
        case 400:
            return new AiError(`${label} rejected the request: ${upstreamMsg}`, {
                provider,
                status,
                kind: "bad_request",
            });
        case 401:
            return new AiError(`${label} says your API key is invalid or missing. ${SETTINGS_HINT}`, {
                provider,
                status,
                kind: "auth",
            });
        case 403:
            return new AiError(
                `${label} blocked the request — your API key is valid but doesn't have access to this model. Switch to a different model or check your account. ${SETTINGS_HINT}`,
                { provider, status, kind: "forbidden" },
            );
        case 404:
            return new AiError(
                `${label} couldn't find that model. Check the model name in settings — try one of the suggested chips. ${SETTINGS_HINT}`,
                { provider, status, kind: "model_not_found" },
            );
        case 413:
            return new AiError(`${label} says the request is too large. Clear the chat and try again.`, {
                provider,
                status,
                kind: "too_large",
            });
        case 429: {
            const retryAfter = response.headers?.get?.("retry-after");
            const suffix = retryAfter ? ` Retry in ~${retryAfter}s.` : " Wait a moment and retry.";
            return new AiError(`${label} rate limit hit.${suffix}`, {
                provider,
                status,
                kind: "rate_limit",
                retryable: true,
            });
        }
        case 500:
        case 502:
        case 503:
        case 504:
            return new AiError(`${label} server error (${status}). Try again in a moment.`, {
                provider,
                status,
                kind: "server",
                retryable: true,
            });
        default:
            return new AiError(`${label} returned HTTP ${status}: ${upstreamMsg}`, {
                provider,
                status,
                kind: "http",
                retryable: status >= 500,
            });
    }
}

export function humanizeNetworkError(provider, cause) {
    const label = PROVIDER_LABEL[provider] ?? provider ?? "Provider";
    const msg = cause?.message ?? String(cause);
    if (cause?.name === "AbortError") {
        return new AiError("Request cancelled.", { provider, kind: "abort", cause });
    }
    if (/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED/i.test(msg)) {
        return new AiError(
            `Couldn't reach ${label}. Check your internet connection, then retry. (If this is the desktop/Tauri build, also verify the host is not firewalled.)`,
            { provider, kind: "network", retryable: true, cause },
        );
    }
    return new AiError(`${label} request failed: ${msg}`, {
        provider,
        kind: "unknown",
        retryable: true,
        cause,
    });
}
