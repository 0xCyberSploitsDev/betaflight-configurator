import { useAiStore } from "@/stores/ai";
import { streamAnthropic } from "@/js/ai/providers/anthropic";
import { streamOpenAi } from "@/js/ai/providers/openai";
import { streamOpenAiCompatible } from "@/js/ai/providers/openai-compatible";
import { toolDefinitions, executeTool, confirmTool } from "@/js/ai/tools";
import { DEFAULT_SYSTEM_PROMPT } from "@/js/ai/systemPrompt";
import { switchTab } from "@/js/tab_switch";
import { requestHighlight } from "@/js/ai/navigationBus";

const MAX_TOOL_ROUNDS = 6;

/**
 * Side effect for tools that return a `_navigate` envelope (navigate_to_setting):
 * switch to the requested tab and ask the UI to highlight the target field.
 * Pure-data tools stay decoupled from the UI; the composable owns the side effect.
 */
function maybeHandleNavigation(result) {
    if (!result || typeof result !== "object" || !result._navigate || !result.tab) {
        return;
    }
    try {
        // switchTab is a no-op if we are already on the target tab, so the
        // highlight still fires below for the field-level case.
        switchTab(result.tab, { mode: "disconnected" });
        requestHighlight({ tab: result.tab, subTab: result.subTab, fieldKey: result.fieldKey });
    } catch (e) {
        console.warn("[AI] navigate_to_setting side effect failed", e);
    }
}

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
    if (provider === "openai-compatible") return streamOpenAiCompatible;
    throw new Error(`Unknown provider: ${provider}`);
}

function buildProviderArgs({ provider, apiKey, model, system, internalMessages, tools, signal, baseUrl }) {
    const args = {
        apiKey,
        model,
        system,
        tools,
        signal,
    };
    if (provider === "anthropic") {
        args.messages = messagesToAnthropic(internalMessages);
    } else {
        args.messages = messagesToOpenAi(internalMessages);
        if (provider === "openai-compatible" && baseUrl) {
            args.baseUrl = baseUrl;
        }
    }
    return args;
}

