const NAVIGATION_FIELDS = Object.freeze([
    'pathname',
    'search',
    'hash',
    'replaceState'
]);
const OAUTH_QUERY_FIELDS = new Set(['code', 'state', 'error', 'scope']);

const CONNECTION_CLOSED = Object.freeze({ status: 'closed' });
const CLOSED_ERROR = Object.freeze({ code: 'CONNECTION_CLOSED' });
const INITIALIZATION_ERROR = Object.freeze({
    code: 'CONNECTION_INITIALIZATION_FAILED'
});
const NAVIGATION_BLOCKED = Object.freeze({
    status: 'blocked',
    sessionMode: null,
    code: 'NAVIGATION_SANITIZATION_FAILED'
});
const SCRUBBED_NAVIGATION_BLOCKED = Object.freeze({
    status: 'blocked',
    sessionMode: null,
    code: 'NAVIGATION_SANITIZATION_FAILED',
    discardAuthorizationState: true
});
const CLEAN_REAL = Object.freeze({ status: 'clean', sessionMode: 'real' });
const CLEAN_DEMO = Object.freeze({ status: 'clean', sessionMode: 'demo' });
const SANITIZED_REAL = Object.freeze({ status: 'sanitized', sessionMode: 'real' });
const SANITIZED_DEMO = Object.freeze({ status: 'sanitized', sessionMode: 'demo' });

const SAFE_ERROR_CODES = new Set([
    'AUTHORIZATION_INVALID_REQUEST',
    'AUTHORIZATION_STATE_UNAVAILABLE',
    'AUTHORIZATION_STATE_INVALID',
    'AUTHORIZATION_STATE_EXPIRED',
    'AUTHORIZATION_ACCESS_DENIED',
    'AUTHORIZATION_CONFIG_FAILED',
    'AUTHORIZATION_EXCHANGE_FAILED',
    'AUTHORIZATION_TOKEN_INVALID',
    'IDENTITY_MISMATCH',
    'IDENTITY_UNCONFIRMED',
    'TOKEN_WRITE_FAILED',
    'TOKEN_REMOVAL_FAILED',
    'CONNECTION_INITIALIZATION_FAILED',
    'CONNECTION_UPDATE_FAILED',
    'CONNECTION_ACTION_UNAVAILABLE'
]);

function fixedError(code) {
    return Object.freeze({ code: SAFE_ERROR_CODES.has(code) ? code : 'CONNECTION_UPDATE_FAILED' });
}

function safeErrorCode(value, fallback = 'CONNECTION_UPDATE_FAILED') {
    try {
        const descriptor = value && Object.getOwnPropertyDescriptor(value, 'code');
        return descriptor && Object.hasOwn(descriptor, 'value')
            && SAFE_ERROR_CODES.has(descriptor.value)
            ? descriptor.value
            : fallback;
    } catch {
        return fallback;
    }
}

function snapshot(status, code = null, localAuthority = false) {
    return Object.freeze({
        schemaVersion: 1,
        status,
        code,
        actions: Object.freeze({
            connect: status === 'unconfigured' || status === 'disconnected',
            reconnect: status === 'reconnect_required',
            sync: false,
            disconnect: status === 'connected' || (status === 'error' && localAuthority)
        })
    });
}

function dataProperty(value, key) {
    try {
        if (value === null || typeof value !== 'object') return undefined;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor && Object.hasOwn(descriptor, 'value')
            ? descriptor.value
            : undefined;
    } catch {
        return undefined;
    }
}

function connectionDependencies(value) {
    const authorization = dataProperty(value, 'authorization');
    const authLifecycle = dataProperty(value, 'authLifecycle');
    const connectionStore = dataProperty(value, 'connectionStore');
    const callback = dataProperty(value, 'callback');
    const awaitInactiveSyncBoundary = dataProperty(value, 'awaitInactiveSyncBoundary');
    const methods = [
        [authorization, ['beginAuthorization', 'processCallback', 'close']],
        [authLifecycle, [
            'inspectTokenAuthority', 'acceptOAuthTokenResponse',
            'expireToken', 'disconnect'
        ]],
        [connectionStore, [
            'initialize', 'getConnection', 'createConnection',
            'transitionConnection', 'close'
        ]]
    ];
    for (const [dependency, names] of methods) {
        if (!dependency || names.some(name => typeof dataProperty(dependency, name) !== 'function')) {
            return null;
        }
    }
    if (
        awaitInactiveSyncBoundary !== undefined
        && typeof awaitInactiveSyncBoundary !== 'function'
    ) return null;
    return Object.freeze({
        authorization,
        authLifecycle,
        connectionStore,
        callback,
        awaitInactiveSyncBoundary: awaitInactiveSyncBoundary ?? (async () => undefined)
    });
}

