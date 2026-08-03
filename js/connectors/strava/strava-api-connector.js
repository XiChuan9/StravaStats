export const STRAVA_CONNECTOR_ERROR_CODE = Object.freeze({
    INVALID_REQUEST: 'INVALID_REQUEST',
    TOKEN_ABSENT: 'TOKEN_ABSENT',
    TOKEN_INVALID: 'TOKEN_INVALID',
    TOKEN_READ_FAILED: 'TOKEN_READ_FAILED',
    TOKEN_ENCODING_FAILED: 'TOKEN_ENCODING_FAILED',
    TOKEN_WRITE_FAILED: 'TOKEN_WRITE_FAILED',
    NETWORK_FAILED: 'NETWORK_FAILED',
    HTTP_UNAUTHENTICATED: 'HTTP_UNAUTHENTICATED',
    HTTP_FORBIDDEN: 'HTTP_FORBIDDEN',
    HTTP_NOT_FOUND: 'HTTP_NOT_FOUND',
    HTTP_RATE_LIMITED: 'HTTP_RATE_LIMITED',
    HTTP_SERVER_ERROR: 'HTTP_SERVER_ERROR',
    INVALID_JSON: 'INVALID_JSON',
    INVALID_ENVELOPE: 'INVALID_ENVELOPE'
});

const ERROR_MESSAGES = Object.freeze({
    [STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST]: 'The connector request is invalid.',
    [STRAVA_CONNECTOR_ERROR_CODE.TOKEN_ABSENT]: 'Authentication is required.',
    [STRAVA_CONNECTOR_ERROR_CODE.TOKEN_INVALID]: 'Stored authentication data is invalid.',
    [STRAVA_CONNECTOR_ERROR_CODE.TOKEN_READ_FAILED]: 'Authentication data could not be read.',
    [STRAVA_CONNECTOR_ERROR_CODE.TOKEN_ENCODING_FAILED]: 'Authentication data could not be encoded.',
    [STRAVA_CONNECTOR_ERROR_CODE.TOKEN_WRITE_FAILED]: 'Refreshed authentication data could not be stored.',
    [STRAVA_CONNECTOR_ERROR_CODE.NETWORK_FAILED]: 'The provider network is unavailable.',
    [STRAVA_CONNECTOR_ERROR_CODE.HTTP_UNAUTHENTICATED]: 'The provider rejected authentication.',
    [STRAVA_CONNECTOR_ERROR_CODE.HTTP_FORBIDDEN]: 'The provider denied the request.',
    [STRAVA_CONNECTOR_ERROR_CODE.HTTP_NOT_FOUND]: 'The requested provider resource was not found.',
    [STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED]: 'The provider rate limit was reached.',
    [STRAVA_CONNECTOR_ERROR_CODE.HTTP_SERVER_ERROR]: 'The provider request failed.',
    [STRAVA_CONNECTOR_ERROR_CODE.INVALID_JSON]: 'The provider response was not valid JSON.',
    [STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE]: 'The provider response was invalid.'
});

const CONNECTOR_ERROR_CODES = new Set(Object.values(STRAVA_CONNECTOR_ERROR_CODE));
const OPERATIONS = new Set([
    'listActivities',
    'getActivity',
    'getStreams',
    'getAthlete',
    'getZones',
    'getGear'
]);
const ERROR_DETAIL_KEYS = new Set([
    'operation',
    'retryable',
    'httpStatus',
    'retryAfterSeconds'
]);
const CONSTRUCTOR_KEYS = new Set([
    'fetchImpl',
    'tokenReader',
    'tokenWriter',
    'tokenEncoder',
    'now'
]);
const STREAM_OPTION_KEYS = new Set(['types']);
const STREAM_TYPES = new Set([
    'time',
    'distance',
    'latlng',
    'altitude',
    'velocity_smooth',
    'heartrate',
    'cadence',
    'watts',
    'temp',
    'moving',
    'grade_smooth'
]);
const TOKEN_KEYS = Object.freeze([
    'access_token',
    'refresh_token',
    'expires_at'
]);

function invalidErrorDetails() {
    return {
        valid: false,
        operation: null,
        retryable: false,
        httpStatus: null,
        retryAfterSeconds: null
    };
}

