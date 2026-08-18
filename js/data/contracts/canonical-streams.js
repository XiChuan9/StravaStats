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
  isPlainObject
} from './primitives.js';

const STREAMS_PATH = '/streams';
const STREAM_SET_FIELDS = new Set(['activityId', 'series']);
const REQUIRED_STREAM_SET_FIELDS = [...STREAM_SET_FIELDS];
const STREAM_SERIES_FIELDS = new Set([
  'streamType',
  'unit',
  'offsetsSeconds',
  'values',
  'quality'
]);
const REQUIRED_STREAM_SERIES_FIELDS = [
  'streamType',
  'unit',
  'offsetsSeconds',
  'values'
];
const NON_NEGATIVE_STREAM_TYPES = new Set([
  'distance',
  'power',
  'cadence'
]);

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

function validateId(property, path, errors) {
  if (!property || isNonEmptyOpaqueString(property.value)) return;
  addItem(
    errors,
    VALIDATION_CODES.ID_INVALID,
    path,
    'Expected a non-empty opaque string.'
  );
}

function validateNonEmptyString(property, path, errors) {
  if (!property || isNonEmptyOpaqueString(property.value)) return;
  addItem(
    errors,
    VALIDATION_CODES.VALUE_INVALID,
    path,
    'Expected a non-empty string.'
  );
}

function validateOffsets(array, path, errors, warnings) {
  let previous;
  let hasPrevious = false;

  for (let index = 0; index < array.length; index += 1) {
    const property = array.read(index);
    if (!property) continue;
    const itemPath = appendJsonPointer(path, index);
    const offset = property.value;

    if (!isFiniteNumber(offset)) {
      addItem(
        errors,
        VALIDATION_CODES.NUMBER_INVALID,
        itemPath,
        'Expected a finite offset in seconds.'
      );
      continue;
    }
    if (offset < 0) {
      addItem(
        errors,
        VALIDATION_CODES.RANGE_INVALID,
        itemPath,
        'Expected a non-negative offset in seconds.'
      );
    }
    if (hasPrevious && offset < previous) {
      addItem(
        errors,
        VALIDATION_CODES.ORDER_INVALID,
        itemPath,
        'Offsets must be in non-decreasing order.'
      );
    } else if (hasPrevious && offset === previous) {
      addItem(
        warnings,
        VALIDATION_CODES.DUPLICATE_TIMESTAMP,
        itemPath,
        'Timestamp duplicates the preceding timestamp.'
      );
    }

    previous = offset;
    hasPrevious = true;
  }
}

function validateNumericValues(streamType, array, path, errors) {
  for (let index = 0; index < array.length; index += 1) {
    const property = array.read(index);
    if (!property || property.value === null) continue;
    const itemPath = appendJsonPointer(path, index);
    const value = property.value;

    if (!isFiniteNumber(value)) {
      addItem(
        errors,
        VALIDATION_CODES.NUMBER_INVALID,
        itemPath,
        'Expected a finite number or null.'
      );
      continue;
    }
    if (streamType === 'heartRate' && (value <= 0 || value > 300)) {
      addItem(
        errors,
        VALIDATION_CODES.RANGE_INVALID,
        itemPath,
        'Expected null or a heart rate greater than 0 and at most 300 bpm.'
      );
    } else if (
      NON_NEGATIVE_STREAM_TYPES.has(streamType) &&
      value < 0
    ) {
      addItem(
        errors,
        VALIDATION_CODES.RANGE_INVALID,
        itemPath,
        'Expected a non-negative number or null.'
      );
    }
  }
}

function validateMovingValues(array, path, errors) {
  for (let index = 0; index < array.length; index += 1) {
    const property = array.read(index);
    if (
      !property ||
      property.value === null ||
      typeof property.value === 'boolean'
    ) {
      continue;
    }
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      appendJsonPointer(path, index),
      'Expected a boolean or null.'
    );
  }
}

function validatePositionValues(array, path, errors) {
  for (let index = 0; index < array.length; index += 1) {
    const property = array.read(index);
    if (!property || property.value === null) continue;
    const itemPath = appendJsonPointer(path, index);
    const tuple = inspectArray(property.value);
    if (!tuple || tuple.length !== 2) {
      addItem(
        errors,
        VALIDATION_CODES.TYPE_INVALID,
        itemPath,
        'Expected a WGS84 latitude-longitude pair or null.'
      );
      continue;
    }

    const latitude = tuple.read(0);
    const longitude = tuple.read(1);
    if (!latitude || !isFiniteNumber(latitude.value)) {
      addItem(
        errors,
        VALIDATION_CODES.NUMBER_INVALID,
        appendJsonPointer(itemPath, 0),
        'Expected a finite latitude.'
      );
    } else if (latitude.value < -90 || latitude.value > 90) {
      addItem(
        errors,
        VALIDATION_CODES.RANGE_INVALID,
        appendJsonPointer(itemPath, 0),
        'Expected latitude from -90 to 90.'
      );
    }

    if (!longitude || !isFiniteNumber(longitude.value)) {
      addItem(
        errors,
        VALIDATION_CODES.NUMBER_INVALID,
        appendJsonPointer(itemPath, 1),
        'Expected a finite longitude.'
      );
    } else if (longitude.value < -180 || longitude.value > 180) {
      addItem(
        errors,
        VALIDATION_CODES.RANGE_INVALID,
        appendJsonPointer(itemPath, 1),
        'Expected longitude from -180 to 180.'
      );
    }
  }
}

