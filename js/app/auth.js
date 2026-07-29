// js/auth.js
import { showLoading, handleError, hideLoading } from './ui.js';
import { loadDemoData } from '../demo/index.js';
import {
    AUTH_FAILURE_KIND,
    AUTH_LIFECYCLE_STATUS,
    createAuthLifecycle,
    inspectLegacyIndexedDbPresence
} from './auth-lifecycle.js';

const REDIRECT_URI = window.location.origin + window.location.pathname;

function browserAuthLifecycle() {
    return createAuthLifecycle({
        storage: localStorage,
        inspectIndexedDb: () => inspectLegacyIndexedDbPresence({
            indexedDB: globalThis.indexedDB
        }),
        revokeAccessToken: async accessToken => {
            // Preserve the existing Demo behavior until the separate Demo namespace phase.
            if (accessToken.startsWith('demo_')) return { ok: true };
            const response = await fetch('https://www.strava.com/oauth/deauthorize', {
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

export async function logout() {
    const result = await browserAuthLifecycle().disconnect();
    window.location.reload();
    return result;
}

async function getTokensFromCode(code) {
    try {
        let response;
        try {
            response = await fetch('/api/strava-auth', {
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

        const result = await browserAuthLifecycle().acceptOAuthTokenResponse(data);
        if (result.status !== AUTH_LIFECYCLE_STATUS.SUCCESS) {
            throw authFlowError(result.status);
        }
        window.history.replaceState({}, '', window.location.pathname);
        return result;
    } catch (error) {
        handleError('Authentication failed', error);
        throw error;
    }
}

export async function loginWithDemo(onAuthenticated) {
    try {
        showLoading('Loading demo data with 250 sample activities...');
        loadDemoData();

        // Fake token for demo mode
        const demoTokens = {
            access_token: 'demo_' + Math.random().toString(36),
            refresh_token: 'demo_refresh_' + Math.random().toString(36),
            expires_at: Math.floor(Date.now() / 1000) + 21600,
        };

        await onAuthenticated(demoTokens);
        hideLoading();
    } catch (error) {
        handleError('Demo mode failed', error);
        hideLoading();
    }
}

export async function handleAuth(onAuthenticated) {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        showLoading('Authenticating...');
        await getTokensFromCode(code);
    }

    const tokenDataRaw = localStorage.getItem('strava_tokens');
    if (tokenDataRaw) {
        let tokenData;
        try {
            tokenData = JSON.parse(tokenDataRaw);
        } catch {
            tokenData = null;
        }
        const now = Math.floor(Date.now() / 1000);

        if (tokenData?.access_token && tokenData.expires_at > now) {
            await onAuthenticated(tokenData);
            return { status: AUTH_LIFECYCLE_STATUS.SUCCESS };
        }

        const result = browserAuthLifecycle().expireToken();
        hideLoading();
        return result;
    }

    hideLoading();
    return browserAuthLifecycle().handleAuthFailure(
        AUTH_FAILURE_KIND.UNAUTHORIZED
    );
}
