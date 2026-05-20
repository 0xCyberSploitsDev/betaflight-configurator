import { useAiStore } from "@/stores/ai";
import { streamAnthropic } from "@/js/ai/providers/anthropic";
import { streamOpenAi } from "@/js/ai/providers/openai";
import { toolDefinitions, executeTool } from "@/js/ai/tools";
import { DEFAULT_SYSTEM_PROMPT } from "@/js/ai/systemPrompt";

const MAX_TOOL_ROUNDS = 6;

function makeId() {
    return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function messagesToAnthropic(messages) {
    return messages.map((m) => ({ role: m.role, content: m.content }));
}

function messagesToOpenAi(messages) {
    const out = [];
    for (const m of messages) {
        if (m.role === "user") {
            const textParts = m.content.filter((c) => c.type === "text").map((c) => c.text);
            const toolResults = m.content.filter((c) => c.type === "tool_result");
            if (textParts.length > 0) {
                out.push({ role: "user", content: textParts.join("\n") });
            }
            for (const r of toolResults) {
                out.push({
                    role: "tool",
                    tool_call_id: r.tool_use_id,
                    content: typeof r.content === "string" ? r.content : JSON.stringify(r.content),
                });
            }
        } else if (m.role === "assistant") {
            const textParts = m.content.filter((c) => c.type === "text").map((c) => c.text);
            const toolUses = m.content.filter((c) => c.type === "tool_use");
            const msg = {
                role: "assistant",
                content: textParts.join("\n") || null,
            };
            if (toolUses.length > 0) {
                msg.tool_calls = toolUses.map((t) => ({
                    id: t.id,
                    type: "function",
                    function: { name: t.name, arguments: JSON.stringify(t.input ?? {}) },
                }));
            }
            out.push(msg);
        }
    }
    return out;
}

function pickStreamer(provider) {
    if (provider === "anthropic") return streamAnthropic;
    if (provider === "openai") return streamOpenAi;
    throw new Error(`Unknown provider: ${provider}`);
}

function buildProviderArgs({ provider, apiKey, model, system, internalMessages, tools, signal }) {
    return {
        apiKey,
        model,
        system,
        messages: provider === "anthropic" ? messagesToAnthropic(internalMessages) : messagesToOpenAi(internalMessages),
        tools,
        signal,
    };
}

/**
 * Stream one turn into the in-store assistant message and return the list
 * of tool uses the model issued (empty array if the turn was pure text).
 */
async function streamOneTurn(ai, { provider, apiKey, model, system, internalMessages, tools, signal }) {
    const streamer = pickStreamer(provider);
    const stream = streamer(buildProviderArgs({ provider, apiKey, model, system, internalMessages, tools, signal }));

    // Create the live assistant message we'll mutate as deltas arrive.
    // Vue reactivity will redraw the bubble on each push/update.
    const assistantMessage = {
        id: makeId(),
        role: "assistant",
        content: [],
        timestamp: Date.now(),
        streaming: true,
    };
    ai.appendMessage(assistantMessage);

    const liveIndex = ai.messages.length - 1;
    let textBlockIndex = -1; // index into ai.messages[liveIndex].content of the active text block
    const toolUses = [];

    const ensureTextBlock = () => {
        if (textBlockIndex === -1) {
            ai.messages[liveIndex].content.push({ type: "text", text: "" });
            textBlockIndex = ai.messages[liveIndex].content.length - 1;
        }
        return textBlockIndex;
    };

    try {
        for await (const event of stream) {
            switch (event.type) {
                case "text_delta": {
                    const idx = ensureTextBlock();
                    // Mutate through the proxy (array index access) so Vue
                    // reactivity fires on every delta, not just the first.
                    ai.messages[liveIndex].content[idx].text += event.text;
                    break;
                }
                case "tool_use_complete": {
                    // End the current text block so any further text starts a new one,
                    // preserving the assistant's interleaved text + tool_use order.
                    textBlockIndex = -1;
                    ai.messages[liveIndex].content.push({
                        type: "tool_use",
                        id: event.id,
                        name: event.name,
                        input: event.input,
                    });
                    toolUses.push({ id: event.id, name: event.name, input: event.input });
                    break;
                }
                case "message_stop":
                    break;
                default:
                    break;
            }
        }
    } finally {
        ai.messages[liveIndex].streaming = false;
    }

    return { toolUses };
}

export function useAiChat() {
    const ai = useAiStore();
    let abortController = null;

    async function sendUserMessage(text) {
        const trimmed = text.trim();
        if (!trimmed) return;
        if (!ai.isConfigured) {
            ai.lastError = "Set an API key in AI settings first.";
            ai.openSettings();
            return;
        }
        if (ai.isStreaming) return;

        ai.clearError();
        ai.isStreaming = true;
        abortController = new AbortController();

        ai.appendMessage({
            id: makeId(),
            role: "user",
            content: [{ type: "text", text: trimmed }],
            timestamp: Date.now(),
        });

        const tools = toolDefinitions();
        const system = ai.settings.systemPromptOverride?.trim() || DEFAULT_SYSTEM_PROMPT;

        try {
            for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
                const internalMessages = ai.messages.map((m) => ({ role: m.role, content: m.content }));
                const turn = await streamOneTurn(ai, {
                    provider: ai.settings.provider,
                    apiKey: ai.activeApiKey,
                    model: ai.activeModel,
                    system,
                    internalMessages,
                    tools,
                    signal: abortController.signal,
                });

                if (turn.toolUses.length === 0) break;

                const toolResults = await Promise.all(
                    turn.toolUses.map(async (use) => {
                        const result = await executeTool(use.name, use.input);
                        const isError = Boolean(result && typeof result === "object" && "error" in result);
                        // Schema must match Anthropic's tool_result content block exactly —
                        // any extra fields trigger "Extra inputs are not permitted". The UI
                        // already gets the tool name from the paired tool_use block.
                        return {
                            type: "tool_result",
                            tool_use_id: use.id,
                            content: typeof result === "string" ? result : JSON.stringify(result),
                            ...(isError ? { is_error: true } : {}),
                        };
                    }),
                );

                ai.appendMessage({
                    id: makeId(),
                    role: "user",
                    content: toolResults,
                    timestamp: Date.now(),
                });
            }
        } catch (e) {
            if (e?.name === "AbortError" || e?.kind === "abort") {
                ai.lastError = "Request cancelled.";
                ai.lastErrorKind = "abort";
                ai.lastErrorRetryable = false;
            } else {
                console.error("[AI] Chat error", e);
                ai.lastError = e?.message ?? String(e);
                ai.lastErrorKind = e?.kind ?? null;
                ai.lastErrorRetryable = Boolean(e?.retryable);
            }
        } finally {
            ai.isStreaming = false;
            abortController = null;
        }
    }

    function cancel() {
        if (abortController) abortController.abort();
    }

    return {
        sendUserMessage,
        cancel,
    };
}
