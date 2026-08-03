let speedInsightsInitialized = false;
const SPEED_INSIGHTS_PATH = '/_vercel/speed-insights/script.js';
const SPEED_INSIGHTS_SDK_NAME = '@vercel/speed-insights';
const SPEED_INSIGHTS_SDK_VERSION = '2.0.0';

function isLocalHostname(hostname) {
    const normalizedHostname = typeof hostname === 'string'
        ? hostname.toLowerCase()
        : '';
    return normalizedHostname === 'localhost'
        || normalizedHostname.endsWith('.localhost')
        || normalizedHostname === '127.0.0.1'
        || normalizedHostname === '::1'
        || normalizedHostname === '[::1]';
}

function hasSpeedInsightsScript(documentObject, scriptUrl) {
    return Array.from(documentObject.scripts).some(script => {
        const source = script.getAttribute('src');
        if (source === null) return false;
        try {
            return new URL(source, scriptUrl).href === scriptUrl.href;
        } catch {
            return false;
        }
    });
}

function ensureSpeedInsightsQueue(windowObject) {
    if (typeof windowObject.si === 'function') return;
    const queue = Array.isArray(windowObject.siq) ? windowObject.siq : [];
    windowObject.siq = queue;
    windowObject.si = (...args) => {
        queue.push(args);
    };
}

export function setupSpeedInsights() {
    if (speedInsightsInitialized
        || typeof window === 'undefined'
        || typeof document === 'undefined') return;

    if (isLocalHostname(window.location?.hostname)) return;

    let scriptUrl;
    try {
        scriptUrl = new URL(SPEED_INSIGHTS_PATH, window.location.origin);
    } catch {
        return;
    }
    if (scriptUrl.origin !== window.location.origin) return;

    speedInsightsInitialized = true;
    if (hasSpeedInsightsScript(document, scriptUrl)) return;

    ensureSpeedInsightsQueue(window);
    const script = document.createElement('script');
    script.src = scriptUrl.href;
    script.defer = true;
    script.dataset.sdkn = SPEED_INSIGHTS_SDK_NAME;
    script.dataset.sdkv = SPEED_INSIGHTS_SDK_VERSION;
    script.addEventListener('error', () => {
        console.error('Speed Insights script failed to load.');
    }, { once: true });
    document.head.appendChild(script);
}

setupSpeedInsights();
