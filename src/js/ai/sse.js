/**
 * Minimal Server-Sent-Events parser for ReadableStream<Uint8Array> bodies.
 * Yields { event, data } objects where:
 *   - `event` is the value after `event:` (or null if not provided)
 *   - `data` is the concatenated content of all `data:` lines for that event
 *
 * Lines starting with `:` are comments and ignored. Empty lines terminate an event.
 */
export async function* parseSseStream(stream, { signal } = {}) {
    if (!stream) return;
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const onAbort = () => {
        try {
            reader.cancel();
        } catch {
            // ignore — abort path
        }
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let sepIndex;
            while ((sepIndex = findEventBoundary(buffer)) !== -1) {
                const block = buffer.slice(0, sepIndex.start);
                buffer = buffer.slice(sepIndex.end);
                const event = parseEventBlock(block);
                if (event) yield event;
            }
        }

        // Flush any trailing event without a terminating blank line.
        buffer += decoder.decode();
        if (buffer.trim()) {
            const event = parseEventBlock(buffer);
            if (event) yield event;
        }
    } finally {
        signal?.removeEventListener("abort", onAbort);
        try {
            reader.releaseLock();
        } catch {
            // ignore
        }
    }
}

function findEventBoundary(buffer) {
    // SSE event delimiter is a blank line — accept \n\n, \r\n\r\n, or \r\r.
    const candidates = [
        { needle: "\n\n", len: 2 },
        { needle: "\r\n\r\n", len: 4 },
        { needle: "\r\r", len: 2 },
    ];
    let best = -1;
    let bestLen = 0;
    for (const c of candidates) {
        const i = buffer.indexOf(c.needle);
        if (i !== -1 && (best === -1 || i < best)) {
            best = i;
            bestLen = c.len;
        }
    }
    if (best === -1) return -1;
    return { start: best, end: best + bestLen };
}

function parseEventBlock(block) {
    let eventName = null;
    const dataLines = [];
    for (const rawLine of block.split(/\r?\n|\r/)) {
        const line = rawLine.trimEnd();
        if (!line || line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "event") {
            eventName = value;
        } else if (field === "data") {
            dataLines.push(value);
        }
        // id / retry intentionally ignored — we don't use them.
    }
    if (dataLines.length === 0) return null;
    return { event: eventName, data: dataLines.join("\n") };
}
