function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) deepFreeze(child);
        Object.freeze(value);
    }
    return value;
}

export const SYNTHETIC_SUBJECT_ID = '900000000000000001';
export const SYNTHETIC_ACQUIRED_AT = '2026-08-10T12:00:00.000Z';

export const SYNTHETIC_SESSION = deepFreeze({
    provider: 'strava',
    subjectId: SYNTHETIC_SUBJECT_ID,
    grantedScopes: ['read', 'activity:read_all']
});

export const SYNTHETIC_CONNECTION = deepFreeze({
    id: 'source-connection:strava',
    provider: 'strava',
    subjectId: SYNTHETIC_SUBJECT_ID,
    status: 'connected',
    lastSyncAt: null,
    errorCode: null,
    revision: 1
});

export const SYNTHETIC_RICH_ACTIVITY = deepFreeze({
    summary: {
        id: '910000000000000001',
        sport_type: 'Run',
        type: 'Run',
        start_date: '2026-08-10T10:00:00Z',
        utc_offset: 0,
        timezone: 'Synthetic/Discarded',
        name: 'SYNTHETIC PRIVATE-FIELD CANARY',
        distance: 0,
        moving_time: 120,
        elapsed_time: 120,
        total_elevation_gain: -0,
        average_heartrate: null,
        average_watts: 0,
        average_cadence: 0,
        athlete: { id: 'SYNTHETIC PROFILE CANARY' },
        map: { summary_polyline: 'SYNTHETIC ROUTE CANARY' },
        gear_id: 'SYNTHETIC GEAR CANARY',
        synthetic_unknown: 'SYNTHETIC UNKNOWN CANARY'
    },
    detail: {
        id: '910000000000000001',
        distance: 999,
        device_name: 'SYNTHETIC DEVICE CANARY',
        laps: [
            {
                lap_index: 1,
                elapsed_time: 60,
                moving_time: 60,
                distance: 0
            },
            {
                lap_index: 0,
                elapsed_time: 60,
                moving_time: null,
                distance: null
            }
        ]
    },
    streams: {
        time: { data: [0, 60, 120], original_size: 3 },
        distance: { data: [0, 0, 10] },
        latlng: { data: [[0, 0], null, [0.001, -0.001]] },
        altitude: { data: [-5, 0, 5] },
        velocity_smooth: { data: [0, 1.5, 2] },
        heartrate: { data: [120, null, 140] },
        cadence: { data: [0, 80, 90] },
        watts: { data: [0, 100, 200] },
        temp: { data: [-5, 0, 5] },
        moving: { data: [false, null, true] },
        grade_smooth: { data: [-1, 0, 1] },
        future_stream: { data: ['SYNTHETIC UNKNOWN STREAM CANARY'] }
    }
});

export const SYNTHETIC_DEGRADED_ACTIVITY = deepFreeze({
    summary: {
        id: '910000000000000002',
        sport_type: 'SyntheticFutureSport',
        start_date: '2026-08-10T11:00:00.123Z',
        utc_offset: null,
        name: 'SYNTHETIC DROPPED NAME'
    },
    detail: null,
    streams: null
});

export function syntheticActivities(count) {
    return Array.from({ length: count }, (_, index) => ({
        summary: {
            id: String(9_200_000 + index),
            sport_type: 'Run',
            start_date: '2026-08-10T10:00:00Z',
            utc_offset: 0,
            elapsed_time: 0
        },
        detail: { id: String(9_200_000 + index), laps: [] },
        streams: {}
    }));
}

export function syntheticStreamPoints(count) {
    return {
        time: { data: Array.from({ length: count }, (_, index) => index) },
        distance: { data: Array.from({ length: count }, (_, index) => index) }
    };
}

export function syntheticLaps(count) {
    return Array.from({ length: count }, (_, index) => ({
        lap_index: index,
        elapsed_time: 0,
        moving_time: 0,
        distance: 0
    }));
}
