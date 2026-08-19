// js/auth.js
import { showLoading, handleError, hideLoading } from './ui.js';
import {
    clearDemoData,
    getDemoTokens,
    isDemoMode,
    loadDemoData
} from '../demo/index.js';
import {
    AUTH_FAILURE_KIND,
    AUTH_LIFECYCLE_STATUS,
    createAuthLifecycle,
    inspectLegacyIndexedDbPresence
} from './auth-lifecycle.js';
import {
    consumeLegacyAuthorizationState,
    issueLegacyAuthorizationState
} from './source-manager-authorization.js';
import { readBoundedResponseJson } from '../shared/bounded-response.js';

const REQUIRED_SCOPES = Object.freeze(['read', 'activity:read_all']);
const REQUIRED_SCOPE_QUERY = REQUIRED_SCOPES.join(',');
const MAX_CONFIG_BYTES = 32_768;
const MAX_TOKEN_BYTES = 65_536;

function browserAuthLifecycle({
    storage = globalThis.localStorage,
    indexedDB = globalThis.indexedDB,
    fetchImpl = globalThis.fetch
} = {}) {
    return createAuthLifecycle({
        storage,
        inspectIndexedDb: () => inspectLegacyIndexedDbPresence({
            indexedDB
        }),
        revokeAccessToken: async accessToken => {
            const response = await fetchImpl('https://www.strava.com/oauth/deauthorize', {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            return { ok: response.ok };
        }
    });
}

function authFlowError(status) {
    const error = new Error(`Authentication blocked (${status}).`);
    error.name = 'AuthenticationLifecycleError';
    error.code = status;
    return error;
}

async function getStravaClientId(fetchImpl) {
    const response = await fetchImpl('/api/config', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'no-referrer'
    });
    const { value: data } = await readBoundedResponseJson(response, {
        maxBytes: MAX_CONFIG_BYTES
    });

    if (!response.ok || !data.stravaClientId) {
        throw new Error(data.error || 'Unable to load Strava client ID');
    }

    return data.stravaClientId;
}

export async function redirectToStrava(options = {}) {
    const {
        fetchImpl = globalThis.fetch,
        sessionStorage = globalThis.sessionStorage,
        crypto = globalThis.crypto,
        now = () => Date.now(),
        origin = globalThis.window.location.origin,
        pathname = globalThis.window.location.pathname,
        navigate = url => { globalThis.window.location.href = url; }
    } = options || {};
    try {
        const clientId = await getStravaClientId(fetchImpl);
        const state = issueLegacyAuthorizationState({
            sessionStorage,
            crypto,
            now,
            returnPath: pathname
        });
        const url = new URL('https://www.strava.com/oauth/authorize');
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('redirect_uri', `${origin}${pathname}`);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', REQUIRED_SCOPE_QUERY);
        url.searchParams.set('state', state);
        navigate(url.toString());
    } catch (error) {
        handleError('Could not start Strava login', error);
    }
}

export async function logout(options = {}) {
    const {
        storage = globalThis.localStorage,
        reload = () => globalThis.window.location.reload(),
        lifecycleFactory = browserAuthLifecycle,
        fetchImpl = globalThis.fetch
    } = options || {};

    if (isDemoMode(storage)) {
        clearDemoData(storage);
        reload();
        return Object.freeze({
            status: AUTH_LIFECYCLE_STATUS.SUCCESS,
            demo: true
        });
    }

    const result = await lifecycleFactory({
        storage,
        fetchImpl
    }).disconnect();
    reload();
    return result;
}

async function getTokensFromCode(code, {
    fetchImpl = globalThis.fetch,
    history = globalThis.window.history,
    lifecycle = browserAuthLifecycle(),
    pathname = globalThis.window.location.pathname
} = {}) {
    try {
        let response;
        try {
            response = await fetchImpl('/api/strava-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    granted_scopes: [...REQUIRED_SCOPES]
                }),
                credentials: 'same-origin',
                cache: 'no-store',
                redirect: 'error',
                referrerPolicy: 'no-referrer'
            });
        } catch (networkErr) {
            throw new Error('Cannot reach /api/strava-auth. Run the app with "vercel dev" for local testing.');
        }

        if (!response.ok) throw new Error('Authentication failed');
        const { value: data } = await readBoundedResponseJson(response, {
            maxBytes: MAX_TOKEN_BYTES
        });

        const result = await lifecycle.acceptOAuthTokenResponse(data);
        if (result.status !== AUTH_LIFECYCLE_STATUS.SUCCESS) {
            throw authFlowError(result.status);
        }
        history.replaceState({}, '', pathname);
        return result;
    } catch (error) {
        handleError('Authentication failed', error);
        throw error;
    }
}

