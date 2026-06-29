import { callOpenAi, streamOpenAi } from "./openai.js";

const PROVIDER = "openai-compatible";

function buildUrl(baseUrl) {
    const url = (baseUrl || "http://localhost:11434").replace(/\/+$/, "");
    if (!url.endsWith("/chat/completions")) {
        return `${url}/v1/chat/completions`;
    }
    return url;
}

export async function callOpenAiCompatible({ apiKey, model, system, messages, tools, signal, baseUrl }) {
    return callOpenAi({
        apiKey,
        model,
        system,
        messages,
        tools,
        signal,
        baseUrl: buildUrl(baseUrl),
        providerName: PROVIDER,
    });
}

export async function* streamOpenAiCompatible({ apiKey, model, system, messages, tools, signal, baseUrl }) {
    yield* streamOpenAi({
        apiKey,
        model,
        system,
        messages,
        tools,
        signal,
        baseUrl: buildUrl(baseUrl),
        providerName: PROVIDER,
    });
}
