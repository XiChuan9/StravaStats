// api/_shared.js — Shared authentication utilities for all API endpoints

import {
    PROVIDER_LIMIT,
    requestProviderJson
} from './_provider-boundary.js';

export const SERVER_API_EVENT = Object.freeze({
    TOKEN_REFRESH_FAILED: 'server_api.token_refresh_failed',
    AUTH_NETWORK_FAILED: 'server_api.auth_network_failed',
    AUTH_PROVIDER_REJECTED: 'server_api.auth_provider_rejected',
    AUTH_RESPONSE_INVALID: 'server_api.auth_response_invalid',
    REVOKE_NETWORK_FAILED: 'server_api.revoke_network_failed',
    REVOKE_PROVIDER_REJECTED: 'server_api.revoke_provider_rejected',
    ACTIVITIES_FAILED: 'server_api.activities_failed',
    ACTIVITY_FAILED: 'server_api.activity_failed',
    ATHLETE_FAILED: 'server_api.athlete_failed',
    GEAR_FAILED: 'server_api.gear_failed',
    STREAMS_FAILED: 'server_api.streams_failed',
    ZONES_FAILED: 'server_api.zones_failed',
    LOCAL_HANDLER_FAILED: 'server_api.local_handler_failed'
});

const SERVER_API_EVENTS = new Set(Object.values(SERVER_API_EVENT));

export function logServerEvent(event) {
    if (!SERVER_API_EVENTS.has(event)) {
        throw new TypeError('Invalid server API event.');
    }
    console.error(event);
}

async function refreshAccessToken(refreshToken) {
    let data;
    try {
        data = await requestProviderJson('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            })
        }, {
            maxBytes: PROVIDER_LIMIT.TOKEN_BYTES
        });
    } catch (error) {
        logServerEvent(SERVER_API_EVENT.TOKEN_REFRESH_FAILED);
        throw error;
    }
    if (
        data === null
        || typeof data !== 'object'
        || Array.isArray(data)
        || typeof data.access_token !== 'string'
        || data.access_token.length === 0
        || data.access_token.length > 4_096
        || typeof data.refresh_token !== 'string'
        || data.refresh_token.length === 0
        || data.refresh_token.length > 4_096
        || !Number.isSafeInteger(data.expires_at)
        || data.expires_at <= 0
    ) {
        logServerEvent(SERVER_API_EVENT.TOKEN_REFRESH_FAILED);
        throw new Error('Token refresh failed');
    }
    return data;
}

export async function getValidAccessToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid Authorization header');
    }

    const payloadRaw = authHeader.split(' ')[1];
    const tokenData = JSON.parse(Buffer.from(payloadRaw, 'base64').toString());
    const { access_token, refresh_token, expires_at } = tokenData;

    if (!access_token || !refresh_token || !expires_at) {
        throw new Error('Incomplete token data');
    }

    const now = Math.floor(Date.now() / 1000);
    if (expires_at > now + 60) {
        return { accessToken: access_token, updatedTokens: null };
    }

    // Token expired (or about to), refresh it
    const refreshed = await refreshAccessToken(refresh_token);
    return {
        accessToken: refreshed.access_token,
        updatedTokens: {
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: refreshed.expires_at
        }
    };
}

export function validateEnv() {
    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
        throw new Error('Server configuration error: Strava environment variables are not set.');
    }
}
