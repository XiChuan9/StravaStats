import { getValidAccessToken, logServerEvent, SERVER_API_EVENT } from './_shared.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { accessToken, updatedTokens } = await getValidAccessToken(req);

        const stravaResponse = await fetch('https://www.strava.com/api/v3/athlete', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!stravaResponse.ok) {
            logServerEvent(SERVER_API_EVENT.ATHLETE_FAILED);
            return res.status(stravaResponse.status).json({ error: 'Failed to fetch athlete from Strava' });
        }

        const athleteData = await stravaResponse.json();
        return res.status(200).json({ athlete: athleteData, tokens: updatedTokens });

    } catch {
        logServerEvent(SERVER_API_EVENT.ATHLETE_FAILED);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
