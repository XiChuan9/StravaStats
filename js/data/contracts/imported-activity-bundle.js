import { validateCanonicalActivity } from './canonical-activity.js';
import { validateCanonicalStreamSet } from './canonical-streams.js';
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
  isNonEmptyOpaqueString,
  isNonNegativeFiniteNumber,
  isPlainObject,
  isStrictUtcInstant
} from './primitives.js';

const SUPPORTED_SCHEMA_VERSION = 1;
const BUNDLE_FIELDS = new Set([
  'schemaVersion',
  'activity',
  'streams',
  'laps',
  'events',
  'sources',
  'devices',
  'warnings',
  'versionMetadata'
]);
const REQUIRED_BUNDLE_FIELDS = [...BUNDLE_FIELDS];
const LAP_FIELDS = new Set([
  'id',
  'activityId',
  'index',
  'startOffsetSeconds',
  'elapsedTimeSeconds',
  'movingTimeSeconds',
  'distanceMeters'
]);
const REQUIRED_LAP_FIELDS = [
  'id',
  'activityId',
  'index',
  'startOffsetSeconds',
  'elapsedTimeSeconds'
];
const EVENT_FIELDS = new Set([
  'id',
  'activityId',
  'index',
  'type',
  'offsetSeconds',
  'sourceType'
]);
const REQUIRED_EVENT_FIELDS = [
  'id',
  'activityId',
  'index',
  'type',
  'offsetSeconds'
];
const EVENT_TYPES = new Set([
  'start',
  'pause',
  'resume',
  'stop',
  'marker',
  'unknown'
]);
const SOURCE_FIELDS = new Set([
  'id',
  'activityId',
  'provider',
  'externalId',
  'rawArtifactId',
  'acquisitionMethod',
  'deviceId',
  'importedAt'
]);
const REQUIRED_SOURCE_FIELDS = [
  'id',
  'activityId',
  'provider',
  'acquisitionMethod',
  'importedAt'
];
const DEVICE_FIELDS = new Set(['id', 'manufacturer', 'model']);
const REQUIRED_DEVICE_FIELDS = ['id'];
const VERSION_FIELDS = new Set([
  'schemaVersion',
  'parserVersion',
  'normalizerVersion',
  'analysisVersion',
  'settingsVersion',
  'inputHash'
]);
const REQUIRED_VERSION_FIELDS = ['schemaVersion'];
const OPTIONAL_VERSION_FIELDS = [
  'parserVersion',
  'normalizerVersion',
  'analysisVersion',
  'settingsVersion',
  'inputHash'
];
const BUNDLE_WARNING_FIELDS = new Set(['code', 'path', 'message']);
const REQUIRED_BUNDLE_WARNING_FIELDS = [...BUNDLE_WARNING_FIELDS];

function addItem(items, code, path, message) {
  items.push(createValidationItem(code, path, message));
}

function readProperty(value, field) {
  const property = inspectOwnEnumerableDataProperty(value, field);
  return property.kind === 'value' ? property : null;
}

function inspectArray(value) {
  let isArray;
  try {
    isArray = Array.isArray(value);
  } catch {
    return null;
  }
  if (!isArray) return null;

  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, 'length');
  } catch {
    return null;
  }
  if (
    !descriptor ||
    !Object.prototype.hasOwnProperty.call(descriptor, 'value') ||
    !Number.isSafeInteger(descriptor.value) ||
    descriptor.value < 0
  ) {
    return null;
  }

  return {
    length: descriptor.value,
    read(index) {
      return readProperty(value, String(index));
    }
  };
}

function validateOpaqueId(property, path, errors) {
  if (!property || isNonEmptyOpaqueString(property.value)) return;
  addItem(
    errors,
    VALIDATION_CODES.ID_INVALID,
    path,
    'Expected a non-empty opaque string.'
  );
}

function validateRequiredString(property, path, errors) {
  if (!property || isNonEmptyOpaqueString(property.value)) return;
  addItem(
    errors,
    VALIDATION_CODES.VALUE_INVALID,
    path,
    'Expected a non-empty string.'
  );
}

function validateOptionalOpaqueId(value, field, path, errors) {
  const property = readProperty(value, field);
  if (!property || property.value === null) return null;
  if (!isNonEmptyOpaqueString(property.value)) {
    addItem(
      errors,
      VALIDATION_CODES.ID_INVALID,
      appendJsonPointer(path, field),
      'Expected null or a non-empty opaque string.'
    );
    return null;
  }
  return property.value;
}