function subjectFromToken(token) {
    const value = dataProperty(token, 'subject_id');
    return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? value : null;
}

function transitionInput(current, status, errorCode) {
    return {
        id: 'source-connection:strava',
        expectedRevision: current.revision,
        status,
        lastSyncAt: current.lastSyncAt,
        errorCode
    };
}

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
    if (search === '') return Object.freeze({
        mode: null, trustedFields: true, entries: Object.freeze([])
    });
    if (!search.startsWith('?') || search.length === 1) {
        return Object.freeze({ mode: null, trustedFields: false, entries: Object.freeze([]) });
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
        return Object.freeze({
            mode,
            trustedFields,
            entries: Object.freeze(entries.map(entry => Object.freeze([...entry])))
        });
    } catch {
        return Object.freeze({ mode: null, trustedFields: false, entries: Object.freeze([]) });
    }
}

function callbackCapsule(entries, hash, mode) {
    const callbackEntries = entries.filter(([key]) => OAUTH_QUERY_FIELDS.has(key));
    if (callbackEntries.length === 0) return null;
    if (mode !== 'real' || hash !== '') return undefined;
    const map = new Map(callbackEntries);
    if (map.size !== callbackEntries.length) return undefined;
    const state = map.get('state');
    if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state)) {
        return undefined;
    }
    if (
        callbackEntries.length === 2
        && map.get('error') === 'access_denied'
        && map.has('state')
    ) {
        return Object.freeze({ kind: 'denied', state });
    }
    const code = map.get('code');
    if (
        callbackEntries.length !== 3
        || !map.has('state')
        || map.get('scope') !== 'read,activity:read_all'
        || typeof code !== 'string'
        || code.length === 0
        || code.length > 512
        || code.trim().length === 0
    ) return undefined;
    return Object.freeze({
        kind: 'code',
        code,
        state,
        grantedScopes: Object.freeze(['read', 'activity:read_all'])
    });
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
    const callback = parsed.trustedFields
        ? callbackCapsule(parsed.entries, input.hash, preservedMode)
        : undefined;
    const path = preservedMode === null
        ? '/source-manager.html'
        : `/source-manager.html?mode=${preservedMode}`;
    if (!scrub(input.replaceState, path)) return NAVIGATION_BLOCKED;
    if (callback === undefined) return SCRUBBED_NAVIGATION_BLOCKED;
    if (callback !== null) {
        return Object.freeze({
            status: 'sanitized',
            sessionMode: 'real',
            callback
        });
    }
    if (preservedMode === 'real') return SANITIZED_REAL;
    if (preservedMode === 'demo') return SANITIZED_DEMO;
    return SCRUBBED_NAVIGATION_BLOCKED;
}

