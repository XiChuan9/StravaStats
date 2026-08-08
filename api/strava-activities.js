import { getValidAccessToken, logServerEvent, SERVER_API_EVENT } from './_shared.js';

export default async function handler(req, res) {
    try {
        const { accessToken, updatedTokens } = await getValidAccessToken(req);

        const activitiesUrl = 'https://www.strava.com/api/v3/athlete/activities';
        let allActivities = [];
        let page = 1;
        const perPage = 100;
        let hasMore = true;

        while (hasMore) {
            const url = `${activitiesUrl}?page=${page}&per_page=${perPage}`;
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                logServerEvent(SERVER_API_EVENT.ACTIVITIES_FAILED);
                return res.status(500).json({ error: 'Failed to fetch activities from Strava' });
            }

            const pageActivities = await response.json();
            if (pageActivities.length === 0) hasMore = false;
            else {
                allActivities.push(...pageActivities);
                page++;
            }
        }

        return res.status(200).json({ activities: allActivities, tokens: updatedTokens });

    } catch {
        logServerEvent(SERVER_API_EVENT.ACTIVITIES_FAILED);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
