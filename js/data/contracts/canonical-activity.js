import {
  createValidationItem,
  createValidationResult,
  VALIDATION_CODES
} from './errors.js';
import {
  appendJsonPointer,
  collectJsonSafetyErrors,
  collectMissingRequiredFields,
  collectUnknownFieldWarnings,
  inspectOwnEnumerableDataProperty,
  isFiniteNumber,
  isIanaNameFormat,
  isIntegerInRange,
  isNonEmptyOpaqueString,
  isNonNegativeFiniteNumber,
  isNormalizedSlug,
  isPlainObject,
  isStrictBoolean,
  isStrictUtcInstant
} from './primitives.js';

const ACTIVITY_PATH = '/activity';
const SUPPORTED_SCHEMA_VERSION = 1;

const SPORT_CATEGORIES = new Set([
  'run',
  'ride',
  'swim',
  'walk',
  'hike',
  'workout',
  'winter',
  'team',
  'racket',
  'other'
]);

const REQUIRED_ACTIVITY_FIELDS = [
  'schemaVersion',
  'id',
  'sportCategory',
  'sportVariant',
  'startTimeUtc',
  'timeZone',
  'capabilities'
];

const ACTIVITY_FIELDS = new Set([
  ...REQUIRED_ACTIVITY_FIELDS,
  'name',
  'distanceMeters',
  'movingTimeSeconds',
  'elapsedTimeSeconds',
  'elevationGainMeters',
  'averageHeartRateBpm',
  'averagePowerWatts',
  'averageCadence',
  'extensions'
]);

const TIME_ZONE_FIELDS = new Set(['ianaName', 'utcOffsetMinutes']);
const REQUIRED_TIME_ZONE_FIELDS = [...TIME_ZONE_FIELDS];

const CAPABILITY_FIELDS = new Set([
  'hasGps',
  'hasHeartRate',
  'hasPower',
  'hasCadence',
  'hasLaps'
]);
const REQUIRED_CAPABILITY_FIELDS = [...CAPABILITY_FIELDS];

const NON_NEGATIVE_SUMMARY_FIELDS = [
  'distanceMeters',
  'movingTimeSeconds',
  'elapsedTimeSeconds',
  'elevationGainMeters',
  'averagePowerWatts',
  'averageCadence'
];

function addError(errors, code, path, message) {
  errors.push(createValidationItem(code, path, message));
}

function readProperty(value, field) {
  const property = inspectOwnEnumerableDataProperty(value, field);
  return property.kind === 'value' ? property : null;
}

function validateSchemaVersion(value, errors) {
  const path = appendJsonPointer(ACTIVITY_PATH, 'schemaVersion');
  const property = readProperty(value, 'schemaVersion');
  if (!property) return;

  if (!Number.isInteger(property.value)) {
    addError(
      errors,
      VALIDATION_CODES.VERSION_INVALID,
      path,
      'Expected an integer schema version.'
    );
    return;
  }

  if (property.value !== SUPPORTED_SCHEMA_VERSION) {
    addError(
      errors,
      VALIDATION_CODES.VERSION_UNSUPPORTED,
      path,
      'Schema version is not supported.'
    );
  }
}

function validateId(value, errors) {
  const property = readProperty(value, 'id');
  if (!property) return;
  if (isNonEmptyOpaqueString(property.value)) return;

  addError(
    errors,
    VALIDATION_CODES.ID_INVALID,
    appendJsonPointer(ACTIVITY_PATH, 'id'),
    'Expected a non-empty opaque string.'
  );
}

function validateSport(value, errors) {
  const category = readProperty(value, 'sportCategory');
  if (category && !SPORT_CATEGORIES.has(category.value)) {
    addError(
      errors,
      VALIDATION_CODES.VALUE_INVALID,
      appendJsonPointer(ACTIVITY_PATH, 'sportCategory'),
      'Expected a supported sport category.'
    );
  }

  const variant = readProperty(value, 'sportVariant');
  if (
    variant &&
    variant.value !== null &&
    !isNormalizedSlug(variant.value)
  ) {
    addError(
      errors,
      VALIDATION_CODES.VALUE_INVALID,
      appendJsonPointer(ACTIVITY_PATH, 'sportVariant'),
      'Expected null or a normalized source-neutral slug.'
    );
  }
}

function validateStartTime(value, errors) {
  const property = readProperty(value, 'startTimeUtc');
  if (!property) return;
  if (isStrictUtcInstant(property.value)) return;

  addError(
    errors,
    VALIDATION_CODES.TIMESTAMP_INVALID,
    appendJsonPointer(ACTIVITY_PATH, 'startTimeUtc'),
    'Expected an RFC 3339 UTC instant with millisecond precision.'
  );
}