function validateSeries(series, index, errors, warnings) {
  const path = appendJsonPointer(`${STREAMS_PATH}/series`, index);
  if (!isPlainObject(series)) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      path,
      'Expected a plain StreamSeries object.'
    );
    return null;
  }

  collectMissingRequiredFields(
    series,
    REQUIRED_STREAM_SERIES_FIELDS,
    path,
    errors
  );
  collectUnknownFieldWarnings(
    series,
    STREAM_SERIES_FIELDS,
    path,
    warnings
  );

  const streamTypeProperty = readProperty(series, 'streamType');
  const unitProperty = readProperty(series, 'unit');
  validateNonEmptyString(
    streamTypeProperty,
    appendJsonPointer(path, 'streamType'),
    errors
  );
  validateNonEmptyString(
    unitProperty,
    appendJsonPointer(path, 'unit'),
    errors
  );

  const streamType =
    streamTypeProperty &&
    isNonEmptyOpaqueString(streamTypeProperty.value)
      ? streamTypeProperty.value
      : null;
  const unit =
    unitProperty && isNonEmptyOpaqueString(unitProperty.value)
      ? unitProperty.value
      : null;

  if (streamType === 'moving' && unit && unit !== 'boolean') {
    addItem(
      errors,
      VALIDATION_CODES.VALUE_INVALID,
      appendJsonPointer(path, 'unit'),
      'Moving streams must use the boolean unit.'
    );
  }
  if (streamType === 'position' && unit && unit !== 'wgs84') {
    addItem(
      errors,
      VALIDATION_CODES.VALUE_INVALID,
      appendJsonPointer(path, 'unit'),
      'Position streams must use the wgs84 unit.'
    );
  }

  const offsetsProperty = readProperty(series, 'offsetsSeconds');
  const valuesProperty = readProperty(series, 'values');
  const offsets = offsetsProperty
    ? inspectArray(offsetsProperty.value)
    : null;
  const values = valuesProperty ? inspectArray(valuesProperty.value) : null;

  if (offsetsProperty && !offsets) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      appendJsonPointer(path, 'offsetsSeconds'),
      'Expected a plain array of offsets.'
    );
  }
  if (valuesProperty && !values) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      appendJsonPointer(path, 'values'),
      'Expected a plain array of stream values.'
    );
  }
  if (!offsets || !values) return streamType;

  if (offsets.length !== values.length) {
    addItem(
      errors,
      VALIDATION_CODES.LENGTH_MISMATCH,
      appendJsonPointer(path, 'values'),
      'Offsets and values must have equal lengths.'
    );
  }
  if (offsets.length === 0 || values.length === 0) {
    addItem(
      errors,
      VALIDATION_CODES.VALUE_INVALID,
      path,
      'A present stream series must contain at least one point.'
    );
  }

  validateOffsets(
    offsets,
    appendJsonPointer(path, 'offsetsSeconds'),
    errors,
    warnings
  );
  if (streamType === 'moving') {
    validateMovingValues(
      values,
      appendJsonPointer(path, 'values'),
      errors
    );
  } else if (streamType === 'position') {
    validatePositionValues(
      values,
      appendJsonPointer(path, 'values'),
      errors
    );
  } else if (streamType) {
    validateNumericValues(
      streamType,
      values,
      appendJsonPointer(path, 'values'),
      errors
    );
  }

  const quality = readProperty(series, 'quality');
  if (
    quality &&
    quality.value !== null &&
    !isPlainObject(quality.value)
  ) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      appendJsonPointer(path, 'quality'),
      'Expected null or a plain JSON-safe object.'
    );
  }

  return streamType;
}

export function validateCanonicalStreamSet(value) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(value)) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      STREAMS_PATH,
      'Expected a plain CanonicalStreamSet object.'
    );
    return createValidationResult(errors, warnings);
  }

  collectJsonSafetyErrors(value, STREAMS_PATH, errors);
  collectMissingRequiredFields(
    value,
    REQUIRED_STREAM_SET_FIELDS,
    STREAMS_PATH,
    errors
  );
  collectUnknownFieldWarnings(
    value,
    STREAM_SET_FIELDS,
    STREAMS_PATH,
    warnings
  );

  validateId(
    readProperty(value, 'activityId'),
    `${STREAMS_PATH}/activityId`,
    errors
  );

  const seriesProperty = readProperty(value, 'series');
  if (!seriesProperty) return createValidationResult(errors, warnings);
  const seriesArray = inspectArray(seriesProperty.value);
  if (!seriesArray) {
    addItem(
      errors,
      VALIDATION_CODES.TYPE_INVALID,
      `${STREAMS_PATH}/series`,
      'Expected a plain array of stream series.'
    );
    return createValidationResult(errors, warnings);
  }

  const streamTypes = new Set();
  for (let index = 0; index < seriesArray.length; index += 1) {
    const property = seriesArray.read(index);
    if (!property) continue;
    const streamType = validateSeries(
      property.value,
      index,
      errors,
      warnings
    );
    if (!streamType) continue;
    if (streamTypes.has(streamType)) {
      addItem(
        errors,
        VALIDATION_CODES.DUPLICATE_VALUE,
        `${STREAMS_PATH}/series/${index}/streamType`,
        'Stream type must be unique within a stream set.'
      );
    } else {
      streamTypes.add(streamType);
    }
  }

  return createValidationResult(errors, warnings);
}
