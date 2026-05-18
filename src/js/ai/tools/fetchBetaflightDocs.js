const ALLOWED_HOST = "betaflight.com";

function isAllowedUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") {
            return false;
        }
        return parsed.host === ALLOWED_HOST || parsed.host.endsWith(`.${ALLOWED_HOST}`);
    } catch {
        return false;
    }
}

function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

export const fetchBetaflightDocsTool = {
    name: "fetch_betaflight_docs",
    description:
        "Fetch a public Betaflight documentation page and return the text content. Only URLs under betaflight.com are allowed. Use this when you need authoritative info about a Betaflight feature, CLI command, or setting.",
    parameters: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description:
                    "Full https URL on betaflight.com (e.g. https://betaflight.com/docs/wiki/configuration/pid-tuning).",
            },
        },
        required: ["url"],
    },
    async execute({ url }) {
        if (!isAllowedUrl(url)) {
            return { error: `URL not allowed. Must be on https://${ALLOWED_HOST}/.` };
        }
        try {
            const response = await fetch(url, { method: "GET" });
            if (!response.ok) {
                return { error: `HTTP ${response.status} for ${url}` };
            }
            const html = await response.text();
            const text = stripHtml(html);
            const MAX_CHARS = 12000;
            return {
                url,
                text: text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n…(truncated)` : text,
                truncated: text.length > MAX_CHARS,
            };
        } catch (e) {
            return { error: `Fetch failed: ${e?.message ?? String(e)}` };
        }
    },
};
