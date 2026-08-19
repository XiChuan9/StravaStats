import { getValidAccessToken, logServerEvent, SERVER_API_EVENT } from './_shared.js';
import {
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
    if (!exactQuery(req.query, [])) return res.status(400).json({ error: 'ATHLETE_REQUEST_INVALID' });
    try {
        const { accessToken, updatedTokens } = await getValidAccessToken(req);
        const athlete = await requestProviderJson(
            'https://www.strava.com/api/v3/athlete',
            { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
            { maxBytes: PROVIDER_LIMIT.METADATA_BYTES }
        );
        if (!athlete || typeof athlete !== 'object' || Array.isArray(athlete)) throw new TypeError();
        return res.status(200).json({ athlete, tokens: updatedTokens });
    } catch (error) {
        logServerEvent(SERVER_API_EVENT.ATHLETE_FAILED);
        return res.status(providerErrorStatus(error)).json({ error: 'ATHLETE_UPSTREAM_FAILED' });
    }
}
