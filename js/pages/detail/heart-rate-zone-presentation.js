function readOwnValue(record, key) {
    try {
        if (
            record === null
            || typeof record !== 'object'
            || Array.isArray(record)
            || ![Object.prototype, null].includes(Object.getPrototypeOf(record))
        ) return undefined;
        const descriptor = Object.getOwnPropertyDescriptor(record, key);
        return descriptor?.enumerable && Object.hasOwn(descriptor, 'value')
            ? descriptor.value
            : undefined;
    } catch {
        return undefined;
    }
}

function readDenseArray(value) {
    try {
        if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
            return null;
        }
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
        if (
            !lengthDescriptor
            || !Object.hasOwn(lengthDescriptor, 'value')
            || !Number.isSafeInteger(lengthDescriptor.value)
            || lengthDescriptor.value < 0
        ) return null;
        const length = lengthDescriptor.value;
        const expectedKeys = new Set(['length']);
        for (let index = 0; index < length; index += 1) {
            expectedKeys.add(String(index));
        }
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== expectedKeys.size
            || keys.some(key => typeof key !== 'string' || !expectedKeys.has(key))
        ) return null;
        const result = [];
        for (let index = 0; index < length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
            result.push(descriptor.value);
        }
        return result;
    } catch {
        return null;
    }
}

export function readHeartRateZones(value) {
    const heartRate = readOwnValue(value, 'heart_rate');
    const candidates = readDenseArray(readOwnValue(heartRate, 'zones'));
    if (candidates === null || candidates.length === 0) return Object.freeze([]);

    const zones = [];
    let previousMax = null;
    for (let index = 0; index < candidates.length; index += 1) {
        const min = readOwnValue(candidates[index], 'min');
        const max = readOwnValue(candidates[index], 'max');
        if (
            !Number.isInteger(min)
            || min < 0
            || !Number.isInteger(max)
            || (max !== -1 && max <= min)
            || (max === -1 && index !== candidates.length - 1)
            || (
                previousMax !== null
                && min !== previousMax
                && min !== previousMax + 1
            )
        ) return Object.freeze([]);
        const zone = Object.freeze({ min, max });
        zones.push(zone);
        previousMax = max === -1 ? null : max;
    }
    return Object.freeze(zones);
}

function readStreamData(stream) {
    return readDenseArray(readOwnValue(stream, 'data'));
}

export function calculateHeartRateZoneSeconds(heartrateStream, timeStream, zones) {
    const heartrates = readStreamData(heartrateStream);
    const times = readStreamData(timeStream);
    const safeZones = readDenseArray(zones);
    if (
        heartrates === null
        || times === null
        || safeZones === null
        || safeZones.length === 0
        || heartrates.length !== times.length
    ) return Object.freeze([]);

    const totals = Array(safeZones.length).fill(0);
    for (let index = 1; index < heartrates.length; index += 1) {
        const heartRate = heartrates[index];
        const currentTime = times[index];
        const previousTime = times[index - 1];
        if (
            !Number.isFinite(heartRate)
            || heartRate <= 0
            || !Number.isFinite(currentTime)
            || !Number.isFinite(previousTime)
            || currentTime < previousTime
        ) continue;
        for (let zoneIndex = 0; zoneIndex < safeZones.length; zoneIndex += 1) {
            const zone = safeZones[zoneIndex];
            const upper = zone.max === -1 ? Infinity : zone.max;
            if (heartRate >= zone.min && heartRate < upper) {
                totals[zoneIndex] += currentTime - previousTime;
                break;
            }
        }
    }
    return Object.freeze(totals);
}

export function formatHeartRateZoneLabels(zones, localProfile = false) {
    const safeZones = readDenseArray(zones);
    if (safeZones === null) return Object.freeze([]);
    return Object.freeze(safeZones.map((zone, index) => {
        if (zone.max === -1) return `Z${index + 1} (≥${zone.min})`;
        if (localProfile && index === 0) return `Z1 (<${zone.max})`;
        if (localProfile) return `Z${index + 1} (${zone.min}–${zone.max - 1})`;
        return `Z${index + 1} (${zone.min}-${zone.max})`;
    }));
}