function normalizeErrorDetails(details) {
    if (details === undefined) {
        return {
            valid: true,
            operation: null,
            retryable: false,
            httpStatus: null,
            retryAfterSeconds: null
        };
    }

    try {
        if (
            details === null
            || typeof details !== 'object'
            || Array.isArray(details)
            || Object.getPrototypeOf(details) !== Object.prototype
        ) {
            return invalidErrorDetails();
        }

        const keys = Reflect.ownKeys(details);
        if (keys.some(key => typeof key !== 'string' || !ERROR_DETAIL_KEYS.has(key))) {
            return invalidErrorDetails();
        }

        const normalized = {
            valid: true,
            operation: null,
            retryable: false,
            httpStatus: null,
            retryAfterSeconds: null
        };

        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(details, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return invalidErrorDetails();
            }
            normalized[key] = descriptor.value;
        }

        if (normalized.operation !== null && !OPERATIONS.has(normalized.operation)) {
            return invalidErrorDetails();
        }
        if (typeof normalized.retryable !== 'boolean') {
            return invalidErrorDetails();
        }
        if (
            normalized.httpStatus !== null
            && (
                !Number.isInteger(normalized.httpStatus)
                || normalized.httpStatus < 100
                || normalized.httpStatus > 599
            )
        ) {
            return invalidErrorDetails();
        }
        if (
            normalized.retryAfterSeconds !== null
            && (
                !Number.isInteger(normalized.retryAfterSeconds)
                || normalized.retryAfterSeconds < 0
            )
        ) {
            return invalidErrorDetails();
        }

        return normalized;
    } catch {
        return invalidErrorDetails();
    }
}

export class StravaConnectorError extends Error {
    constructor(code, details) {
        const normalizedDetails = normalizeErrorDetails(details);
        const validInput = CONNECTOR_ERROR_CODES.has(code) && normalizedDetails.valid;
        const normalizedCode = validInput
            ? code
            : STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST;

        super(ERROR_MESSAGES[normalizedCode]);
        this.name = 'StravaConnectorError';
        this.code = normalizedCode;
        this.operation = validInput ? normalizedDetails.operation : null;
        this.retryable = validInput ? normalizedDetails.retryable : false;
        this.httpStatus = validInput ? normalizedDetails.httpStatus : null;
        this.retryAfterSeconds = validInput
            ? normalizedDetails.retryAfterSeconds
            : null;
        Object.freeze(this);
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            operation: this.operation,
            retryable: this.retryable,
            httpStatus: this.httpStatus,
            retryAfterSeconds: this.retryAfterSeconds
        };
    }
}

function connectorError(code, operation, details = {}) {
    return new StravaConnectorError(code, {
        operation,
        retryable: details.retryable ?? false,
        httpStatus: details.httpStatus ?? null,
        retryAfterSeconds: details.retryAfterSeconds ?? null
    });
}

function defaultFetch(...args) {
    return globalThis.fetch(...args);
}

function defaultTokenReader() {
    return globalThis.localStorage.getItem('strava_tokens');
}

function defaultTokenWriter(serializedToken) {
    globalThis.localStorage.setItem('strava_tokens', serializedToken);
}

function defaultTokenEncoder(rawTokenString) {
    return globalThis.btoa(rawTokenString);
}

function defaultNow() {
    return Date.now();
}

function readDataProperties(value, allowedKeys) {
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
        if (keys.some(key => typeof key !== 'string' || !allowedKeys.has(key))) {
            return null;
        }

        const result = {};
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            result[key] = descriptor.value;
        }
        return result;
    } catch {
        return null;
    }
}

function normalizeConstructorOptions(options) {
    const values = readDataProperties(options, CONSTRUCTOR_KEYS);
    if (values === null) {
        throw connectorError(
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST,
            null
        );
    }

    const normalized = {
        fetchImpl: defaultFetch,
        tokenReader: defaultTokenReader,
        tokenWriter: defaultTokenWriter,
        tokenEncoder: defaultTokenEncoder,
        now: defaultNow,
        ...values
    };

    if (Object.values(normalized).some(value => typeof value !== 'function')) {
        throw connectorError(
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST,
            null
        );
    }

    return normalized;
}

