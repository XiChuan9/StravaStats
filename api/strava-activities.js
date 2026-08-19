import { getValidAccessToken, logServerEvent, SERVER_API_EVENT } from './_shared.js';
import {
    exactQuery,
    providerErrorStatus,
    PROVIDER_LIMIT,
    requestProviderJson,
    setNoStoreHeaders
} from './_provider-boundary.js';

function validPage(value) {
    return typeof value === 'string'
        && /^[1-9]\d*$/.test(value)
        && value.length <= 4
        && Number(value) <= 400;
}

export default async function handler(req, res) {
    setNoStoreHeaders(res);
    if (req?.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    const query = exactQuery(req.query, ['page', 'per_page']);
    if (!query || !validPage(query.page) || query.per_page !== String(PROVIDER_LIMIT.ACTIVITY_PAGE_SIZE)) {
        return res.status(400).json({ error: 'ACTIVITIES_REQUEST_INVALID' });
    }
    try {
        const { accessToken, updatedTokens } = await getValidAccessToken(req);
        const url = new URL('https://www.strava.com/api/v3/athlete/activities');
        url.searchParams.set('page', query.page);
        url.searchParams.set('per_page', String(PROVIDER_LIMIT.ACTIVITY_PAGE_SIZE));
        const activities = await requestProviderJson(url.href, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` }
        }, {
            maxBytes: PROVIDER_LIMIT.ACTIVITY_BYTES
        });
        if (!Array.isArray(activities) || activities.length > PROVIDER_LIMIT.ACTIVITY_PAGE_SIZE) {
            throw new TypeError();
        }
        return res.status(200).json({
            activities,
            has_more: activities.length === PROVIDER_LIMIT.ACTIVITY_PAGE_SIZE,
            tokens: updatedTokens
        });
    } catch (error) {
        logServerEvent(SERVER_API_EVENT.ACTIVITIES_FAILED);
        return res.status(providerErrorStatus(error)).json({ error: 'ACTIVITIES_UPSTREAM_FAILED' });
    }
}
