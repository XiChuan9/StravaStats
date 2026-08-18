import { RepositoryError } from '../../repository/index.js';

const OPTION_KEYS = new Set([
    'repository',
    'activityId',
    'streamTypes',
    'includeZones',
    'includeAthlete'
]);

function invalidInput() {
    return new TypeError('The detail read session configuration is invalid.');
}

function readPlainRecord(value, allowedKeys) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) {
            return null;
        }

        const keys = Reflect.ownKeys(value);
        if (keys.some(key => (
            typeof key !== 'string'
            || !allowedKeys.has(key)
        ))) {
            return null;
        }

        const result = {};
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
            ) {
                return null;
            }
            result[key] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function readCallable(receiver, name) {
    try {
        if (
            receiver === null
            || (typeof receiver !== 'object' && typeof receiver !== 'function')
        ) {
            return null;
        }

        let current = receiver;
        while (current !== null) {
            const descriptor = Object.getOwnPropertyDescriptor(current, name);
            if (descriptor) {
                return Object.hasOwn(descriptor, 'value')
                    && typeof descriptor.value === 'function'
                    ? descriptor.value
                    : null;
            }
            current = Object.getPrototypeOf(current);
        }
        return null;
    } catch {
        return null;
    }
}

function copyDenseStringArray(value) {
    try {
        if (
            !Array.isArray(value)
            || Object.getPrototypeOf(value) !== Array.prototype
        ) {
            return null;
        }

        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
        if (
            !lengthDescriptor
            || !Object.hasOwn(lengthDescriptor, 'value')
            || !Number.isSafeInteger(lengthDescriptor.value)
            || lengthDescriptor.value <= 0
        ) {
            return null;
        }

        const expectedKeys = new Set(['length']);
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
            expectedKeys.add(String(index));
        }
        const keys = Reflect.ownKeys(value);
        if (
            keys.length !== expectedKeys.size
            || keys.some(key => (
                typeof key !== 'string'
                || !expectedKeys.has(key)
            ))
        ) {
            return null;
        }

        const copy = [];
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (
                !descriptor?.enumerable
                || !Object.hasOwn(descriptor, 'value')
                || typeof descriptor.value !== 'string'
                || descriptor.value.trim().length === 0
            ) {
                return null;
            }
            copy.push(descriptor.value);
        }
        return copy;
    } catch {
        return null;
    }
}

function optionalLoad(promise) {
    return promise.catch(error => {
        if (error instanceof RepositoryError) return null;
        throw error;
    });
}

export function createDetailReadSession(options) {
    const values = readPlainRecord(options, OPTION_KEYS);
    if (
        values === null
        || !Object.hasOwn(values, 'repository')
        || !Object.hasOwn(values, 'activityId')
        || !Object.hasOwn(values, 'streamTypes')
        || typeof values.activityId !== 'string'
        || values.activityId.trim().length === 0
    ) {
        throw invalidInput();
    }

    const includeZones = values.includeZones ?? false;
    const includeAthlete = values.includeAthlete ?? false;
    if (
        typeof includeZones !== 'boolean'
        || typeof includeAthlete !== 'boolean'
    ) {
        throw invalidInput();
    }

    const copiedStreamTypes = copyDenseStringArray(values.streamTypes);
    if (copiedStreamTypes === null) throw invalidInput();
    Object.freeze(copiedStreamTypes);

    const getActivity = readCallable(values.repository, 'getActivity');
    const getStreams = readCallable(values.repository, 'getStreams');
    const getZones = includeZones
        ? readCallable(values.repository, 'getZones')
        : null;
    const getAthlete = includeAthlete
        ? readCallable(values.repository, 'getAthlete')
        : null;
    if (
        getActivity === null
        || getStreams === null
        || (includeZones && getZones === null)
        || (includeAthlete && getAthlete === null)
    ) {
        throw invalidInput();
    }

    const repository = values.repository;
    const activityId = values.activityId;
    let bundlePromise = null;

    function load() {
        if (bundlePromise === null) {
            bundlePromise = Promise.resolve().then(() => {
                const activityPromise = Promise.resolve().then(() => (
                    getActivity.call(repository, activityId)
                ));
                const streamsPromise = Promise.resolve().then(() => (
                    getStreams.call(repository, activityId, {
                        types: copiedStreamTypes
                    })
                ));
                const zonesPromise = includeZones
                    ? optionalLoad(Promise.resolve().then(() => (
                        getZones.call(repository)
                    )))
                    : Promise.resolve(null);
                const athletePromise = includeAthlete
                    ? optionalLoad(Promise.resolve().then(() => (
                        getAthlete.call(repository)
                    )))
                    : Promise.resolve(null);

                return Promise.all([
                    activityPromise,
                    streamsPromise,
                    zonesPromise,
                    athletePromise
                ]).then(([activity, streams, zones, athlete]) => ({
                    activity,
                    streams,
                    zones,
                    athlete
                }));
            });
        }
        return bundlePromise;
    }

    return Object.freeze({ load });
}
