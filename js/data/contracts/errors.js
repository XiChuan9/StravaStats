export const VALIDATION_CODES = Object.freeze({
  CAPABILITY_CONFLICT: 'CAPABILITY_CONFLICT',
  DUPLICATE_TIMESTAMP: 'DUPLICATE_TIMESTAMP',
  DUPLICATE_VALUE: 'DUPLICATE_VALUE',
  ID_INVALID: 'ID_INVALID',
  JSON_UNSAFE: 'JSON_UNSAFE',
  LENGTH_MISMATCH: 'LENGTH_MISMATCH',
  NUMBER_INVALID: 'NUMBER_INVALID',
  ORDER_INVALID: 'ORDER_INVALID',
  RANGE_INVALID: 'RANGE_INVALID',
  REFERENCE_INVALID: 'REFERENCE_INVALID',
  RELATION_INVALID: 'RELATION_INVALID',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  STATE_INVALID: 'STATE_INVALID',
  TIMESTAMP_INVALID: 'TIMESTAMP_INVALID',
  TYPE_INVALID: 'TYPE_INVALID',
  UNKNOWN_FIELD: 'UNKNOWN_FIELD',
  VALUE_INVALID: 'VALUE_INVALID',
  VERSION_INVALID: 'VERSION_INVALID',
  VERSION_UNSUPPORTED: 'VERSION_UNSUPPORTED'
});

export function createValidationItem(code, path, message) {
  return { code, path, message };
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function compareValidationItems(left, right) {
  return (
    compareStrings(left.path, right.path) ||
    compareStrings(left.code, right.code) ||
    compareStrings(left.message, right.message)
  );
}

export function createValidationResult(errors, warnings) {
  const sortedErrors = [...errors].sort(compareValidationItems);
  const sortedWarnings = [...warnings].sort(compareValidationItems);

  return {
    ok: sortedErrors.length === 0,
    errors: sortedErrors,
    warnings: sortedWarnings
  };
}
