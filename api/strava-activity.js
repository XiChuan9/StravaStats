import { getValidAccessToken, logServerEvent, SERVER_API_EVENT } from './_shared.js';
import {
    boundedOpaqueId,
    exactQuery,
    providerErrorStatus,
    PROVIDER_LIMIT,
    requestProviderJson,
    setNoStoreHeaders
} from './_provider-boundary.js';

export default async function handler(req, res) {
    setNoStoreHeaders(res);
    if (req?.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    const query = exactQuery(req.query, ['id']);
    if (!query || !boundedOpaqueId(query.id)) {
        return res.status(400).json({ error: 'ACTIVITY_REQUEST_INVALID' });
    }
    try {
        const { accessToken, updatedTokens } = await getValidAccessToken(req);
        const activity = await requestProviderJson(
            `https://www.strava.com/api/v3/activities/${encodeURIComponent(query.id)}?include_all_efforts=true`,
            { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
            { maxBytes: PROVIDER_LIMIT.ACTIVITY_BYTES }
        );
        if (!activity || typeof activity !== 'object' || Array.isArray(activity)) throw new TypeError();
        return res.status(200).json({ activity, tokens: updatedTokens });
    } catch (error) {
        logServerEvent(SERVER_API_EVENT.ACTIVITY_FAILED);
        return res.status(providerErrorStatus(error)).json({ error: 'ACTIVITY_UPSTREAM_FAILED' });
    }
}