function validateOptionalString(value, field, path, errors) {
  const property = readProperty(value, field);
  if (
    !property ||
    property.value === null ||
    typeof property.value === 'string'
  ) {
    return;
  }
  addItem(
    errors,
    VALIDATION_CODES.TYPE_INVALID,
    appendJsonPointer(path, field),
    'Expected null or a string.'
  );
}

function validateNonNegativeNumber(
  property,
  path,
  errors,
  nullable = false
) {
  if (!property || (nullable && property.value === null)) return null;
  if (!isFiniteNumber(property.value)) {
    addItem(
      errors,
      VALIDATION_CODES.NUMBER_INVALID,
      path,
      nullable
        ? 'Expected null or a finite number.'
        : 'Expected a finite number.'
    );
    return null;
  }
  if (property.value < 0) {
    addItem(
      errors,
      VALIDATION_CODES.RANGE_INVALID,
      path,
      nullable
        ? 'Expected null or a non-negative number.'
        : 'Expected a non-negative number.'
    );
    return null;
  }
  return property.value;
}

function validateIndex(property, path, errors) {
  if (!property) return null;
  if (!Number.isInteger(property.value)) {
    addItem(
      errors,
      VALIDATION_CODES.NUMBER_INVALID,
      path,
      'Expected a non-negative integer index.'
    );
    return null;
  }
  if (property.value < 0) {
    addItem(
      errors,
      VALIDATION_CODES.RANGE_INVALID,
      path,
      'Expected a non-negative integer index.'
    );
    return null;
  }
  return property.value;
}

function addDuplicate(errors, path, kind) {
  addItem(
    errors,
    VALIDATION_CODES.DUPLICATE_VALUE,
    path,
    `${kind} must be unique within the bundle.`
  );
}

function addReferenceError(errors, path) {
  addItem(
    errors,
    VALIDATION_CODES.REFERENCE_INVALID,
    path,
    'Reference must resolve within this bundle.'
  );
}

function validateSchemaVersion(property, path, errors) {
  if (!property) return null;
  if (!Number.isInteger(property.value)) {
    addItem(
      errors,
      VALIDATION_CODES.VERSION_INVALID,
      path,
      'Expected an integer schema version.'
    );
    return null;
  }
  if (property.value !== SUPPORTED_SCHEMA_VERSION) {
    addItem(
      errors,
      VALIDATION_CODES.VERSION_UNSUPPORTED,
      path,
      'Schema version is not supported.'
    );
  }
  return property.value;
}

function validateObjectArray(property, path, errors, itemValidator) {
  if (!property) return null;
  const array = inspectArray(property.value);
  if (!array) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      path,
      'Expected a plain array.'
    );
    return null;
  }

  for (let index = 0; index < array.length; index += 1) {
    const item = array.read(index);
    if (!item) continue;
    itemValidator(item.value, index);
  }
  return array;
}