function normalizeResourceId(value, operation) {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value;
    }
    if (Number.isSafeInteger(value) && value >= 0) {
        return String(value);
    }
    throw connectorError(
        STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST,
        operation
    );
}

function normalizeStreamTypes(options, operation) {
    const values = readDataProperties(options, STREAM_OPTION_KEYS);
    if (values === null || !Object.hasOwn(values, 'types')) {
        throw connectorError(
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST,
            operation
        );
    }

    const { types } = values;
    if (!Array.isArray(types) || types.length === 0) {
        throw connectorError(
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST,
            operation
        );
    }

    let normalized;
    try {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(types, 'length');
        if (
            !lengthDescriptor
            || !Object.hasOwn(lengthDescriptor, 'value')
            || !Number.isSafeInteger(lengthDescriptor.value)
            || lengthDescriptor.value <= 0
        ) {
            throw new TypeError();
        }

        const keys = Reflect.ownKeys(types);
        const expectedKeys = new Set([
            ...Array.from(
                { length: lengthDescriptor.value },
                (_, index) => String(index)
            ),
            'length'
        ]);
        if (
            keys.length !== expectedKeys.size
            || keys.some(key => typeof key !== 'string' || !expectedKeys.has(key))
        ) {
            throw new TypeError();
        }

        normalized = [];
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(types, String(index));
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                throw new TypeError();
            }
            const type = descriptor.value;
            if (
                typeof type !== 'string'
                || type.trim().length === 0
                || !STREAM_TYPES.has(type)
            ) {
                throw new TypeError();
            }
            normalized.push(type);
        }
    } catch {
        throw connectorError(
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST,
            operation
        );
    }

    if (new Set(normalized).size !== normalized.length) {
        throw connectorError(
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_REQUEST,
            operation
        );
    }
    return normalized;
}

function validateToken(value) {
    try {
        if (
            value === null
            || typeof value !== 'object'
            || Array.isArray(value)
            || Object.getPrototypeOf(value) !== Object.prototype
        ) {
            return null;
        }

        const validated = {};
        for (const key of TOKEN_KEYS) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                return null;
            }
            validated[key] = descriptor.value;
        }

        if (
            typeof validated.access_token !== 'string'
            || validated.access_token.trim().length === 0
            || typeof validated.refresh_token !== 'string'
            || validated.refresh_token.trim().length === 0
            || typeof validated.expires_at !== 'number'
            || !Number.isFinite(validated.expires_at)
        ) {
            return null;
        }
        return validated;
    } catch {
        return null;
    }
}

function cloneJsonValue(value, active = new Set()) {
    if (
        value === null
        || typeof value === 'string'
        || typeof value === 'boolean'
    ) {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError();
        }
        return value;
    }
    if (typeof value !== 'object') {
        throw new TypeError();
    }

    try {
        if (active.has(value)) {
            throw new TypeError();
        }
        active.add(value);

        if (Array.isArray(value)) {
            if (Object.getPrototypeOf(value) !== Array.prototype) {
                throw new TypeError();
            }
            const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
            if (
                !lengthDescriptor
                || !Object.hasOwn(lengthDescriptor, 'value')
                || !Number.isSafeInteger(lengthDescriptor.value)
                || lengthDescriptor.value < 0
            ) {
                throw new TypeError();
            }

            const keys = Reflect.ownKeys(value);
            const expectedKeys = new Set([
                ...Array.from(
                    { length: lengthDescriptor.value },
                    (_, index) => String(index)
                ),
                'length'
            ]);
            if (
                keys.length !== expectedKeys.size
                || keys.some(key => typeof key !== 'string' || !expectedKeys.has(key))
            ) {
                throw new TypeError();
            }

            const result = [];
            for (let index = 0; index < lengthDescriptor.value; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                    throw new TypeError();
                }
                result.push(cloneJsonValue(descriptor.value, active));
            }
            active.delete(value);
            return result;
        }

        if (Object.getPrototypeOf(value) !== Object.prototype) {
            throw new TypeError();
        }

        const result = {};
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string') {
                throw new TypeError();
            }
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
                throw new TypeError();
            }
            Object.defineProperty(result, key, {
                value: cloneJsonValue(descriptor.value, active),
                enumerable: true,
                configurable: true,
                writable: true
            });
        }
        active.delete(value);
        return result;
    } catch (error) {
        active.delete(value);
        throw error;
    }
}

