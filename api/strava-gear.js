import { getValidAccessToken, logServerEvent, SERVER_API_EVENT, validateEnv } from './_shared.js';

export default async function handler(req, res) {
    try {
        validateEnv();
    } catch {
        return res.status(500).json({ error: 'Server configuration error: Strava environment variables are not set.' });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'Gear ID is required' });
    }

    try {
        const { accessToken, updatedTokens } = await getValidAccessToken(req);

        const gearUrl = `https://www.strava.com/api/v3/gear/${encodeURIComponent(id)}`;
        const stravaResponse = await fetch(gearUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!stravaResponse.ok) {
            logServerEvent(SERVER_API_EVENT.GEAR_FAILED);
            return res.status(stravaResponse.status).json({ error: 'Failed to fetch gear from Strava' });
        }

        const gear = await stravaResponse.json();
        return res.status(200).json({ gear, tokens: updatedTokens });

    } catch {
        logServerEvent(SERVER_API_EVENT.GEAR_FAILED);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