function validateLapObject(lap, index, context) {
  const {
    activityId,
    activityElapsedTime,
    errors,
    warnings,
    ids,
    indices,
    order
  } = context;
  const path = `/laps/${index}`;
  if (!isPlainObject(lap)) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      path,
      'Expected a plain Lap object.'
    );
    return;
  }

  collectMissingRequiredFields(lap, REQUIRED_LAP_FIELDS, path, errors);
  collectUnknownFieldWarnings(lap, LAP_FIELDS, path, warnings);

  const id = readProperty(lap, 'id');
  const lapActivityId = readProperty(lap, 'activityId');
  validateOpaqueId(id, `${path}/id`, errors);
  validateOpaqueId(lapActivityId, `${path}/activityId`, errors);
  if (id && isNonEmptyOpaqueString(id.value)) {
    if (ids.has(id.value)) addDuplicate(errors, `${path}/id`, 'Lap ID');
    else ids.add(id.value);
  }
  if (
    lapActivityId &&
    isNonEmptyOpaqueString(lapActivityId.value) &&
    activityId !== null &&
    lapActivityId.value !== activityId
  ) {
    addReferenceError(errors, `${path}/activityId`);
  }

  const lapIndex = validateIndex(
    readProperty(lap, 'index'),
    `${path}/index`,
    errors
  );
  if (lapIndex !== null) {
    if (indices.has(lapIndex)) {
      addDuplicate(errors, `${path}/index`, 'Lap index');
    } else {
      indices.add(lapIndex);
    }
  }

  const start = validateNonNegativeNumber(
    readProperty(lap, 'startOffsetSeconds'),
    `${path}/startOffsetSeconds`,
    errors
  );
  const elapsed = validateNonNegativeNumber(
    readProperty(lap, 'elapsedTimeSeconds'),
    `${path}/elapsedTimeSeconds`,
    errors
  );
  const moving = validateNonNegativeNumber(
    readProperty(lap, 'movingTimeSeconds'),
    `${path}/movingTimeSeconds`,
    errors,
    true
  );
  validateNonNegativeNumber(
    readProperty(lap, 'distanceMeters'),
    `${path}/distanceMeters`,
    errors,
    true
  );

  if (moving !== null && elapsed !== null && moving > elapsed) {
    addItem(
      errors,
      VALIDATION_CODES.RELATION_INVALID,
      `${path}/movingTimeSeconds`,
      'Moving time must not exceed elapsed time.'
    );
  }
  if (start !== null) {
    if (order.previousStart !== null && start < order.previousStart) {
      addItem(
        errors,
        VALIDATION_CODES.ORDER_INVALID,
        `${path}/startOffsetSeconds`,
        'Laps must be in non-decreasing start order.'
      );
    }
    if (order.previousEnd !== null && start < order.previousEnd) {
      addItem(
        errors,
        VALIDATION_CODES.ORDER_INVALID,
        `${path}/startOffsetSeconds`,
        'Laps must not overlap.'
      );
    }
    order.previousStart = start;
    if (elapsed !== null) order.previousEnd = start + elapsed;
  }
  if (
    start !== null &&
    elapsed !== null &&
    activityElapsedTime !== null &&
    start + elapsed > activityElapsedTime
  ) {
    addItem(
      errors,
      VALIDATION_CODES.RELATION_INVALID,
      `${path}/elapsedTimeSeconds`,
      'Lap must not exceed the activity duration.'
    );
  }
}

function applyEventTransition(type, state) {
  if (type === 'start') {
    return state === 'not-started' ? 'active' : null;
  }
  if (type === 'pause') return state === 'active' ? 'paused' : null;
  if (type === 'resume') return state === 'paused' ? 'active' : null;
  if (type === 'stop') {
    return state === 'active' || state === 'paused' ? 'stopped' : null;
  }
  return state;
}

function validateEventObject(event, index, context) {
  const {
    activityId,
    activityElapsedTime,
    errors,
    warnings,
    ids,
    indices,
    order
  } = context;
  const path = `/events/${index}`;
  if (!isPlainObject(event)) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      path,
      'Expected a plain Event object.'
    );
    return;
  }

  collectMissingRequiredFields(event, REQUIRED_EVENT_FIELDS, path, errors);
  collectUnknownFieldWarnings(event, EVENT_FIELDS, path, warnings);

  const id = readProperty(event, 'id');
  const eventActivityId = readProperty(event, 'activityId');
  validateOpaqueId(id, `${path}/id`, errors);
  validateOpaqueId(eventActivityId, `${path}/activityId`, errors);
  if (id && isNonEmptyOpaqueString(id.value)) {
    if (ids.has(id.value)) addDuplicate(errors, `${path}/id`, 'Event ID');
    else ids.add(id.value);
  }
  if (
    eventActivityId &&
    isNonEmptyOpaqueString(eventActivityId.value) &&
    activityId !== null &&
    eventActivityId.value !== activityId
  ) {
    addReferenceError(errors, `${path}/activityId`);
  }

  const eventIndex = validateIndex(
    readProperty(event, 'index'),
    `${path}/index`,
    errors
  );
  if (eventIndex !== null) {
    if (indices.has(eventIndex)) {
      addDuplicate(errors, `${path}/index`, 'Event index');
    } else {
      indices.add(eventIndex);
    }
  }

  const offset = validateNonNegativeNumber(
    readProperty(event, 'offsetSeconds'),
    `${path}/offsetSeconds`,
    errors
  );
  if (offset !== null) {
    if (order.previousOffset !== null && offset < order.previousOffset) {
      addItem(
        errors,
        VALIDATION_CODES.ORDER_INVALID,
        `${path}/offsetSeconds`,
        'Events must be in non-decreasing offset order.'
      );
    }
    order.previousOffset = offset;
    if (
      activityElapsedTime !== null &&
      offset > activityElapsedTime
    ) {
      addItem(
        errors,
        VALIDATION_CODES.RELATION_INVALID,
        `${path}/offsetSeconds`,
        'Event must not exceed the activity duration.'
      );
    }
  }

  const type = readProperty(event, 'type');
  const sourceType = readProperty(event, 'sourceType');
  let knownType = null;
  if (type && EVENT_TYPES.has(type.value)) {
    knownType = type.value;
  } else if (type) {
    addItem(
      errors,
      VALIDATION_CODES.VALUE_INVALID,
      `${path}/type`,
      'Expected a supported source-neutral event type.'
    );
  }

  if (knownType === 'unknown' && !sourceType) {
    addItem(
      errors,
      VALIDATION_CODES.REQUIRED_FIELD_MISSING,
      `${path}/sourceType`,
      'Expected a required field.'
    );
  }
  if (sourceType && !isNonEmptyOpaqueString(sourceType.value)) {
    addItem(
      errors,
      VALIDATION_CODES.VALUE_INVALID,
      `${path}/sourceType`,
      'Expected a non-empty source event type.'
    );
  }

  if (
    knownType &&
    knownType !== 'marker' &&
    knownType !== 'unknown'
  ) {
    const nextState = applyEventTransition(knownType, order.state);
    if (nextState === null) {
      addItem(
        errors,
        VALIDATION_CODES.STATE_INVALID,
        `${path}/type`,
        'Event transition is invalid for the current activity state.'
      );
    } else {
      order.state = nextState;
    }
  }
}