function readEnvelope(result, field, expectedType, operation) {
    try {
        if (
            result === null
            || typeof result !== 'object'
            || Array.isArray(result)
            || Object.getPrototypeOf(result) !== Object.prototype
        ) {
            throw new TypeError();
        }

        const dataDescriptor = Object.getOwnPropertyDescriptor(result, field);
        if (!dataDescriptor?.enumerable || !Object.hasOwn(dataDescriptor, 'value')) {
            throw new TypeError();
        }

        const data = dataDescriptor.value;
        if (
            (expectedType === 'array' && !Array.isArray(data))
            || (
                expectedType === 'object'
                && (
                    data === null
                    || typeof data !== 'object'
                    || Array.isArray(data)
                )
            )
        ) {
            throw new TypeError();
        }

        const tokenDescriptor = Object.getOwnPropertyDescriptor(result, 'tokens');
        if (
            tokenDescriptor
            && (!tokenDescriptor.enumerable || !Object.hasOwn(tokenDescriptor, 'value'))
        ) {
            throw new TypeError();
        }

        return {
            data: cloneJsonValue(data),
            tokens: tokenDescriptor ? tokenDescriptor.value : null,
            hasTokens: Boolean(tokenDescriptor)
        };
    } catch {
        throw connectorError(
            STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
            operation
        );
    }
}

function readStatus(response) {
    try {
        const status = response?.status;
        return Number.isInteger(status) && status >= 100 && status <= 599
            ? status
            : null;
    } catch {
        return null;
    }
}

function readRetryAfterSeconds(response, now) {
    try {
        const value = response?.headers?.get('Retry-After');
        if (typeof value !== 'string' || value.length === 0) {
            return null;
        }
        if (/^[0-9]+$/.test(value)) {
            const seconds = Number(value);
            return Number.isSafeInteger(seconds) ? seconds : null;
        }

        const imfFixdate = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), [0-9]{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT$/;
        if (!imfFixdate.test(value)) {
            return null;
        }

        const timestamp = Date.parse(value);
        if (
            !Number.isFinite(timestamp)
            || new Date(timestamp).toUTCString() !== value
        ) {
            return null;
        }
        const current = now();
        if (!Number.isFinite(current)) {
            return null;
        }
        return Math.max(0, Math.ceil((timestamp - current) / 1000));
    } catch {
        return null;
    }
}

function httpError(status, operation, response, now) {
    if (status === 401) {
        return connectorError(
            STRAVA_CONNECTOR_ERROR_CODE.HTTP_UNAUTHENTICATED,
            operation,
            { httpStatus: status }
        );
    }
    if (status === 403) {
        return connectorError(
            STRAVA_CONNECTOR_ERROR_CODE.HTTP_FORBIDDEN,
            operation,
            { httpStatus: status }
        );
    }
    if (
        status === 404
        && (operation === 'getActivity' || operation === 'getGear')
    ) {
        return connectorError(
            STRAVA_CONNECTOR_ERROR_CODE.HTTP_NOT_FOUND,
            operation,
            { httpStatus: status }
        );
    }
    if (status === 429) {
        return connectorError(
            STRAVA_CONNECTOR_ERROR_CODE.HTTP_RATE_LIMITED,
            operation,
            {
                retryable: true,
                httpStatus: status,
                retryAfterSeconds: readRetryAfterSeconds(response, now)
            }
        );
    }
    return connectorError(
        STRAVA_CONNECTOR_ERROR_CODE.HTTP_SERVER_ERROR,
        operation,
        {
            retryable: status === null || status >= 500,
            httpStatus: status
        }
    );
}

export class StravaApiConnector {
    #fetchImpl;
    #tokenReader;
    #tokenWriter;
    #tokenEncoder;
    #now;

    constructor(options = {}) {
        const normalized = normalizeConstructorOptions(options);
        this.#fetchImpl = normalized.fetchImpl;
        this.#tokenReader = normalized.tokenReader;
        this.#tokenWriter = normalized.tokenWriter;
        this.#tokenEncoder = normalized.tokenEncoder;
        this.#now = normalized.now;
    }

