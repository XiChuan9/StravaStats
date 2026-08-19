import { getValidAccessToken, logServerEvent, SERVER_API_EVENT } from './_shared.js';
import {
    boundedOpaqueId,
    exactQuery,
    providerErrorStatus,
    PROVIDER_LIMIT,
    requestProviderJson,
    setNoStoreHeaders
} from './_provider-boundary.js';

const STREAM_KEYS = new Set([
    'time', 'distance', 'latlng', 'altitude', 'velocity_smooth', 'heartrate',
    'cadence', 'watts', 'temp', 'moving', 'grade_smooth'
]);

function streamTypes(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 256) return null;
    const keys = value.split(',');
    if (
        keys.length === 0
        || keys.length > STREAM_KEYS.size
        || new Set(keys).size !== keys.length
        || keys.some(key => !STREAM_KEYS.has(key))
    ) return null;
    return keys;
}

function validStreams(value, requested) {
    try {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string' || !requested.includes(key)) return false;
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            const stream = descriptor?.value;
            if (!descriptor?.enumerable || !stream || typeof stream !== 'object' || Array.isArray(stream)) return false;
            const data = Object.getOwnPropertyDescriptor(stream, 'data')?.value;
            if (!Array.isArray(data) || data.length > PROVIDER_LIMIT.STREAM_POINTS) return false;
        }
        return true;
    } catch {
        return false;
    }
}

export default async function handler(req, res) {
    setNoStoreHeaders(res);
    if (req?.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    const query = exactQuery(req.query, ['id', 'type']);
    const requested = query ? streamTypes(query.type) : null;
    if (!query || !boundedOpaqueId(query.id) || !requested) {
        return res.status(400).json({ error: 'STREAMS_REQUEST_INVALID' });
    }
    try {
        const { accessToken, updatedTokens } = await getValidAccessToken(req);
        const url = new URL(`https://www.strava.com/api/v3/activities/${encodeURIComponent(query.id)}/streams`);
        url.searchParams.set('keys', requested.join(','));
        url.searchParams.set('key_by_type', 'true');
        const streams = await requestProviderJson(url.href, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` }
        }, {
            maxBytes: PROVIDER_LIMIT.STREAM_BYTES
        });
        if (!validStreams(streams, requested)) throw new TypeError();
        return res.status(200).json({ streams, tokens: updatedTokens });
    } catch (error) {
        logServerEvent(SERVER_API_EVENT.STREAMS_FAILED);
        return res.status(providerErrorStatus(error)).json({ error: 'STREAMS_UPSTREAM_FAILED' });
    }
}
