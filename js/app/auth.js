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

const REDIRECT_URI = window.location.origin + window.location.pathname;

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

async function getStravaClientId() {
    const response = await fetch('/api/config');
    const data = await response.json();

    if (!response.ok || !data.stravaClientId) {
        throw new Error(data.error || 'Unable to load Strava client ID');
    }

    return data.stravaClientId;
}

export async function redirectToStrava() {
    try {
        const clientId = await getStravaClientId();
        const scope = 'read,activity:read_all,profile:read_all';
        const authUrl = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scope)}`;
        window.location.href = authUrl;
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
    lifecycle = browserAuthLifecycle()
} = {}) {
    try {
        let response;
        try {
            response = await fetchImpl('/api/strava-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
        } catch (networkErr) {
            throw new Error('Cannot reach /api/strava-auth. Run the app with "vercel dev" for local testing.');
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            // Endpoint returned HTML — likely a 404 (not running via vercel dev) or a Vercel error page
            const hint = response.status === 404
                ? 'Endpoint not found — make sure you are running the app with "vercel dev".'
                : `Server returned HTTP ${response.status}. Check that STRAVA_CLIENT_SECRET is set in your Vercel environment variables.`;
            throw new Error(hint);
        }

        const data = await response.json();
        if (!response.ok) throw new Error('Authentication failed');

        const result = await lifecycle.acceptOAuthTokenResponse(data);
        if (result.status !== AUTH_LIFECYCLE_STATUS.SUCCESS) {
            throw authFlowError(result.status);
        }
        history.replaceState({}, '', globalThis.window.location.pathname);
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
        lifecycleFactory = browserAuthLifecycle
    } = options || {};
    const params = new URLSearchParams(search);
    const code = params.get('code');

    if (code) {
        showLoading('Authenticating...');
        await getTokensFromCode(code, {
            fetchImpl,
            history,
            lifecycle: lifecycleFactory({
                storage,
                fetchImpl
            })
        });
        clearDemoData(storage);
    } else if (isDemoMode(storage)) {
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
