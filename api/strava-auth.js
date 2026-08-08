import { types as utilTypes } from 'node:util';

import { logServerEvent, SERVER_API_EVENT } from './_shared.js';

function readOwnData(value, key) {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return undefined;
  }
  if (utilTypes.isProxy(value)) return undefined;

  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value')
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

export default async function handler(req, res) {
  if (readOwnData(req, 'method') !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const code = readOwnData(readOwnData(req, 'body'), 'code');
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: 'Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET'
    });
  }

  if (typeof code !== 'string' || code.length === 0) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code'
  });

  let response;
  try {
    response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      body: params
    });
  } catch {
    logServerEvent(SERVER_API_EVENT.AUTH_NETWORK_FAILED);
    return res.status(502).json({ error: 'Cannot reach Strava' });
  }

  if (!response.ok) {
    logServerEvent(SERVER_API_EVENT.AUTH_PROVIDER_REJECTED);
    return res.status(400).json({ error: 'Strava auth failed' });
  }

  const data = await response.json().catch(() => ({}));
  return res.status(200).json(data);
}