function validateDeviceObject(device, index, context) {
  const { errors, warnings, ids } = context;
  const path = `/devices/${index}`;
  if (!isPlainObject(device)) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      path,
      'Expected a plain DeviceReference object.'
    );
    return;
  }
  collectMissingRequiredFields(device, REQUIRED_DEVICE_FIELDS, path, errors);
  collectUnknownFieldWarnings(device, DEVICE_FIELDS, path, warnings);

  const id = readProperty(device, 'id');
  validateOpaqueId(id, `${path}/id`, errors);
  if (id && isNonEmptyOpaqueString(id.value)) {
    if (ids.has(id.value)) addDuplicate(errors, `${path}/id`, 'Device ID');
    else ids.add(id.value);
  }
  validateOptionalString(device, 'manufacturer', path, errors);
  validateOptionalString(device, 'model', path, errors);
}

function validateSourceObject(source, index, context) {
  const {
    activityId,
    deviceIds,
    errors,
    warnings,
    ids
  } = context;
  const path = `/sources/${index}`;
  if (!isPlainObject(source)) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      path,
      'Expected a plain ActivitySource object.'
    );
    return;
  }
  collectMissingRequiredFields(source, REQUIRED_SOURCE_FIELDS, path, errors);
  collectUnknownFieldWarnings(source, SOURCE_FIELDS, path, warnings);

  const id = readProperty(source, 'id');
  const sourceActivityId = readProperty(source, 'activityId');
  validateOpaqueId(id, `${path}/id`, errors);
  validateOpaqueId(sourceActivityId, `${path}/activityId`, errors);
  if (id && isNonEmptyOpaqueString(id.value)) {
    if (ids.has(id.value)) addDuplicate(errors, `${path}/id`, 'Source ID');
    else ids.add(id.value);
  }
  if (
    sourceActivityId &&
    isNonEmptyOpaqueString(sourceActivityId.value) &&
    activityId !== null &&
    sourceActivityId.value !== activityId
  ) {
    addReferenceError(errors, `${path}/activityId`);
  }

  validateRequiredString(
    readProperty(source, 'provider'),
    `${path}/provider`,
    errors
  );
  validateRequiredString(
    readProperty(source, 'acquisitionMethod'),
    `${path}/acquisitionMethod`,
    errors
  );
  validateOptionalOpaqueId(source, 'externalId', path, errors);
  validateOptionalOpaqueId(source, 'rawArtifactId', path, errors);
  const deviceId = validateOptionalOpaqueId(
    source,
    'deviceId',
    path,
    errors
  );
  if (deviceId !== null && !deviceIds.has(deviceId)) {
    addReferenceError(errors, `${path}/deviceId`);
  }

  const importedAt = readProperty(source, 'importedAt');
  if (importedAt && !isStrictUtcInstant(importedAt.value)) {
    addItem(
      errors,
      VALIDATION_CODES.TIMESTAMP_INVALID,
      `${path}/importedAt`,
      'Expected an RFC 3339 UTC instant with millisecond precision.'
    );
  }
}