function validateTimeZone(value, errors, warnings) {
  const property = readProperty(value, 'timeZone');
  if (!property) return;

  const path = appendJsonPointer(ACTIVITY_PATH, 'timeZone');
  const timeZone = property.value;
  if (!isPlainObject(timeZone)) {
    addError(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      path,
      'Expected a plain time zone object.'
    );
    return;
  }

  collectMissingRequiredFields(
    timeZone,
    REQUIRED_TIME_ZONE_FIELDS,
    path,
    errors
  );
  collectUnknownFieldWarnings(timeZone, TIME_ZONE_FIELDS, path, warnings);

  const ianaName = readProperty(timeZone, 'ianaName');
  if (
    ianaName &&
    ianaName.value !== null &&
    !isIanaNameFormat(ianaName.value)
  ) {
    addError(
      errors,
      VALIDATION_CODES.VALUE_INVALID,
      appendJsonPointer(path, 'ianaName'),
      'Expected null or a stable IANA name format.'
    );
  }

  const utcOffsetMinutes = readProperty(timeZone, 'utcOffsetMinutes');
  if (
    utcOffsetMinutes &&
    utcOffsetMinutes.value !== null &&
    !isIntegerInRange(utcOffsetMinutes.value, -840, 840)
  ) {
    const code =
      Number.isInteger(utcOffsetMinutes.value)
        ? VALIDATION_CODES.RANGE_INVALID
        : VALIDATION_CODES.NUMBER_INVALID;
    addError(
      errors,
      code,
      appendJsonPointer(path, 'utcOffsetMinutes'),
      'Expected null or an integer UTC offset from -840 to 840 minutes.'
    );
  }
}

function validateCapabilities(value, errors, warnings) {
  const property = readProperty(value, 'capabilities');
  if (!property) return;

  const path = appendJsonPointer(ACTIVITY_PATH, 'capabilities');
  const capabilities = property.value;
  if (!isPlainObject(capabilities)) {
    addError(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      path,
      'Expected a plain capabilities object.'
    );
    return;
  }

  collectMissingRequiredFields(
    capabilities,
    REQUIRED_CAPABILITY_FIELDS,
    path,
    errors
  );
  collectUnknownFieldWarnings(
    capabilities,
    CAPABILITY_FIELDS,
    path,
    warnings
  );

  for (const field of REQUIRED_CAPABILITY_FIELDS) {
    const capability = readProperty(capabilities, field);
    if (!capability) continue;
    if (isStrictBoolean(capability.value)) continue;
    addError(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      appendJsonPointer(path, field),
      'Expected a boolean capability.'
    );
  }
}

function validateNullableNonNegativeNumber(value, field, errors) {
  const property = readProperty(value, field);
  if (!property || property.value === null) return;

  const path = appendJsonPointer(ACTIVITY_PATH, field);
  if (!isFiniteNumber(property.value)) {
    addError(
      errors,
      VALIDATION_CODES.NUMBER_INVALID,
      path,
      'Expected null or a finite number.'
    );
    return;
  }

  if (property.value < 0) {
    addError(
      errors,
      VALIDATION_CODES.RANGE_INVALID,
      path,
      'Expected null or a non-negative number.'
    );
  }
}

function validateSummaries(value, errors) {
  const name = readProperty(value, 'name');
  if (
    name &&
    name.value !== null &&
    typeof name.value !== 'string'
  ) {
    addError(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      appendJsonPointer(ACTIVITY_PATH, 'name'),
      'Expected null or a string.'
    );
  }

  for (const field of NON_NEGATIVE_SUMMARY_FIELDS) {
    validateNullableNonNegativeNumber(value, field, errors);
  }

  const heartRate = readProperty(value, 'averageHeartRateBpm');
  if (heartRate && heartRate.value !== null) {
    const path = appendJsonPointer(ACTIVITY_PATH, 'averageHeartRateBpm');
    if (!isFiniteNumber(heartRate.value)) {
      addError(
        errors,
        VALIDATION_CODES.NUMBER_INVALID,
        path,
        'Expected null or a finite heart rate.'
      );
    } else if (
      heartRate.value <= 0 ||
      heartRate.value > 300
    ) {
      addError(
        errors,
        VALIDATION_CODES.RANGE_INVALID,
        path,
        'Expected null or a heart rate greater than 0 and at most 300 bpm.'
      );
    }
  }

  const extensions = readProperty(value, 'extensions');
  if (
    extensions &&
    extensions.value !== null &&
    !isPlainObject(extensions.value)
  ) {
    addError(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      appendJsonPointer(ACTIVITY_PATH, 'extensions'),
      'Expected null or a plain JSON-safe object.'
    );
  }

  const movingTime = readProperty(value, 'movingTimeSeconds');
  const elapsedTime = readProperty(value, 'elapsedTimeSeconds');
  if (
    movingTime &&
    elapsedTime &&
    isNonNegativeFiniteNumber(movingTime.value) &&
    isNonNegativeFiniteNumber(elapsedTime.value) &&
    movingTime.value > elapsedTime.value
  ) {
    addError(
      errors,
      VALIDATION_CODES.RELATION_INVALID,
      appendJsonPointer(ACTIVITY_PATH, 'movingTimeSeconds'),
      'Moving time must not exceed elapsed time.'
    );
  }
}

export function validateCanonicalActivity(value) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(value)) {
    addError(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      ACTIVITY_PATH,
      'Expected a plain CanonicalActivity object.'
    );
    return createValidationResult(errors, warnings);
  }

  collectJsonSafetyErrors(value, ACTIVITY_PATH, errors);
  collectMissingRequiredFields(
    value,
    REQUIRED_ACTIVITY_FIELDS,
    ACTIVITY_PATH,
    errors
  );
  collectUnknownFieldWarnings(value, ACTIVITY_FIELDS, ACTIVITY_PATH, warnings);

  validateSchemaVersion(value, errors);
  validateId(value, errors);
  validateSport(value, errors);
  validateStartTime(value, errors);
  validateTimeZone(value, errors, warnings);
  validateCapabilities(value, errors, warnings);
  validateSummaries(value, errors);

  return createValidationResult(errors, warnings);
}
