import { humanizeHttpError, humanizeNetworkError } from "../errors.js";
import { parseSseStream } from "../sse.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;
const PROVIDER = "anthropic";

function toAnthropicTools(tools) {
    return tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
    }));
}

function toAnthropicMessages(messages) {
    return messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
            role: m.role,
            content: m.content,
        }));
}

function buildBody({ model, system, messages, tools, stream }) {
    const body = {
        model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system,
        messages: toAnthropicMessages(messages),
    };
    if (tools && tools.length > 0) body.tools = toAnthropicTools(tools);
    if (stream) body.stream = true;
    return body;
}

function authHeaders(apiKey) {
    return {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
    };
}

export async function callAnthropic({ apiKey, model, system, messages, tools, signal }) {
    let response;
    try {
        response = await fetch(API_URL, {
            method: "POST",
            headers: authHeaders(apiKey),
            body: JSON.stringify(buildBody({ model, system, messages, tools, stream: false })),
            signal,
        });
    } catch (cause) {
        throw humanizeNetworkError(PROVIDER, cause);
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw humanizeHttpError(PROVIDER, response, errorText);
    }

    let data;
    try {
        data = await response.json();
    } catch (cause) {
        throw humanizeNetworkError(PROVIDER, new Error(`Malformed JSON response: ${cause?.message ?? cause}`));
    }

    const textParts = [];
    const toolUses = [];
    for (const block of data.content || []) {
        if (block.type === "text") {
            textParts.push(block.text);
        } else if (block.type === "tool_use") {
            toolUses.push({ id: block.id, name: block.name, input: block.input });
        }
    }

    return {
        rawAssistantContent: data.content,
        text: textParts.join("\n"),
        toolUses,
        stopReason: data.stop_reason,
        usage: data.usage,
    };
}

/**
 * Streaming generator. Yields normalized events:
 *   { type: 'text_delta', text }
 *   { type: 'tool_use_complete', id, name, input }
 *   { type: 'message_stop', stopReason }
 * Throws AiError on failure (network, HTTP, or stream errors).
 */
export async function* streamAnthropic({ apiKey, model, system, messages, tools, signal }) {
    let response;
    try {
        response = await fetch(API_URL, {
            method: "POST",
            headers: { ...authHeaders(apiKey), accept: "text/event-stream" },
            body: JSON.stringify(buildBody({ model, system, messages, tools, stream: true })),
            signal,
        });
    } catch (cause) {
        throw humanizeNetworkError(PROVIDER, cause);
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw humanizeHttpError(PROVIDER, response, errorText);
    }
    if (!response.body) {
        throw humanizeNetworkError(PROVIDER, new Error("Streaming response had no body"));
    }

    // Track tool_use blocks by content-block index; accumulate their partial JSON
    // until content_block_stop fires, then emit a single tool_use_complete event.
    const toolBuilders = new Map();
    let stopReason = null;

    try {
        for await (const sseEvent of parseSseStream(response.body, { signal })) {
            let payload;
            try {
                payload = JSON.parse(sseEvent.data);
            } catch {
                continue;
            }

            switch (payload.type) {
                case "content_block_start": {
                    const block = payload.content_block;
                    if (block?.type === "tool_use") {
                        toolBuilders.set(payload.index, {
                            id: block.id,
                            name: block.name,
                            partialJson: "",
                        });
                    }
                    break;
                }
                case "content_block_delta": {
                    const delta = payload.delta;
                    if (delta?.type === "text_delta" && typeof delta.text === "string") {
                        yield { type: "text_delta", text: delta.text };
                    } else if (delta?.type === "input_json_delta" && typeof delta.partial_json === "string") {
                        const t = toolBuilders.get(payload.index);
                        if (t) t.partialJson += delta.partial_json;
                    }
                    break;
                }
                case "content_block_stop": {
                    const t = toolBuilders.get(payload.index);
                    if (t) {
                        let input = {};
                        try {
                            input = t.partialJson ? JSON.parse(t.partialJson) : {};
                        } catch (e) {
                            console.warn("[AI/Anthropic] tool_use JSON parse failed", e, t.partialJson);
                        }
                        yield { type: "tool_use_complete", id: t.id, name: t.name, input };
                        toolBuilders.delete(payload.index);
                    }
                    break;
                }
                case "message_delta":
                    if (payload.delta?.stop_reason) stopReason = payload.delta.stop_reason;
                    break;
                case "message_stop":
                    yield { type: "message_stop", stopReason };
                    return;
                case "error": {
                    const msg = payload.error?.message ?? "Unknown stream error";
                    throw new Error(`Anthropic stream error: ${msg}`);
                }
                default:
                    // ping, message_start, etc — ignore.
                    break;
            }
        }

        // Stream ended without an explicit message_stop event (rare).
        yield { type: "message_stop", stopReason };
    } catch (cause) {
        if (cause?.name === "AbortError") throw cause;
        if (cause?.kind) throw cause; // already humanized
        throw humanizeNetworkError(PROVIDER, cause);
    }
}