async function streamOneTurn(ai, { provider, apiKey, model, system, internalMessages, tools, signal, baseUrl }) {
    const streamer = pickStreamer(provider);
    const stream = streamer(
        buildProviderArgs({ provider, apiKey, model, system, internalMessages, tools, signal, baseUrl }),
    );

    const assistantMessage = {
        id: makeId(),
        role: "assistant",
        content: [],
        timestamp: Date.now(),
        streaming: true,
    };
    ai.appendMessage(assistantMessage);

    const liveIndex = ai.messages.length - 1;
    let textBlockIndex = -1;
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
                    ai.messages[liveIndex].content[idx].text += event.text;
                    break;
                }
                case "tool_use_complete": {
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
                    baseUrl: ai.settings.openaiCompatibleBaseUrl,
                });

                if (turn.toolUses.length === 0) break;

                const toolResults = [];
                let needsConfirmation = false;

                for (const use of turn.toolUses) {
                    const result = await executeTool(use.name, use.input);
                    const isError = Boolean(result && typeof result === "object" && "error" in result);

                    maybeHandleNavigation(result);

                    if (result && typeof result === "object" && result._requiresConfirmation) {
                        needsConfirmation = true;
                        ai.setPendingConfirmation({
                            toolName: use.name,
                            toolUseId: use.id,
                            input: use.input,
                            description: result.description || `Execute ${use.name}`,
                        });
                        // Store the proposed result so the card shows the waiting state
                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: use.id,
                            content: JSON.stringify({ _awaitingConfirmation: true, description: result.description }),
                        });
                    } else {
                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: use.id,
                            content: typeof result === "string" ? result : JSON.stringify(result),
                            ...(isError ? { is_error: true } : {}),
                        });
                    }
                }

                ai.appendMessage({
                    id: makeId(),
                    role: "user",
                    content: toolResults,
                    timestamp: Date.now(),
                });

                if (needsConfirmation) break;
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

    async function confirmPendingTool() {
        const pc = ai.pendingConfirmation;
        if (!pc) return;

        ai.clearPendingConfirmation();
        ai.isStreaming = true;

        try {
            const result = await confirmTool(pc.toolName, pc.input);
            const isError = Boolean(result && typeof result === "object" && "error" in result);

            const toolResult = {
                type: "tool_result",
                tool_use_id: pc.toolUseId,
                content: typeof result === "string" ? result : JSON.stringify(result),
                ...(isError ? { is_error: true } : {}),
            };

            // Update the last user message's tool_result for this tool_use_id
            const lastUserMsg = ai.messages.filter((m) => m.role === "user").slice(-1)[0];
            if (lastUserMsg) {
                const idx = lastUserMsg.content.findIndex(
                    (c) => c.type === "tool_result" && c.tool_use_id === pc.toolUseId,
                );
                if (idx !== -1) {
                    lastUserMsg.content[idx] = toolResult;
                } else {
                    lastUserMsg.content.push(toolResult);
                }
            }

            // Give the LLM one more turn to respond to the result
            const tools = toolDefinitions();
            const system = ai.settings.systemPromptOverride?.trim() || DEFAULT_SYSTEM_PROMPT;

            for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
                const internalMessages = ai.messages.map((m) => ({ role: m.role, content: m.content }));
                const turn = await streamOneTurn(ai, {
                    provider: ai.settings.provider,
                    apiKey: ai.activeApiKey,
                    model: ai.activeModel,
                    system,
                    internalMessages,
                    tools,
                    signal: abortController?.signal,
                    baseUrl: ai.settings.openaiCompatibleBaseUrl,
                });

                if (turn.toolUses.length === 0) break;

                // If the model generates more tool calls after confirmation,
                // execute them immediately (user already confirmed intent)
                const postResults = await Promise.all(
                    turn.toolUses.map(async (use) => {
                        const r = await executeTool(use.name, use.input);
                        maybeHandleNavigation(r);
                        const finalResult =
                            r && typeof r === "object" && r._requiresConfirmation
                                ? await confirmTool(use.name, use.input)
                                : r;
                        const fe = Boolean(finalResult && typeof finalResult === "object" && "error" in finalResult);
                        return {
                            type: "tool_result",
                            tool_use_id: use.id,
                            content: typeof finalResult === "string" ? finalResult : JSON.stringify(finalResult),
                            ...(fe ? { is_error: true } : {}),
                        };
                    }),
                );

                ai.appendMessage({
                    id: makeId(),
                    role: "user",
                    content: postResults,
                    timestamp: Date.now(),
                });
            }
        } catch (e) {
            console.error("[AI] Confirm tool error", e);
            ai.lastError = e?.message ?? String(e);
        } finally {
            ai.isStreaming = false;
        }
    }

    async function rejectPendingTool() {
        const pc = ai.pendingConfirmation;
        if (!pc) return;

        ai.clearPendingConfirmation();

        const toolResult = {
            type: "tool_result",
            tool_use_id: pc.toolUseId,
            content: JSON.stringify({ cancelled: true, message: "User rejected the change" }),
        };

        const lastUserMsg = ai.messages.filter((m) => m.role === "user").slice(-1)[0];
        if (lastUserMsg) {
            const idx = lastUserMsg.content.findIndex(
                (c) => c.type === "tool_result" && c.tool_use_id === pc.toolUseId,
            );
            if (idx !== -1) {
                lastUserMsg.content[idx] = toolResult;
            } else {
                lastUserMsg.content.push(toolResult);
            }
        }

        ai.isStreaming = true;

        try {
            const tools = toolDefinitions();
            const system = ai.settings.systemPromptOverride?.trim() || DEFAULT_SYSTEM_PROMPT;

            for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
                const internalMessages = ai.messages.map((m) => ({ role: m.role, content: m.content }));
                const turn = await streamOneTurn(ai, {
                    provider: ai.settings.provider,
                    apiKey: ai.activeApiKey,
                    model: ai.activeModel,
                    system,
                    internalMessages,
                    tools,
                    signal: abortController?.signal,
                    baseUrl: ai.settings.openaiCompatibleBaseUrl,
                });

                if (turn.toolUses.length === 0) break;

                const postResults = await Promise.all(
                    turn.toolUses.map(async (use) => {
                        const r = await executeTool(use.name, use.input);
                        maybeHandleNavigation(r);
                        const finalResult =
                            r && typeof r === "object" && r._requiresConfirmation
                                ? await confirmTool(use.name, use.input)
                                : r;
                        const fe = Boolean(finalResult && typeof finalResult === "object" && "error" in finalResult);
                        return {
                            type: "tool_result",
                            tool_use_id: use.id,
                            content: typeof finalResult === "string" ? finalResult : JSON.stringify(finalResult),
                            ...(fe ? { is_error: true } : {}),
                        };
                    }),
                );

                ai.appendMessage({
                    id: makeId(),
                    role: "user",
                    content: postResults,
                    timestamp: Date.now(),
                });
            }
        } catch (_e) {
            console.error("[AI] Post-reject stream error", _e);
        } finally {
            ai.isStreaming = false;
        }
    }

    function cancel() {
        if (abortController) abortController.abort();
    }

    return {
        sendUserMessage,
        confirmPendingTool,
        rejectPendingTool,
        cancel,
    };
}