function validateVersionMetadata(
  value,
  bundleSchemaVersion,
  errors,
  warnings
) {
  const path = '/versionMetadata';
  if (!isPlainObject(value)) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      path,
      'Expected a plain VersionMetadata object.'
    );
    return;
  }
  collectMissingRequiredFields(
    value,
    REQUIRED_VERSION_FIELDS,
    path,
    errors
  );
  collectUnknownFieldWarnings(value, VERSION_FIELDS, path, warnings);

  const schemaVersion = validateSchemaVersion(
    readProperty(value, 'schemaVersion'),
    `${path}/schemaVersion`,
    errors
  );
  if (
    schemaVersion !== null &&
    bundleSchemaVersion !== null &&
    schemaVersion !== bundleSchemaVersion
  ) {
    addItem(
      errors,
      VALIDATION_CODES.RELATION_INVALID,
      `${path}/schemaVersion`,
      'Schema version must match the bundle schema version.'
    );
  }

  for (const field of OPTIONAL_VERSION_FIELDS) {
    const property = readProperty(value, field);
    if (
      !property ||
      property.value === null ||
      isNonEmptyOpaqueString(property.value)
    ) {
      continue;
    }
    addItem(
      errors,
      VALIDATION_CODES.VALUE_INVALID,
      appendJsonPointer(path, field),
      'Expected null or a non-empty version string.'
    );
  }
}

function validateBundleWarning(warning, index, errors, resultWarnings) {
  const path = `/warnings/${index}`;
  if (!isPlainObject(warning)) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      path,
      'Expected a plain bundle warning object.'
    );
    return;
  }
  collectMissingRequiredFields(
    warning,
    REQUIRED_BUNDLE_WARNING_FIELDS,
    path,
    errors
  );
  collectUnknownFieldWarnings(
    warning,
    BUNDLE_WARNING_FIELDS,
    path,
    resultWarnings
  );
  for (const field of REQUIRED_BUNDLE_WARNING_FIELDS) {
    const property = readProperty(warning, field);
    if (!property || typeof property.value === 'string') continue;
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      appendJsonPointer(path, field),
      'Expected a string.'
    );
  }
}

function collectStreamTypes(streams) {
  const result = new Set();
  if (!isPlainObject(streams)) return result;
  const seriesProperty = readProperty(streams, 'series');
  const series = seriesProperty
    ? inspectArray(seriesProperty.value)
    : null;
  if (!series) return result;

  for (let index = 0; index < series.length; index += 1) {
    const property = series.read(index);
    if (!property || !isPlainObject(property.value)) continue;
    const streamType = readProperty(property.value, 'streamType');
    if (streamType && isNonEmptyOpaqueString(streamType.value)) {
      result.add(streamType.value);
    }
  }
  return result;
}

function validateCapabilities(activity, streamTypes, hasLaps, errors) {
  if (!isPlainObject(activity)) return;
  const capabilitiesProperty = readProperty(activity, 'capabilities');
  if (
    !capabilitiesProperty ||
    !isPlainObject(capabilitiesProperty.value)
  ) {
    return;
  }
  const capabilities = capabilitiesProperty.value;
  const checks = [
    ['position', 'hasGps'],
    ['heartRate', 'hasHeartRate'],
    ['power', 'hasPower'],
    ['cadence', 'hasCadence']
  ];
  for (const [streamType, field] of checks) {
    const capability = readProperty(capabilities, field);
    if (
      streamTypes.has(streamType) &&
      capability &&
      capability.value === false
    ) {
      addItem(
        errors,
        VALIDATION_CODES.CAPABILITY_CONFLICT,
        `/activity/capabilities/${field}`,
        'Capability must be true when corresponding detail is present.'
      );
    }
  }

  const hasLapsCapability = readProperty(capabilities, 'hasLaps');
  if (
    hasLaps &&
    hasLapsCapability &&
    hasLapsCapability.value === false
  ) {
    addItem(
      errors,
      VALIDATION_CODES.CAPABILITY_CONFLICT,
      '/activity/capabilities/hasLaps',
      'Capability must be true when corresponding detail is present.'
    );
  }
}

function uniqueItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.code}\u0000${item.path}\u0000${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateImportedActivityBundle(value) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(value)) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      '',
      'Expected a plain ImportedActivityBundle object.'
    );
    return createValidationResult(errors, warnings);
  }

  collectJsonSafetyErrors(value, '', errors);
  collectMissingRequiredFields(
    value,
    REQUIRED_BUNDLE_FIELDS,
    '',
    errors
  );
  collectUnknownFieldWarnings(value, BUNDLE_FIELDS, '', warnings);

  const bundleSchemaVersion = validateSchemaVersion(
    readProperty(value, 'schemaVersion'),
    '/schemaVersion',
    errors
  );

  const activityProperty = readProperty(value, 'activity');
  const activity = activityProperty ? activityProperty.value : null;
  if (activityProperty) {
    const result = validateCanonicalActivity(activity);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  const streamsProperty = readProperty(value, 'streams');
  const streams = streamsProperty ? streamsProperty.value : null;
  if (streamsProperty) {
    const result = validateCanonicalStreamSet(streams);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  const activityIdProperty = isPlainObject(activity)
    ? readProperty(activity, 'id')
    : null;
  const activityId =
    activityIdProperty &&
    isNonEmptyOpaqueString(activityIdProperty.value)
      ? activityIdProperty.value
      : null;
  const activitySchemaProperty = isPlainObject(activity)
    ? readProperty(activity, 'schemaVersion')
    : null;
  if (
    activitySchemaProperty &&
    Number.isInteger(activitySchemaProperty.value) &&
    bundleSchemaVersion !== null &&
    activitySchemaProperty.value !== bundleSchemaVersion
  ) {
    addItem(
      errors,
      VALIDATION_CODES.RELATION_INVALID,
      '/activity/schemaVersion',
      'Schema version must match the bundle schema version.'
    );
  }

  if (isPlainObject(streams) && activityId !== null) {
    const streamsActivityId = readProperty(streams, 'activityId');
    if (
      streamsActivityId &&
      isNonEmptyOpaqueString(streamsActivityId.value) &&
      streamsActivityId.value !== activityId
    ) {
      addReferenceError(errors, '/streams/activityId');
    }
  }

  const activityElapsedProperty = isPlainObject(activity)
    ? readProperty(activity, 'elapsedTimeSeconds')
    : null;
  const activityElapsedTime =
    activityElapsedProperty &&
    isNonNegativeFiniteNumber(activityElapsedProperty.value)
      ? activityElapsedProperty.value
      : null;

  const deviceIds = new Set();
  validateObjectArray(
    readProperty(value, 'devices'),
    '/devices',
    errors,
    (device, index) =>
      validateDeviceObject(device, index, {
        errors,
        warnings,
        ids: deviceIds
      })
  );

  const sourceIds = new Set();
  const sources = validateObjectArray(
    readProperty(value, 'sources'),
    '/sources',
    errors,
    (source, index) =>
      validateSourceObject(source, index, {
        activityId,
        deviceIds,
        errors,
        warnings,
        ids: sourceIds
      })
  );
  if (sources && sources.length === 0) {
    addItem(
      errors,
      VALIDATION_CODES.VALUE_INVALID,
      '/sources',
      'Expected at least one activity source.'
    );
  }

  const lapIds = new Set();
  const lapIndices = new Set();
  const lapOrder = {
    previousStart: null,
    previousEnd: null
  };
  const laps = validateObjectArray(
    readProperty(value, 'laps'),
    '/laps',
    errors,
    (lap, index) =>
      validateLapObject(lap, index, {
        activityId,
        activityElapsedTime,
        errors,
        warnings,
        ids: lapIds,
        indices: lapIndices,
        order: lapOrder
      })
  );

  const eventIds = new Set();
  const eventIndices = new Set();
  const eventOrder = {
    previousOffset: null,
    state: 'not-started'
  };
  validateObjectArray(
    readProperty(value, 'events'),
    '/events',
    errors,
    (event, index) =>
      validateEventObject(event, index, {
        activityId,
        activityElapsedTime,
        errors,
        warnings,
        ids: eventIds,
        indices: eventIndices,
        order: eventOrder
      })
  );

  validateObjectArray(
    readProperty(value, 'warnings'),
    '/warnings',
    errors,
    (warning, index) =>
      validateBundleWarning(warning, index, errors, warnings)
  );

  const versionMetadata = readProperty(value, 'versionMetadata');
  if (versionMetadata) {
    validateVersionMetadata(
      versionMetadata.value,
      bundleSchemaVersion,
      errors,
      warnings
    );
  }

  const streamTypes = collectStreamTypes(streams);
  validateCapabilities(
    activity,
    streamTypes,
    Boolean(laps && laps.length > 0),
    errors
  );

  return createValidationResult(
    uniqueItems(errors),
    uniqueItems(warnings)
  );
}
