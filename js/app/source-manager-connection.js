const NAVIGATION_FIELDS = Object.freeze([
    'pathname',
    'search',
    'hash',
    'replaceState'
]);
const OAUTH_QUERY_FIELDS = new Set(['code', 'state', 'error', 'scope']);

const CONNECTION_SNAPSHOT = Object.freeze({
    schemaVersion: 1,
    status: 'authorization_unavailable',
    code: 'AUTHORIZATION_UNAVAILABLE',
    actions: Object.freeze({
        connect: false,
        disconnect: false
    })
});
const CONNECTION_CLOSED = Object.freeze({ status: 'closed' });
const AUTHORIZATION_UNAVAILABLE = Object.freeze({
    code: 'AUTHORIZATION_UNAVAILABLE'
});
const CLOSED_ERROR = Object.freeze({ code: 'CONNECTION_CLOSED' });
const NAVIGATION_BLOCKED = Object.freeze({
    status: 'blocked',
    sessionMode: null,
    code: 'NAVIGATION_SANITIZATION_FAILED'
});
const CLEAN_REAL = Object.freeze({ status: 'clean', sessionMode: 'real' });
const CLEAN_DEMO = Object.freeze({ status: 'clean', sessionMode: 'demo' });
const SANITIZED_REAL = Object.freeze({ status: 'sanitized', sessionMode: 'real' });
const SANITIZED_DEMO = Object.freeze({ status: 'sanitized', sessionMode: 'demo' });

function exactNavigationInput(value) {
    try {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== NAVIGATION_FIELDS.length
            || keys.some(key => typeof key !== 'string' || !NAVIGATION_FIELDS.includes(key))
        ) return null;
        const result = Object.create(null);
        for (const field of NAVIGATION_FIELDS) {
            const descriptor = Object.getOwnPropertyDescriptor(value, field);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            result[field] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function scrub(replaceState, path) {
    try {
        Reflect.apply(replaceState, null, [null, '', path]);
        return true;
    } catch {
        return false;
    }
}

function parsedNavigationMode(search) {
    if (search === '') return Object.freeze({ mode: null, trustedFields: true });
    if (!search.startsWith('?') || search.length === 1) {
        return Object.freeze({ mode: null, trustedFields: false });
    }
    try {
        decodeURIComponent(search);
        const params = new URLSearchParams(search);
        const entries = Array.from(params.entries());
        const trustedFields = entries.length > 0 && entries.every(([key]) => (
            key === 'mode' || OAUTH_QUERY_FIELDS.has(key)
        ));
        const modes = entries.filter(([key]) => key === 'mode').map(([, value]) => value);
        const mode = modes.length === 1 && (modes[0] === 'real' || modes[0] === 'demo')
            ? modes[0]
            : null;
        return Object.freeze({ mode, trustedFields });
    } catch {
        return Object.freeze({ mode: null, trustedFields: false });
    }
}

export function sanitizeSourceManagerNavigation(value) {
    const input = exactNavigationInput(value);
    if (
        input === null
        || input.pathname !== '/source-manager.html'
        || typeof input.search !== 'string'
        || typeof input.hash !== 'string'
        || typeof input.replaceState !== 'function'
    ) return NAVIGATION_BLOCKED;

    if (input.hash === '') {
        if (input.search === '') return CLEAN_REAL;
        if (input.search === '?mode=real') return CLEAN_REAL;
        if (input.search === '?mode=demo') return CLEAN_DEMO;
    }

    const parsed = parsedNavigationMode(input.search);
    const preservedMode = parsed.trustedFields ? parsed.mode : null;
    const path = preservedMode === null
        ? '/source-manager.html'
        : `/source-manager.html?mode=${preservedMode}`;
    if (!scrub(input.replaceState, path)) return NAVIGATION_BLOCKED;
    if (preservedMode === 'real') return SANITIZED_REAL;
    if (preservedMode === 'demo') return SANITIZED_DEMO;
    return NAVIGATION_BLOCKED;
}

export function createSourceManagerConnectionController() {
    let closed = false;
    const unavailable = () => Promise.reject(
        closed ? CLOSED_ERROR : AUTHORIZATION_UNAVAILABLE
    );
    return Object.freeze({
        getConnectionSnapshot() {
            return CONNECTION_SNAPSHOT;
        },
        beginConnect: unavailable,
        disconnect: unavailable,
        async close() {
            closed = true;
            return CONNECTION_CLOSED;
        }
    });
}