    fetchActivities() {
        return this.#request({
            operation: 'listActivities',
            url: '/api/strava-activities',
            field: 'activities',
            expectedType: 'array'
        });
    }

    fetchActivity(activityId) {
        const operation = 'getActivity';
        const id = normalizeResourceId(activityId, operation);
        return this.#request({
            operation,
            url: `/api/strava-activity?id=${encodeURIComponent(id)}`,
            field: 'activity',
            expectedType: 'object'
        });
    }

    fetchStreams(activityId, options) {
        const operation = 'getStreams';
        const id = normalizeResourceId(activityId, operation);
        const types = normalizeStreamTypes(options, operation);
        return this.#request({
            operation,
            url: `/api/strava-streams?id=${encodeURIComponent(id)}&type=${encodeURIComponent(types.join(','))}`,
            field: 'streams',
            expectedType: 'object'
        });
    }

    fetchAthlete() {
        return this.#request({
            operation: 'getAthlete',
            url: '/api/strava-athlete',
            field: 'athlete',
            expectedType: 'object'
        });
    }

    fetchZones() {
        return this.#request({
            operation: 'getZones',
            url: '/api/strava-zones',
            field: 'zones',
            expectedType: 'object'
        });
    }

    fetchGear(gearId) {
        const operation = 'getGear';
        const id = normalizeResourceId(gearId, operation);
        return this.#request({
            operation,
            url: `/api/strava-gear?id=${encodeURIComponent(id)}`,
            field: 'gear',
            expectedType: 'object'
        });
    }

    #authorization(operation) {
        let rawToken;
        try {
            rawToken = this.#tokenReader();
        } catch {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.TOKEN_READ_FAILED,
                operation
            );
        }

        if (rawToken === null || rawToken === '') {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.TOKEN_ABSENT,
                operation
            );
        }
        if (typeof rawToken !== 'string') {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.TOKEN_INVALID,
                operation
            );
        }

        let parsedToken;
        try {
            parsedToken = JSON.parse(rawToken);
        } catch {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.TOKEN_INVALID,
                operation
            );
        }
        if (validateToken(parsedToken) === null) {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.TOKEN_INVALID,
                operation
            );
        }

        let encoded;
        try {
            encoded = this.#tokenEncoder(rawToken);
        } catch {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.TOKEN_ENCODING_FAILED,
                operation
            );
        }
        if (typeof encoded !== 'string' || encoded.length === 0) {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.TOKEN_ENCODING_FAILED,
                operation
            );
        }
        return `Bearer ${encoded}`;
    }

    #persistRefreshedToken(tokens, operation, hasTokens) {
        if (!hasTokens || tokens === null) {
            return;
        }
        const validated = validateToken(tokens);
        if (validated === null) {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
                operation
            );
        }

        let serialized;
        try {
            serialized = JSON.stringify(validated);
        } catch {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.INVALID_ENVELOPE,
                operation
            );
        }

        try {
            this.#tokenWriter(serialized);
        } catch {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.TOKEN_WRITE_FAILED,
                operation
            );
        }
    }

    async #request({
        operation,
        url,
        field,
        expectedType
    }) {
        const authorization = this.#authorization(operation);
        let response;
        try {
            response = await this.#fetchImpl(url, {
                method: 'GET',
                headers: {
                    Authorization: authorization
                }
            });
        } catch {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.NETWORK_FAILED,
                operation,
                { retryable: true }
            );
        }

        const status = readStatus(response);
        if (status === null || status < 200 || status >= 300) {
            throw httpError(status, operation, response, this.#now);
        }

        let result;
        try {
            if (typeof response?.json !== 'function') {
                throw new TypeError();
            }
            result = await response.json();
        } catch {
            throw connectorError(
                STRAVA_CONNECTOR_ERROR_CODE.INVALID_JSON,
                operation
            );
        }

        const envelope = readEnvelope(result, field, expectedType, operation);
        this.#persistRefreshedToken(
            envelope.tokens,
            operation,
            envelope.hasTokens
        );
        return envelope.data;
    }
}
