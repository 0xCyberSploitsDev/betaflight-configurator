const SITEMAP_URL = "https://betaflight.com/sitemap.xml";
const CACHE_TTL_MS = 60 * 60 * 1000;

let cache = null;

async function loadSitemapDocsUrls() {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.urls;
    }
    const response = await fetch(SITEMAP_URL);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching sitemap`);
    }
    const xml = await response.text();
    const urls = [...xml.matchAll(/<loc>(https:\/\/betaflight\.com\/docs\/[^<]+)<\/loc>/g)].map((m) => m[1]);
    cache = { urls, fetchedAt: Date.now() };
    return urls;
}

function scoreMatch(url, terms) {
    const lower = url.toLowerCase();
    let score = 0;
    for (const t of terms) {
        if (lower.includes(t)) {
            score += 1;
            const seg = lower.split("/").pop() || "";
            if (seg.includes(t)) score += 1;
        }
    }
    return score;
}

export const listBetaflightDocsTool = {
    name: "list_betaflight_docs",
    description:
        "List Betaflight documentation page URLs from the official site map. Use this BEFORE fetch_betaflight_docs to discover the correct URL — do not guess URLs. Optionally filter by a query string (case-insensitive substring match across the URL).",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description:
                    "Optional space-separated keywords. Returned URLs are ranked by how many keywords appear in the URL path. Leave empty to get the full list (capped at 50).",
            },
            limit: {
                type: "number",
                description: "Max results to return (default 20, max 50).",
            },
        },
    },
    async execute({ query, limit }) {
        const cap = Math.max(1, Math.min(50, Number(limit) || 20));
        try {
            const urls = await loadSitemapDocsUrls();
            const terms = (query || "")
                .toLowerCase()
                .split(/\s+/)
                .map((t) => t.trim())
                .filter(Boolean);

            let results;
            if (terms.length === 0) {
                results = urls.slice(0, cap);
            } else {
                results = urls
                    .map((url) => ({ url, score: scoreMatch(url, terms) }))
                    .filter((r) => r.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, cap)
                    .map((r) => r.url);
            }

            return {
                query: query || null,
                count: results.length,
                totalAvailable: urls.length,
                urls: results,
            };
        } catch (e) {
            return { error: `Failed to load sitemap: ${e?.message ?? String(e)}` };
        }
    },
};