export async function loginWithDemo(onAuthenticated, {
    storage = globalThis.localStorage,
    referenceDate,
    now
} = {}) {
    try {
        showLoading('Loading demo data with 250 sample activities...');
        const loadOptions = { storage };
        if (referenceDate !== undefined) loadOptions.referenceDate = referenceDate;
        if (now !== undefined) loadOptions.now = now;
        const { demoTokens } = loadDemoData(loadOptions);

        await onAuthenticated(demoTokens);
        hideLoading();
        return Object.freeze({
            status: AUTH_LIFECYCLE_STATUS.SUCCESS,
            demo: true
        });
    } catch (error) {
        handleError('Demo mode failed', error);
        hideLoading();
        return Object.freeze({
            status: AUTH_LIFECYCLE_STATUS.UNAUTHENTICATED,
            demo: true
        });
    }
}

export async function handleAuth(onAuthenticated, options = {}) {
    const {
        storage = globalThis.localStorage,
        search = globalThis.window.location.search,
        history = globalThis.window.history,
        now = Date.now(),
        fetchImpl = globalThis.fetch,
        sessionStorage = globalThis.sessionStorage,
        pathname = globalThis.window.location.pathname,
        lifecycleFactory = browserAuthLifecycle
    } = options || {};
    if (isDemoMode(storage)) {
        const demoTokens = getDemoTokens(storage);
        const nowMs = new Date(now).getTime();
        const nowSeconds = Math.floor(nowMs / 1000);

        if (
            Number.isFinite(nowMs)
            && demoTokens
            && demoTokens.expires_at > nowSeconds
        ) {
            await onAuthenticated(demoTokens);
            hideLoading();
            return Object.freeze({
                status: AUTH_LIFECYCLE_STATUS.SUCCESS,
                demo: true
            });
        }

        clearDemoData(storage);
        hideLoading();
        return Object.freeze({
            status: demoTokens
                ? AUTH_LIFECYCLE_STATUS.TOKEN_EXPIRED
                : AUTH_LIFECYCLE_STATUS.UNAUTHENTICATED,
            demo: true
        });
    }

    const params = new URLSearchParams(search);
    const callbackKeys = [...params.keys()];
    const hasCallback = callbackKeys.some(key => ['code', 'state', 'scope'].includes(key));
    if (hasCallback) {
        const codeValues = params.getAll('code');
        const stateValues = params.getAll('state');
        const scopeValues = params.getAll('scope');
        const validCallback = callbackKeys.length === 3
            && new Set(callbackKeys).size === 3
            && codeValues.length === 1
            && stateValues.length === 1
            && scopeValues.length === 1
            && typeof codeValues[0] === 'string'
            && codeValues[0].length > 0
            && codeValues[0].length <= 512
            && scopeValues[0] === REQUIRED_SCOPE_QUERY;
        if (!validCallback) {
            throw authFlowError('oauth-callback-invalid');
        }
        consumeLegacyAuthorizationState({
            sessionStorage,
            now: () => new Date(now).getTime(),
            returnPath: pathname,
            state: stateValues[0]
        });
        showLoading('Authenticating...');
        await getTokensFromCode(codeValues[0], {
            fetchImpl,
            history,
            pathname,
            lifecycle: lifecycleFactory({
                storage,
                fetchImpl
            })
        });
    }

    const tokenDataRaw = storage.getItem('strava_tokens');
    if (tokenDataRaw) {
        let tokenData;
        try {
            tokenData = JSON.parse(tokenDataRaw);
        } catch {
            tokenData = null;
        }
        const nowSeconds = Math.floor(new Date(now).getTime() / 1000);

        if (tokenData?.access_token && tokenData.expires_at > nowSeconds) {
            await onAuthenticated(tokenData);
            return { status: AUTH_LIFECYCLE_STATUS.SUCCESS };
        }

        const result = lifecycleFactory({
            storage,
            fetchImpl
        }).expireToken();
        hideLoading();
        return result;
    }

    hideLoading();
    return lifecycleFactory({
        storage,
        fetchImpl
    }).handleAuthFailure(
        AUTH_FAILURE_KIND.UNAUTHORIZED
    );
}