export function createSourceManagerConnectionController(options) {
    const dependencies = connectionDependencies(options);
    let closed = false;
    let initialized = false;
    let initializing = null;
    let disconnecting = null;
    let current = null;
    let localAuthority = false;
    let currentSnapshot = snapshot(
        'error',
        'CONNECTION_INITIALIZATION_FAILED'
    );

    function setSnapshot(status, code = null, authority = localAuthority) {
        if (closed && status !== 'closed') return currentSnapshot;
        currentSnapshot = snapshot(status, code, authority);
        return currentSnapshot;
    }

    function result(status, code) {
        return Object.freeze(code === undefined ? { status } : { status, code });
    }

    function rollbackAcceptedToken() {
        let status = 'token-removal-failed';
        try {
            status = dataProperty(dependencies.authLifecycle.expireToken(), 'status');
        } catch {}
        localAuthority = false;
        return status;
    }

    function deriveSnapshot() {
        const authority = dependencies.authLifecycle.inspectTokenAuthority();
        const authorityStatus = dataProperty(authority, 'status');
        const authoritySubject = dataProperty(authority, 'subjectId');
        localAuthority = authorityStatus === 'authority'
            && current !== null
            && authoritySubject === current.subjectId;
        if (current === null) {
            if (authorityStatus === 'absent') return setSnapshot('unconfigured');
            return setSnapshot('reconnect_required', 'AUTHORIZATION_REQUIRED', false);
        }
        if (localAuthority && current.status === 'connected') {
            return setSnapshot('connected', null, true);
        }
        if (localAuthority && current.status === 'error') {
            return setSnapshot('error', 'CONNECTION_ERROR', true);
        }
        if (current.status === 'disconnected' && authorityStatus === 'absent') {
            return setSnapshot('disconnected', current.errorCode, false);
        }
        return setSnapshot('reconnect_required', 'AUTHORIZATION_REQUIRED', false);
    }

    async function processCallback() {
        setSnapshot('callback_processing');
        let authorized;
        try {
            authorized = await dependencies.authorization.processCallback(dependencies.callback);
        } catch (error) {
            if (closed) return CONNECTION_CLOSED;
            const code = safeErrorCode(error);
            setSnapshot('error', code, false);
            return result('error', code);
        }
        if (closed) return CONNECTION_CLOSED;
        const token = dataProperty(authorized, 'token');
        const subjectId = subjectFromToken(token);
        if (subjectId === null) {
            setSnapshot('error', 'AUTHORIZATION_TOKEN_INVALID', false);
            return result('error', 'AUTHORIZATION_TOKEN_INVALID');
        }
        if (current !== null && current.subjectId !== subjectId) {
            setSnapshot('error', 'IDENTITY_MISMATCH', false);
            return result('error', 'IDENTITY_MISMATCH');
        }

        let accepted;
        try {
            accepted = await dependencies.authLifecycle.acceptOAuthTokenResponse(
                token,
                () => !closed
            );
        } catch {
            if (closed) return CONNECTION_CLOSED;
            setSnapshot('error', 'IDENTITY_UNCONFIRMED', false);
            return result('error', 'IDENTITY_UNCONFIRMED');
        }
        const acceptance = dataProperty(accepted, 'status');
        if (closed) {
            if (acceptance === 'success') rollbackAcceptedToken();
            return CONNECTION_CLOSED;
        }
        if (acceptance !== 'success') {
            const code = acceptance === 'identity-mismatch'
                ? 'IDENTITY_MISMATCH'
                : acceptance === 'token-write-failed'
                    ? 'TOKEN_WRITE_FAILED'
                    : 'IDENTITY_UNCONFIRMED';
            setSnapshot('error', code, false);
            return result('error', code);
        }

        try {
            if (current === null) {
                current = await dependencies.connectionStore.createConnection({
                    id: 'source-connection:strava',
                    provider: 'strava',
                    subjectId,
                    status: 'connected',
                    lastSyncAt: null,
                    errorCode: null,
                    revision: 1
                });
            } else if (current.status !== 'connected') {
                current = await dependencies.connectionStore.transitionConnection(
                    transitionInput(current, 'connected', null)
                );
            }
        } catch {
            const rollbackStatus = rollbackAcceptedToken();
            if (closed) return CONNECTION_CLOSED;
            const code = rollbackStatus === 'token-removal-failed'
                ? 'TOKEN_REMOVAL_FAILED'
                : 'CONNECTION_UPDATE_FAILED';
            setSnapshot('error', code, false);
            return result('error', code);
        }
        if (closed) {
            rollbackAcceptedToken();
            return CONNECTION_CLOSED;
        }
        localAuthority = true;
        setSnapshot('connected', null, true);
        return result('connected');
    }

    async function initialize() {
        if (closed) throw CLOSED_ERROR;
        if (initialized) return result(currentSnapshot.status, currentSnapshot.code ?? undefined);
        if (initializing) return initializing;
        if (!dependencies) {
            initialized = true;
            return result('error', INITIALIZATION_ERROR.code);
        }
        if (dependencies.callback !== null && dependencies.callback !== undefined) {
            setSnapshot('callback_processing');
        }
        initializing = (async () => {
            try {
                await dependencies.connectionStore.initialize();
                if (closed) return CONNECTION_CLOSED;
                current = await dependencies.connectionStore.getConnection('strava');
            } catch {
                if (closed) return CONNECTION_CLOSED;
                initialized = true;
                setSnapshot('error', 'CONNECTION_INITIALIZATION_FAILED', false);
                return result('error', 'CONNECTION_INITIALIZATION_FAILED');
            }
            if (closed) return CONNECTION_CLOSED;
            initialized = true;
            if (dependencies.callback !== null && dependencies.callback !== undefined) {
                return processCallback();
            }
            deriveSnapshot();
            return result(currentSnapshot.status, currentSnapshot.code ?? undefined);
        })();
        try {
            return await initializing;
        } finally {
            initializing = null;
        }
    }

    async function beginConnect() {
        if (closed) throw CLOSED_ERROR;
        if (!dependencies || !initialized) throw INITIALIZATION_ERROR;
        if (!currentSnapshot.actions.connect && !currentSnapshot.actions.reconnect) {
            throw fixedError('CONNECTION_ACTION_UNAVAILABLE');
        }
        setSnapshot('authorizing');
        try {
            await dependencies.authorization.beginAuthorization();
            if (closed) return CONNECTION_CLOSED;
            return result('authorizing');
        } catch (error) {
            if (closed) return CONNECTION_CLOSED;
            const code = safeErrorCode(error);
            setSnapshot('error', code, localAuthority);
            throw fixedError(code);
        }
    }

    async function refresh() {
        if (closed) throw CLOSED_ERROR;
        if (!dependencies || !initialized) throw INITIALIZATION_ERROR;
        if (disconnecting !== null) throw fixedError('CONNECTION_ACTION_UNAVAILABLE');
        try {
            current = await dependencies.connectionStore.getConnection('strava');
        } catch {
            setSnapshot('error', 'CONNECTION_UPDATE_FAILED', false);
            return result('error', 'CONNECTION_UPDATE_FAILED');
        }
        deriveSnapshot();
        return result(currentSnapshot.status, currentSnapshot.code ?? undefined);
    }

    async function disconnect() {
        if (closed) throw CLOSED_ERROR;
        if (!dependencies || !initialized) throw INITIALIZATION_ERROR;
        if (!currentSnapshot.actions.disconnect || current === null) {
            throw fixedError('CONNECTION_ACTION_UNAVAILABLE');
        }
        setSnapshot('disconnecting');
        try {
            disconnecting = (async () => {
                try {
                    await Reflect.apply(dependencies.awaitInactiveSyncBoundary, null, []);
                } catch {
                    if (closed) return CONNECTION_CLOSED;
                    setSnapshot('error', 'CONNECTION_UPDATE_FAILED', localAuthority);
                    return result('error', 'CONNECTION_UPDATE_FAILED');
                }
                if (closed) return CONNECTION_CLOSED;
                try {
                    current = await dependencies.connectionStore.getConnection('strava');
                    deriveSnapshot();
                } catch {
                    setSnapshot('error', 'CONNECTION_UPDATE_FAILED', false);
                    return result('error', 'CONNECTION_UPDATE_FAILED');
                }
                if (!currentSnapshot.actions.disconnect || current === null) {
                    return result('error', 'CONNECTION_ACTION_UNAVAILABLE');
                }
                let disconnected;
                try {
                    disconnected = await dependencies.authLifecycle.disconnect();
                } catch {
                    disconnected = Object.freeze({ status: 'token-removal-failed' });
                }
                const status = dataProperty(disconnected, 'status');
                if (status === 'token-removal-failed') {
                    if (closed) return CONNECTION_CLOSED;
                    setSnapshot('error', 'TOKEN_REMOVAL_FAILED', true);
                    return result('error', 'TOKEN_REMOVAL_FAILED');
                }
                const errorCode = status === 'revocation-unconfirmed'
                    ? 'REVOCATION_UNCONFIRMED'
                    : null;
                localAuthority = false;
                try {
                    current = await dependencies.connectionStore.transitionConnection(
                        transitionInput(current, 'disconnected', errorCode)
                    );
                } catch {
                    if (closed) return CONNECTION_CLOSED;
                    setSnapshot('error', 'CONNECTION_UPDATE_FAILED', false);
                    return result('error', 'CONNECTION_UPDATE_FAILED');
                }
                if (closed) return CONNECTION_CLOSED;
                setSnapshot('disconnected', errorCode, false);
                return result('disconnected');
            })();
            return await disconnecting;
        } finally {
            disconnecting = null;
        }
    }

    return Object.freeze({
        initialize,
        getConnectionSnapshot() {
            return currentSnapshot;
        },
        beginConnect,
        refresh,
        disconnect,
        async close() {
            if (closed) return CONNECTION_CLOSED;
            closed = true;
            setSnapshot('closed');
            if (dependencies) {
                const pendingDisconnect = disconnecting;
                await Promise.allSettled([
                    dependencies.authorization.close(),
                    pendingDisconnect
                ]);
                await Promise.allSettled([dependencies.connectionStore.close()]);
            }
            return CONNECTION_CLOSED;
        }
    });
}
