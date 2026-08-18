import {
  createValidationItem,
  VALIDATION_CODES
} from './errors.js';

const UTC_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;
const NORMALIZED_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IANA_NAME_FORMAT_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9][A-Za-z0-9._+-]*)*$/;

export function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function inspectOwnProperty(value, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return { kind: 'missing' };
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return { kind: 'unsafe' };
    }
    return {
      kind: 'data',
      enumerable: descriptor.enumerable === true,
      value: descriptor.value
    };
  } catch {
    return { kind: 'unsafe' };
  }
}

export function inspectOwnEnumerableDataProperty(value, key) {
  const property = inspectOwnProperty(value, key);
  if (property.kind !== 'data' || !property.enumerable) {
    return property.kind === 'missing'
      ? property
      : { kind: 'unsafe' };
  }
  return { kind: 'value', value: property.value };
}

export function escapeJsonPointerSegment(segment) {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

export function appendJsonPointer(path, segment) {
  return `${path}/${escapeJsonPointerSegment(segment)}`;
}

export function isNonEmptyOpaqueString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isNonNegativeFiniteNumber(value) {
  return isFiniteNumber(value) && value >= 0;
}

export function isIntegerInRange(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function isStrictBoolean(value) {
  return typeof value === 'boolean';
}

export function isNormalizedSlug(value) {
  return typeof value === 'string' && NORMALIZED_SLUG_PATTERN.test(value);
}

export function isIanaNameFormat(value) {
  return typeof value === 'string' && IANA_NAME_FORMAT_PATTERN.test(value);
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

export function isStrictUtcInstant(value) {
  if (typeof value !== 'string') return false;

  const match = UTC_INSTANT_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;

  return true;
}

export function collectMissingRequiredFields(
  value,
  requiredFields,
  basePath,
  errors
) {
  for (const field of requiredFields) {
    if (inspectOwnEnumerableDataProperty(value, field).kind !== 'missing') {
      continue;
    }
    errors.push(
      createValidationItem(
        VALIDATION_CODES.REQUIRED_FIELD_MISSING,
        appendJsonPointer(basePath, field),
        'Expected a required field.'
      )
    );
  }
}

export function collectUnknownFieldWarnings(
  value,
  allowedFields,
  basePath,
  warnings
) {
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return;
  }

  for (const field of keys) {
    if (typeof field !== 'string') continue;
    if (inspectOwnEnumerableDataProperty(value, field).kind !== 'value') {
      continue;
    }
    if (allowedFields.has(field)) continue;
    warnings.push(
      createValidationItem(
        VALIDATION_CODES.UNKNOWN_FIELD,
        appendJsonPointer(basePath, field),
        'Field is not recognized by this schema version.'
      )
    );
  }
}

function addJsonUnsafeError(errors, path) {
  errors.push(
    createValidationItem(
      VALIDATION_CODES.JSON_UNSAFE,
      path,
      'Expected JSON-safe plain data.'
    )
  );
}

function collectArraySafetyErrors(value, path, errors, ancestors) {
  if (ancestors.has(value)) {
    addJsonUnsafeError(errors, path);
    return;
  }

  ancestors.add(value);

  const lengthProperty = inspectOwnProperty(value, 'length');
  if (
    lengthProperty.kind !== 'data' ||
    !Number.isSafeInteger(lengthProperty.value) ||
    lengthProperty.value < 0
  ) {
    addJsonUnsafeError(errors, path);
    ancestors.delete(value);
    return;
  }

  for (let index = 0; index < lengthProperty.value; index += 1) {
    const itemPath = appendJsonPointer(path, index);
    const property = inspectOwnEnumerableDataProperty(value, String(index));
    if (property.kind !== 'value') {
      addJsonUnsafeError(errors, itemPath);
      continue;
    }

    collectJsonSafetyErrors(property.value, itemPath, errors, ancestors);
  }

  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    addJsonUnsafeError(errors, path);
    ancestors.delete(value);
    return;
  }

  for (const key of keys) {
    if (key === 'length') continue;
    if (
      typeof key === 'string' &&
      /^(0|[1-9]\d*)$/.test(key) &&
      Number(key) < lengthProperty.value
    ) {
      continue;
    }
    addJsonUnsafeError(
      errors,
      typeof key === 'string' ? appendJsonPointer(path, key) : path
    );
  }

  ancestors.delete(value);
}

function collectObjectSafetyErrors(value, path, errors, ancestors) {
  if (ancestors.has(value)) {
    addJsonUnsafeError(errors, path);
    return;
  }

  ancestors.add(value);

  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    addJsonUnsafeError(errors, path);
    ancestors.delete(value);
    return;
  }

  for (const key of keys) {
    if (typeof key !== 'string') {
      addJsonUnsafeError(errors, path);
      continue;
    }

    const childPath = appendJsonPointer(path, key);
    const property = inspectOwnEnumerableDataProperty(value, key);
    if (property.kind !== 'value') {
      addJsonUnsafeError(errors, childPath);
      continue;
    }

    collectJsonSafetyErrors(property.value, childPath, errors, ancestors);
  }

  ancestors.delete(value);
}

export function collectJsonSafetyErrors(
  value,
  path,
  errors,
  ancestors = new WeakSet()
) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) addJsonUnsafeError(errors, path);
    return;
  }

  let isArray;
  try {
    isArray = Array.isArray(value);
  } catch {
    addJsonUnsafeError(errors, path);
    return;
  }

  if (isArray) {
    collectArraySafetyErrors(value, path, errors, ancestors);
    return;
  }

  if (isPlainObject(value)) {
    collectObjectSafetyErrors(value, path, errors, ancestors);
    return;
  }

  addJsonUnsafeError(errors, path);
}
