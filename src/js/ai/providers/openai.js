import { humanizeHttpError, humanizeNetworkError } from "../errors.js";
import { parseSseStream } from "../sse.js";

const API_URL = "https://api.openai.com/v1/chat/completions";
const PROVIDER = "openai";

function toOpenAiTools(tools) {
    return tools.map((t) => ({
        type: "function",
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        },
    }));
}

function systemRoleFor(model) {
    if (!model) return "system";
    return /^(gpt-5|o\d)/i.test(model) ? "developer" : "system";
}

function toOpenAiMessages(messages, system, model) {
    const out = [];
    if (system) {
        out.push({ role: systemRoleFor(model), content: system });
    }
    for (const m of messages) {
        out.push(m);
    }
    return out;
}

function buildBody({ model, system, messages, tools, stream }) {
    const body = {
        model,
        messages: toOpenAiMessages(messages, system, model),
    };
    if (tools && tools.length > 0) body.tools = toOpenAiTools(tools);
    if (stream) body.stream = true;
    return body;
}

function authHeaders(apiKey) {
    const headers = {
        "content-type": "application/json",
    };
    if (apiKey) {
        headers.authorization = `Bearer ${apiKey}`;
    }
    return headers;
}

export async function callOpenAi({
    apiKey,
    model,
    system,
    messages,
    tools,
    signal,
    baseUrl = API_URL,
    providerName = PROVIDER,
}) {
    if (import.meta.env?.DEV) {
        console.debug("[AI/OpenAI] →", { model, roleUsed: systemRoleFor(model), streaming: false });
    }
    let response;
    try {
        response = await fetch(baseUrl, {
            method: "POST",
            headers: authHeaders(apiKey),
            body: JSON.stringify(buildBody({ model, system, messages, tools, stream: false })),
            signal,
        });
    } catch (cause) {
        throw humanizeNetworkError(providerName, cause);
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw humanizeHttpError(providerName, response, errorText);
    }

    let data;
    try {
        data = await response.json();
    } catch (cause) {
        throw humanizeNetworkError(PROVIDER, new Error(`Malformed JSON response: ${cause?.message ?? cause}`));
    }
    const choice = data.choices?.[0];
    const message = choice?.message || {};

    const toolUses = (message.tool_calls || []).map((call) => {
        let input = {};
        try {
            input = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch (e) {
            console.warn("[AI] OpenAI tool argument parse failed", e);
        }
        return { id: call.id, name: call.function?.name, input };
    });

    return {
        rawAssistantMessage: message,
        text: message.content || "",
        toolUses,
        stopReason: choice?.finish_reason,
        usage: data.usage,
    };
}

/**
 * Streaming generator. Same event vocabulary as streamAnthropic.
 */
export async function* streamOpenAi({
    apiKey,
    model,
    system,
    messages,
    tools,
    signal,
    baseUrl = API_URL,
    providerName = PROVIDER,
}) {
    if (import.meta.env?.DEV) {
        console.debug("[AI/OpenAI] →", { model, roleUsed: systemRoleFor(model), streaming: true });
    }
    let response;
    try {
        response = await fetch(baseUrl, {
            method: "POST",
            headers: { ...authHeaders(apiKey), accept: "text/event-stream" },
            body: JSON.stringify(buildBody({ model, system, messages, tools, stream: true })),
            signal,
        });
    } catch (cause) {
        throw humanizeNetworkError(providerName, cause);
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw humanizeHttpError(providerName, response, errorText);
    }
    if (!response.body) {
        throw humanizeNetworkError(PROVIDER, new Error("Streaming response had no body"));
    }

    // OpenAI's tool_calls arrive as deltas with an index. We need to assemble
    // them as the stream progresses and emit completed tool_use_complete events
    // at the final delta (when finish_reason fires).
    const toolBuilders = new Map();
    let stopReason = null;

    const finalizeAndYieldToolUses = function* () {
        for (const [, t] of toolBuilders) {
            let input = {};
            try {
                input = t.argumentsJson ? JSON.parse(t.argumentsJson) : {};
            } catch (e) {
                console.warn("[AI/OpenAI] tool_call argument parse failed", e, t.argumentsJson);
            }
            yield { type: "tool_use_complete", id: t.id, name: t.name, input };
        }
        toolBuilders.clear();
    };

    try {
        for await (const sseEvent of parseSseStream(response.body, { signal })) {
            const data = sseEvent.data;
            if (!data || data === "[DONE]") {
                yield* finalizeAndYieldToolUses();
                yield { type: "message_stop", stopReason };
                return;
            }

            let payload;
            try {
                payload = JSON.parse(data);
            } catch {
                continue;
            }

            const choice = payload.choices?.[0];
            if (!choice) continue;
            const delta = choice.delta || {};

            if (typeof delta.content === "string" && delta.content.length > 0) {
                yield { type: "text_delta", text: delta.content };
            }

            if (Array.isArray(delta.tool_calls)) {
                for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolBuilders.has(idx)) {
                        toolBuilders.set(idx, {
                            id: tc.id ?? null,
                            name: tc.function?.name ?? null,
                            argumentsJson: "",
                        });
                    }
                    const builder = toolBuilders.get(idx);
                    if (tc.id) builder.id = tc.id;
                    if (tc.function?.name) builder.name = tc.function.name;
                    if (typeof tc.function?.arguments === "string") {
                        builder.argumentsJson += tc.function.arguments;
                    }
                }
            }

            if (choice.finish_reason) {
                stopReason = choice.finish_reason;
                yield* finalizeAndYieldToolUses();
                yield { type: "message_stop", stopReason };
                return;
            }
        }

        // Stream ended without [DONE] or finish_reason.
        yield* finalizeAndYieldToolUses();
        yield { type: "message_stop", stopReason };
    } catch (cause) {
        if (cause?.name === "AbortError") throw cause;
        if (cause?.kind) throw cause;
        throw humanizeNetworkError(providerName, cause);
    }
}
