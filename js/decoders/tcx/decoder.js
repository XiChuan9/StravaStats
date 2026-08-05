import { validateImportedActivityBundle } from '../../data/contracts/index.js';
import {
    IMPORT_ERROR_CODE,
    ImportError,
    importError
} from '../../import/errors.js';
import { deepFreeze, ownDataValues } from '../../import/safe-data.js';

export const TCX_MEDIA_TYPE = 'application/vnd.garmin.tcx+xml';

export const TCX_LIMITS = deepFreeze({
    maxXmlBytes: 16_777_216,
    maxDepth: 32,
    maxElements: 500_000,
    maxAttributesPerElement: 32,
    maxAttributes: 500_000,
    maxTextNodeBytes: 262_144,
    maxAttributeValueBytes: 4_096,
    maxQNameBytes: 128,
    maxChildrenPerElement: 200_000,
    maxActivities: 1,
    maxLaps: 10_000,
    maxTracks: 20_000,
    maxTrackpointRows: 200_000,
    maxExtensionElements: 400_000,
    maxExtensionChildren: 32
});

const INPUT_FIELDS = Object.freeze(['mediaType', 'content']);
const TCX_NS = 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2';
const ACTIVITY_EXT_NS = 'http://www.garmin.com/xmlschemas/ActivityExtension/v2';
const TRACKPOINT_EXT_NS = 'http://www.garmin.com/xmlschemas/TrackPointExtension/v1';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const XINCLUDE_NS = 'http://www.w3.org/2001/XInclude';
const NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const INTEGER = /^(?:0|[1-9]\d*)$/;
const DECIMAL = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
const XML_SPACE_ONLY = /^[\u0009\u000a\u000d\u0020]*$/;

const WARNING_DEFINITIONS = deepFreeze({
    TCX_IMPORT_TIME_FALLBACK: {
        path: '/sources/0/importedAt',
        message: 'The TCX activity start time is used as the deterministic import time.'
    },
    TCX_DEVICE_METADATA_IGNORED: {
        path: '/tcx/deviceMetadata',
        message: 'TCX device and application metadata was ignored.'
    },
    TCX_LAP_EXTENSION_IGNORED: {
        path: '/tcx/laps/extensions',
        message: 'TCX lap extension metadata was ignored.'
    },
    TCX_UNKNOWN_EXTENSION_IGNORED: {
        path: '/tcx/extensions',
        message: 'An unsupported TCX extension was ignored.'
    }
});

function fail(code = IMPORT_ERROR_CODE.FILE_CORRUPTED) {
    throw importError(code, false, 'decode');
}

function utf8Length(value) {
    return new TextEncoder().encode(value).length;
}

function isXmlCharacter(codePoint) {
    return codePoint === 0x09
        || codePoint === 0x0a
        || codePoint === 0x0d
        || (codePoint >= 0x20 && codePoint <= 0xd7ff)
        || (codePoint >= 0xe000 && codePoint <= 0xfffd
            && !(codePoint >= 0xfdd0 && codePoint <= 0xfdef)
            && (codePoint & 0xffff) !== 0xfffe
            && (codePoint & 0xffff) !== 0xffff)
        || (codePoint >= 0x10000 && codePoint <= 0x10ffff
            && (codePoint & 0xffff) !== 0xfffe
            && (codePoint & 0xffff) !== 0xffff);
}

function validateCharacters(value) {
    for (let index = 0; index < value.length; index += 1) {
        const first = value.charCodeAt(index);
        if (first >= 0xd800 && first <= 0xdbff) {
            const second = value.charCodeAt(index + 1);
            if (!(second >= 0xdc00 && second <= 0xdfff)) fail();
            const codePoint = 0x10000 + (first - 0xd800) * 0x400 + second - 0xdc00;
            if (!isXmlCharacter(codePoint)) fail();
            index += 1;
        } else if (first >= 0xdc00 && first <= 0xdfff) fail();
        else if (!isXmlCharacter(first)) fail();
    }
}

function splitQName(qname) {
    if (typeof qname !== 'string' || utf8Length(qname) > TCX_LIMITS.maxQNameBytes) fail();
    const parts = qname.split(':');
    if (parts.length > 2 || parts.some(part => !NAME.test(part))) fail();
    return parts.length === 1
        ? { prefix: '', local: parts[0] }
        : { prefix: parts[0], local: parts[1] };
}

function decodeEntities(value) {
    let output = '';
    let cursor = 0;
    while (cursor < value.length) {
        const ampersand = value.indexOf('&', cursor);
        if (ampersand < 0) {
            output += value.slice(cursor);
            break;
        }
        output += value.slice(cursor, ampersand);
        const semicolon = value.indexOf(';', ampersand + 1);
        if (semicolon < 0) fail();
        const reference = value.slice(ampersand + 1, semicolon);
        const predefined = {
            amp: '&', lt: '<', gt: '>', apos: "'", quot: '"'
        }[reference];
        if (predefined !== undefined) output += predefined;
        else {
            const match = /^#(?:x([0-9A-Fa-f]+)|(\d+))$/.exec(reference);
            if (!match) fail();
            const codePoint = Number.parseInt(match[1] ?? match[2], match[1] ? 16 : 10);
            if (!Number.isSafeInteger(codePoint) || !isXmlCharacter(codePoint)) fail();
            output += String.fromCodePoint(codePoint);
        }
        cursor = semicolon + 1;
    }
    validateCharacters(output);
    return output;
}

function trimXmlSpace(value) {
    return value.replace(/^[\u0009\u000a\u000d\u0020]+|[\u0009\u000a\u000d\u0020]+$/g, '');
}

function parseXml(content) {
    if (content.length === 0 || content === '\ufeff') fail(IMPORT_ERROR_CODE.FILE_EMPTY);
    validateCharacters(content);
    if (utf8Length(content) > TCX_LIMITS.maxXmlBytes) fail();

    let source = content.startsWith('\ufeff') ? content.slice(1) : content;
    let cursor = 0;
    if (source.startsWith('<?xml')) {
        const end = source.indexOf('?>');
        if (end < 0) fail();
        const declaration = source.slice(0, end + 2);
        if (!/^<\?xml[\u0009\u000a\u000d\u0020]+version=(?:"1\.0"|'1\.0')(?:[\u0009\u000a\u000d\u0020]+encoding=(?:"UTF-8"|'UTF-8'|"utf-8"|'utf-8'))?(?:[\u0009\u000a\u000d\u0020]+standalone=(?:"(?:yes|no)"|'(?:yes|no)'))?[\u0009\u000a\u000d\u0020]*\?>$/.test(declaration)) fail();
        cursor = end + 2;
    }

    const rootNamespace = Object.freeze({ xml: XML_NS });
    const stack = [];
    let root = null;
    let elements = 0;
    let attributes = 0;

    function appendText(raw) {
        if (raw.length === 0) return;
        if (raw.includes(']]>')) fail();
        if (utf8Length(raw) > TCX_LIMITS.maxTextNodeBytes) fail();
        const decoded = decodeEntities(raw);
        if (stack.length === 0) {
            if (!XML_SPACE_ONLY.test(decoded)) fail();
            return;
        }
        stack[stack.length - 1].text += decoded;
    }

    while (cursor < source.length) {
        const open = source.indexOf('<', cursor);
        if (open < 0) {
            appendText(source.slice(cursor));
            cursor = source.length;
            break;
        }
        appendText(source.slice(cursor, open));
        if (source.startsWith('<!--', open)) {
            const end = source.indexOf('-->', open + 4);
            const comment = end < 0 ? '' : source.slice(open + 4, end);
            if (end < 0 || comment.includes('--') || comment.endsWith('-')) fail();
            cursor = end + 3;
            continue;
        }
        if (source.startsWith('<?', open) || source.startsWith('<!', open)) fail();
        if (source.startsWith('</', open)) {
            const end = source.indexOf('>', open + 2);
            if (end < 0) fail();
            const rawName = source.slice(open + 2, end);
            if (rawName !== rawName.trim() || rawName.length === 0) fail();
            splitQName(rawName);
            const element = stack.pop();
            if (!element || element.qname !== rawName) fail();
            cursor = end + 1;
            continue;
        }

        let end = open + 1;
        let quote = null;
        for (; end < source.length; end += 1) {
            const character = source[end];
            if (quote !== null) {
                if (character === '<') fail();
                if (character === quote) quote = null;
            } else if (character === '"' || character === "'") quote = character;
            else if (character === '>') break;
            else if (character === '<') fail();
        }
        if (end >= source.length || quote !== null) fail();
        let inside = source.slice(open + 1, end);
        const empty = inside.endsWith('/');
        if (empty) inside = inside.slice(0, -1);
        const nameMatch = /^([^\u0009\u000a\u000d\u0020]+)([\s\S]*)$/.exec(inside);
        if (!nameMatch) fail();
        const qname = nameMatch[1];
        const name = splitQName(qname);
        let rest = nameMatch[2];
        const rawAttributes = [];
        const rawNames = new Set();
        while (rest.length > 0) {
            const whitespace = /^[\u0009\u000a\u000d\u0020]+/.exec(rest);
            if (!whitespace) fail();
            rest = rest.slice(whitespace[0].length);
            if (rest.length === 0) break;
            const match = /^([^\u0009\u000a\u000d\u0020=]+)[\u0009\u000a\u000d\u0020]*=[\u0009\u000a\u000d\u0020]*("[^"]*"|'[^']*')/.exec(rest);
            if (!match) fail();
            const attributeQName = match[1];
            splitQName(attributeQName);
            if (rawNames.has(attributeQName)) fail();
            rawNames.add(attributeQName);
            const value = decodeEntities(match[2].slice(1, -1));
            if (utf8Length(value) > TCX_LIMITS.maxAttributeValueBytes) fail();
            rawAttributes.push({ qname: attributeQName, value });
            if (rawAttributes.length > TCX_LIMITS.maxAttributesPerElement) fail();
            rest = rest.slice(match[0].length);
        }

        elements += 1;
        attributes += rawAttributes.length;
        if (elements > TCX_LIMITS.maxElements || attributes > TCX_LIMITS.maxAttributes) fail();
        if (stack.length + 1 > TCX_LIMITS.maxDepth) fail();

        const parentNamespaces = stack.length > 0
            ? stack[stack.length - 1].namespaces
            : rootNamespace;
        const namespaces = Object.create(parentNamespaces);
        const declared = new Set();
        for (const attribute of rawAttributes) {
            const attributeName = splitQName(attribute.qname);
            const isDefault = attribute.qname === 'xmlns';
            const isPrefixed = attributeName.prefix === 'xmlns';
            if (!isDefault && !isPrefixed) continue;
            const prefix = isDefault ? '' : attributeName.local;
            if (declared.has(prefix) || attribute.value.length === 0) fail();
            if (
                prefix === 'xmlns'
                || (/^xml/i.test(prefix) && prefix !== 'xml')
                || attribute.value === XMLNS_NS
                || attribute.value === XINCLUDE_NS
                || (prefix === 'xml' && attribute.value !== XML_NS)
                || (prefix !== 'xml' && attribute.value === XML_NS)
            ) fail();
            declared.add(prefix);
            namespaces[prefix] = attribute.value;
        }
        const uri = name.prefix === '' ? namespaces[''] : namespaces[name.prefix];
        if (
            typeof uri !== 'string'
            || uri.length === 0
            || uri === XINCLUDE_NS
            || uri === XSI_NS
            || uri === XML_NS
        ) fail();
        const resolvedAttributes = [];
        const resolvedNames = new Set();
        for (const attribute of rawAttributes) {
            const attributeName = splitQName(attribute.qname);
            if (attribute.qname === 'xmlns' || attributeName.prefix === 'xmlns') continue;
            const attributeUri = attributeName.prefix === ''
                ? ''
                : namespaces[attributeName.prefix];
            if (typeof attributeUri !== 'string' || attributeUri === XMLNS_NS) fail();
            const key = `${attributeUri}\u0000${attributeName.local}`;
            if (resolvedNames.has(key)) fail();
            resolvedNames.add(key);
            resolvedAttributes.push({
                uri: attributeUri,
                local: attributeName.local,
                value: attribute.value
            });
        }
        const element = {
            qname,
            uri,
            local: name.local,
            attributes: resolvedAttributes,
            children: [],
            text: '',
            namespaces
        };
        if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            if (parent.children.length >= TCX_LIMITS.maxChildrenPerElement) fail();
            parent.children.push(element);
        } else {
            if (root !== null) fail();
            root = element;
        }
        if (!empty) stack.push(element);
        cursor = end + 1;
    }
    if (stack.length !== 0 || root === null) fail();
    return root;
}

function core(element, local) {
    return element.uri === TCX_NS && element.local === local;
}

function requireWhitespace(element) {
    if (!XML_SPACE_ONLY.test(element.text)) fail();
}

function textValue(element) {
    if (element.children.length > 0) fail();
    const value = trimXmlSpace(element.text);
    if (value.length === 0) fail();
    return value;
}

function exactTextValue(element) {
    if (
        element.children.length > 0
        || element.text.length === 0
        || element.text !== trimXmlSpace(element.text)
    ) {
        fail();
    }
    return element.text;
}

function assertAttributes(element, allowed = []) {
    for (const attribute of element.attributes) {
        const key = `${attribute.uri}\u0000${attribute.local}`;
        if (
            allowed.includes(key)
            || (attribute.uri === XSI_NS
                && (attribute.local === 'type' || attribute.local === 'schemaLocation'))
        ) continue;
        fail();
    }
}

function attribute(element, uri, local, required = false) {
    const values = element.attributes.filter(item => item.uri === uri && item.local === local);
    if (values.length > 1 || (required && values.length !== 1)) fail();
    return values.length === 1 ? values[0].value : null;
}

function children(element, local) {
    return element.children.filter(child => core(child, local));
}

function oneChild(element, local, required = true) {
    const values = children(element, local);
    if (values.length > 1 || (required && values.length !== 1)) fail();
    return values[0] ?? null;
}

function assertCoreChildren(element, allowed) {
    requireWhitespace(element);
    let previous = -1;
    for (const child of element.children) {
        if (child.uri !== TCX_NS || !allowed.includes(child.local)) fail();
        const current = allowed.indexOf(child.local);
        if (current < previous) fail();
        previous = current;
    }
}

function parseNumber(element, { integer = false, min = null, max = null } = {}) {
    assertAttributes(element);
    const value = textValue(element);
    if (!(integer ? INTEGER : DECIMAL).test(value)) fail();
    const number = Number(value);
    if (!Number.isFinite(number) || (integer && !Number.isSafeInteger(number))) fail();
    if ((min !== null && number < min) || (max !== null && number > max)) fail();
    return number;
}

function parseDateTime(element) {
    assertAttributes(element);
    return parseDateTimeValue(exactTextValue(element));
}

function parseDateTimeValue(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
    if (!match) fail();
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    const fraction = match[7] ?? '';
    if (year === 0 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) fail();
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > days[month - 1]) fail();
    if (fraction.length > 3 && /[1-9]/.test(fraction.slice(3))) fail();
    const millisecond = Number((fraction.slice(0, 3) + '000').slice(0, 3));
    let offsetMinutes = 0;
    if (match[8] !== 'Z') {
        const offsetHour = Number(match[10]);
        const offsetMinute = Number(match[11]);
        if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) fail();
        offsetMinutes = (offsetHour * 60 + offsetMinute) * (match[9] === '-' ? -1 : 1);
    }
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, millisecond);
    const localEpoch = date.getTime();
    if (!Number.isFinite(localEpoch)) fail();
    const epochMs = localEpoch - offsetMinutes * 60_000;
    const iso = new Date(epochMs).toISOString();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(iso)) fail();
    return { epochMs, iso, offsetMinutes };
}

function addWarning(warnings, code) {
    const definition = WARNING_DEFINITIONS[code];
    if (!definition) fail();
    warnings.set(code, { code, ...definition });
}

function sortedWarnings(warnings) {
    return [...warnings.values()].sort((left, right) => left.code < right.code ? -1 : 1);
}

function extensionSize(element, state) {
    state.extensionElements += 1;
    if (state.extensionElements > TCX_LIMITS.maxExtensionElements) fail();
    for (const child of element.children) extensionSize(child, state);
}

function controlledNamespace(uri) {
    return uri === ''
        || uri === TCX_NS
        || uri === ACTIVITY_EXT_NS
        || uri === TRACKPOINT_EXT_NS
        || uri === XINCLUDE_NS
        || uri === XSI_NS
        || uri === XML_NS;
}

function validateUnknownExtensionTree(element, state, count) {
    if (controlledNamespace(element.uri)) fail();
    if (count) {
        state.extensionElements += 1;
        if (state.extensionElements > TCX_LIMITS.maxExtensionElements) fail();
    }
    for (const child of element.children) {
        validateUnknownExtensionTree(child, state, count);
    }
}

function ignoreExtensions(
    element,
    state,
    warning,
    {
        allowedKnown = [],
        countChildren = true,
        knownWarning = null,
        ownerNamespace = element.uri
    } = {}
) {
    assertAttributes(element);
    requireWhitespace(element);
    if (element.children.length > TCX_LIMITS.maxExtensionChildren) fail();
    let sawKnown = false;
    let sawUnknown = false;
    for (const child of element.children) {
        if (
            child.uri === ''
            || child.uri === ownerNamespace
            || child.uri === TCX_NS
            || child.uri === XINCLUDE_NS
        ) fail();
        const key = `${child.uri}\u0000${child.local}`;
        if (
            (child.uri === ACTIVITY_EXT_NS || child.uri === TRACKPOINT_EXT_NS)
            && !allowedKnown.includes(key)
        ) fail();
        if (allowedKnown.includes(key)) {
            sawKnown = true;
            if (countChildren) extensionSize(child, state);
        } else {
            sawUnknown = true;
            validateUnknownExtensionTree(child, state, countChildren);
        }
    }
    if (sawUnknown) addWarning(state.warnings, warning);
    if (sawKnown && knownWarning !== null) addWarning(state.warnings, knownWarning);
}

function parsePointExtensions(element, state) {
    assertAttributes(element);
    requireWhitespace(element);
    if (element.children.length > TCX_LIMITS.maxExtensionChildren) fail();
    const result = {
        speed: null,
        runCadence: null,
        power: null,
        temperature: null,
        waterTemperature: null
    };
    let sawTpx = false;
    let sawTemperature = false;
    for (const child of element.children) {
        extensionSize(child, state);
        if (child.uri === ACTIVITY_EXT_NS && child.local === 'TPX') {
            if (sawTpx) fail();
            sawTpx = true;
            assertAttributes(child);
            requireWhitespace(child);
            let previous = -1;
            let sawExtensions = false;
            const order = ['Speed', 'RunCadence', 'Watts', 'Extensions'];
            for (const field of child.children) {
                if (field.uri !== ACTIVITY_EXT_NS) fail();
                const current = order.indexOf(field.local);
                if (current < 0 || current < previous) fail();
                previous = current;
                if (field.local === 'Speed') {
                    if (result.speed !== null) fail();
                    result.speed = parseNumber(field, { min: 0 });
                } else if (field.local === 'RunCadence') {
                    if (result.runCadence !== null) fail();
                    result.runCadence = parseNumber(field, { integer: true, min: 0, max: 254 });
                } else if (field.local === 'Watts') {
                    if (result.power !== null) fail();
                    result.power = parseNumber(field, { integer: true, min: 0, max: 65_535 });
                } else if (field.local === 'Extensions') {
                    if (sawExtensions) fail();
                    sawExtensions = true;
                    ignoreExtensions(
                        field,
                        state,
                        'TCX_UNKNOWN_EXTENSION_IGNORED',
                        { countChildren: false, ownerNamespace: ACTIVITY_EXT_NS }
                    );
                } else fail();
            }
        } else if (child.uri === TRACKPOINT_EXT_NS && child.local === 'TrackPointExtension') {
            if (sawTemperature) fail();
            sawTemperature = true;
            assertAttributes(child);
            requireWhitespace(child);
            let previous = -1;
            let sawExtensions = false;
            const order = ['atemp', 'wtemp', 'Extensions'];
            for (const field of child.children) {
                if (field.uri !== TRACKPOINT_EXT_NS) fail();
                const current = order.indexOf(field.local);
                if (current < 0 || current < previous) fail();
                previous = current;
                if (field.local === 'atemp') {
                    if (result.temperature !== null) fail();
                    result.temperature = parseNumber(field);
                } else if (field.local === 'wtemp') {
                    if (result.waterTemperature !== null) fail();
                    result.waterTemperature = parseNumber(field);
                } else if (field.local === 'Extensions') {
                    if (sawExtensions) fail();
                    sawExtensions = true;
                    ignoreExtensions(
                        field,
                        state,
                        'TCX_UNKNOWN_EXTENSION_IGNORED',
                        { countChildren: false, ownerNamespace: TRACKPOINT_EXT_NS }
                    );
                } else fail();
            }
        } else if (child.uri === ACTIVITY_EXT_NS || child.uri === TRACKPOINT_EXT_NS) fail();
        else if (child.uri !== '' && child.uri !== TCX_NS && child.uri !== XINCLUDE_NS) {
            validateUnknownExtensionTree(child, state, false);
            addWarning(state.warnings, 'TCX_UNKNOWN_EXTENSION_IGNORED');
        } else fail();
    }
    return result;
}

function parseHeartRate(element) {
    assertAttributes(element);
    assertCoreChildren(element, ['Value']);
    return parseNumber(oneChild(element, 'Value'), { integer: true, min: 1, max: 255 });
}

function parsePosition(element) {
    assertAttributes(element);
    assertCoreChildren(element, ['LatitudeDegrees', 'LongitudeDegrees']);
    const latitude = parseNumber(oneChild(element, 'LatitudeDegrees'), { min: -90, max: 90 });
    const longitude = parseNumber(oneChild(element, 'LongitudeDegrees'), { min: -180 });
    if (longitude >= 180) fail();
    return [latitude, longitude];
}

function parseTrackpoint(element, state) {
    assertAttributes(element);
    assertCoreChildren(element, [
        'Time', 'Position', 'AltitudeMeters', 'DistanceMeters',
        'HeartRateBpm', 'Cadence', 'SensorState', 'Extensions'
    ]);
    const time = parseDateTime(oneChild(element, 'Time'));
    const positionElement = oneChild(element, 'Position', false);
    const altitudeElement = oneChild(element, 'AltitudeMeters', false);
    const distanceElement = oneChild(element, 'DistanceMeters', false);
    const heartRateElement = oneChild(element, 'HeartRateBpm', false);
    const cadenceElement = oneChild(element, 'Cadence', false);
    const sensorState = oneChild(element, 'SensorState', false);
    const extensionsElement = oneChild(element, 'Extensions', false);
    if (sensorState) {
        assertAttributes(sensorState);
        const value = textValue(sensorState);
        if (value !== 'Present' && value !== 'Absent') fail();
    }
    const extensions = extensionsElement
        ? parsePointExtensions(extensionsElement, state)
        : { speed: null, runCadence: null, power: null, temperature: null, waterTemperature: null };
    const cadence = cadenceElement
        ? parseNumber(cadenceElement, { integer: true, min: 0, max: 254 })
        : null;
    if (cadence !== null && extensions.runCadence !== null && cadence !== extensions.runCadence) fail();
    return {
        epochMs: time.epochMs,
        position: positionElement ? parsePosition(positionElement) : null,
        altitude: altitudeElement ? parseNumber(altitudeElement) : null,
        distance: distanceElement ? parseNumber(distanceElement, { min: 0 }) : null,
        heartRate: heartRateElement ? parseHeartRate(heartRateElement) : null,
        cadence: cadence ?? extensions.runCadence,
        speed: extensions.speed,
        power: extensions.power,
        temperature: extensions.temperature,
        waterTemperature: extensions.waterTemperature
    };
}

function sameValue(left, right) {
    if (Array.isArray(left) && Array.isArray(right)) {
        return left.length === right.length && left.every((value, index) => value === right[index]);
    }
    return left === right;
}

function appendPoint(rows, point) {
    const previous = rows[rows.length - 1];
    if (previous && point.epochMs < previous.epochMs) fail();
    if (previous && point.epochMs === previous.epochMs) {
        for (const field of Object.keys(point)) {
            if (field === 'epochMs' || point[field] === null) continue;
            if (previous[field] !== null && !sameValue(previous[field], point[field])) fail();
            if (previous[field] === null) previous[field] = point[field];
        }
        return;
    }
    if (rows.length >= TCX_LIMITS.maxTrackpointRows) fail();
    rows.push(point);
}

function parseTrack(element, state) {
    assertAttributes(element);
    assertCoreChildren(element, ['Trackpoint']);
    const points = children(element, 'Trackpoint');
    if (points.length === 0) fail();
    for (const point of points) appendPoint(state.rows, parseTrackpoint(point, state));
}

function validateIgnoredSummary(element, local, options = {}) {
    const child = oneChild(element, local, false);
    if (!child) return;
    if (options.heartRate) parseHeartRate(child);
    else if (options.enum) {
        assertAttributes(child);
        if (!options.enum.includes(textValue(child))) fail();
    } else parseNumber(child, options);
}

function parseLap(element, index, activityStart, state, previousEnd) {
    assertAttributes(element, ['\u0000StartTime']);
    const startText = attribute(element, '', 'StartTime', true);
    const start = parseDateTimeValue(startText);
    assertCoreChildren(element, [
        'TotalTimeSeconds', 'DistanceMeters', 'MaximumSpeed', 'Calories',
        'AverageHeartRateBpm', 'MaximumHeartRateBpm', 'Intensity', 'Cadence',
        'TriggerMethod', 'Track', 'Notes', 'Extensions'
    ]);
    const elapsed = parseNumber(oneChild(element, 'TotalTimeSeconds'), { min: 0 });
    const distance = parseNumber(oneChild(element, 'DistanceMeters'), { min: 0 });
    parseNumber(oneChild(element, 'Calories'), { integer: true, min: 0, max: 65_535 });
    validateIgnoredSummary(element, 'MaximumSpeed', { min: 0 });
    validateIgnoredSummary(element, 'AverageHeartRateBpm', { heartRate: true });
    validateIgnoredSummary(element, 'MaximumHeartRateBpm', { heartRate: true });
    validateIgnoredSummary(element, 'Cadence', { integer: true, min: 0, max: 254 });
    validateIgnoredSummary(element, 'Intensity', { enum: ['Active', 'Resting'] });
    validateIgnoredSummary(element, 'TriggerMethod', {
        enum: ['Manual', 'Distance', 'Location', 'Time', 'HeartRate']
    });
    const notes = oneChild(element, 'Notes', false);
    if (notes) {
        assertAttributes(notes);
        textValue(notes);
    }
    const offset = (start.epochMs - activityStart.epochMs) / 1000;
    if (!Number.isFinite(offset) || offset < 0 || (previousEnd !== null && offset < previousEnd)) fail();
    const tracks = children(element, 'Track');
    state.tracks += tracks.length;
    if (state.tracks > TCX_LIMITS.maxTracks) fail();
    for (const track of tracks) parseTrack(track, state);
    const extensions = oneChild(element, 'Extensions', false);
    if (extensions) {
        ignoreExtensions(extensions, state, 'TCX_UNKNOWN_EXTENSION_IGNORED', {
            allowedKnown: [`${ACTIVITY_EXT_NS}\u0000LX`],
            knownWarning: 'TCX_LAP_EXTENSION_IGNORED'
        });
    }
    return {
        lap: {
            id: `${state.activityId}:lap:${index}`,
            activityId: state.activityId,
            index,
            startOffsetSeconds: offset,
            elapsedTimeSeconds: elapsed,
            distanceMeters: distance
        },
        end: offset + elapsed,
        distance
    };
}

function mapSport(value) {
    if (value === 'Running') return 'run';
    if (value === 'Biking') return 'ride';
    if (value === 'Other') return 'other';
    fail();
}

function buildStreams(activityId, rows, startEpochMs) {
    const definitions = [
        ['position', 'wgs84', 'position'],
        ['altitude', 'm', 'altitude'],
        ['distance', 'm', 'distance'],
        ['heartRate', 'bpm', 'heartRate'],
        ['cadence', 'rpm', 'cadence'],
        ['speed', 'm/s', 'speed'],
        ['power', 'W', 'power'],
        ['temperature', 'C', 'temperature'],
        ['waterTemperature', 'C', 'waterTemperature']
    ];
    const offsetsSeconds = rows.map(row => (row.epochMs - startEpochMs) / 1000);
    if (offsetsSeconds.some(offset => !Number.isFinite(offset) || offset < 0)) fail();
    const series = [];
    for (const [streamType, unit, field] of definitions) {
        const values = rows.map(row => row[field]);
        if (values.some(value => value !== null)) {
            series.push({ streamType, unit, offsetsSeconds: [...offsetsSeconds], values });
        }
    }
    return { activityId, series };
}

function validateIgnoredCoreTree(element) {
    if (element.uri !== TCX_NS) fail();
    for (const attribute of element.attributes) {
        if (
            attribute.uri === ''
            || (attribute.uri === XSI_NS
                && (attribute.local === 'type' || attribute.local === 'schemaLocation'))
        ) continue;
        fail();
    }
    for (const child of element.children) validateIgnoredCoreTree(child);
}

function parseCreatorOrAuthor(element, state) {
    validateIgnoredCoreTree(element);
    addWarning(state.warnings, 'TCX_DEVICE_METADATA_IGNORED');
}

function buildBundle(root) {
    if (!core(root, 'TrainingCenterDatabase')) fail();
    assertAttributes(root);
    assertCoreChildren(root, ['Activities', 'Author', 'Extensions']);
    const activitiesElement = oneChild(root, 'Activities');
    const authors = children(root, 'Author');
    if (authors.length > 1) fail();
    assertAttributes(activitiesElement);
    assertCoreChildren(activitiesElement, ['Activity']);
    const activityElements = children(activitiesElement, 'Activity');
    if (activityElements.length !== 1 || activityElements.length > TCX_LIMITS.maxActivities) fail();
    const activityElement = activityElements[0];
    assertAttributes(activityElement, ['\u0000Sport']);
    const sport = mapSport(attribute(activityElement, '', 'Sport', true));
    assertCoreChildren(activityElement, ['Id', 'Lap', 'Notes', 'Creator', 'Extensions']);
    const idElement = oneChild(activityElement, 'Id');
    const sourceId = exactTextValue(idElement);
    assertAttributes(idElement);
    const activityStart = parseDateTimeValue(sourceId);
    const activityId = `tcx:${encodeURIComponent(sourceId)}`;
    const warnings = new Map();
    const state = { activityId, warnings, rows: [], tracks: 0, extensionElements: 0 };
    const laps = children(activityElement, 'Lap');
    if (laps.length === 0 || laps.length > TCX_LIMITS.maxLaps) fail();
    const canonicalLaps = [];
    let previousEnd = null;
    let totalDistance = 0;
    for (let index = 0; index < laps.length; index += 1) {
        const parsed = parseLap(laps[index], index, activityStart, state, previousEnd);
        canonicalLaps.push(parsed.lap);
        previousEnd = parsed.end;
        totalDistance += parsed.distance;
        if (!Number.isFinite(totalDistance)) fail();
    }
    const creators = children(activityElement, 'Creator');
    if (creators.length > 1) fail();
    for (const creator of creators) parseCreatorOrAuthor(creator, state);
    for (const author of authors) parseCreatorOrAuthor(author, state);
    const notes = oneChild(activityElement, 'Notes', false);
    if (notes) {
        assertAttributes(notes);
        textValue(notes);
    }
    const extensions = oneChild(activityElement, 'Extensions', false);
    if (extensions) ignoreExtensions(extensions, state, 'TCX_UNKNOWN_EXTENSION_IGNORED');
    const rootExtensions = oneChild(root, 'Extensions', false);
    if (rootExtensions) {
        ignoreExtensions(rootExtensions, state, 'TCX_UNKNOWN_EXTENSION_IGNORED');
    }
    const streams = buildStreams(activityId, state.rows, activityStart.epochMs);
    const streamTypes = new Set(streams.series.map(series => series.streamType));
    addWarning(warnings, 'TCX_IMPORT_TIME_FALLBACK');
    const activity = {
        schemaVersion: 1,
        id: activityId,
        sportCategory: sport,
        sportVariant: null,
        startTimeUtc: activityStart.iso,
        timeZone: { ianaName: null, utcOffsetMinutes: activityStart.offsetMinutes },
        capabilities: {
            hasGps: streamTypes.has('position'),
            hasHeartRate: streamTypes.has('heartRate'),
            hasPower: streamTypes.has('power'),
            hasCadence: streamTypes.has('cadence'),
            hasLaps: canonicalLaps.length > 0
        },
        distanceMeters: totalDistance,
        elapsedTimeSeconds: previousEnd
    };
    const source = {
        id: `${activityId}:source:0`,
        activityId,
        provider: 'tcx',
        externalId: sourceId,
        rawArtifactId: null,
        acquisitionMethod: 'local-file',
        deviceId: null,
        importedAt: activityStart.iso
    };
    const bundle = {
        schemaVersion: 1,
        activity,
        streams,
        laps: canonicalLaps,
        events: [],
        sources: [source],
        devices: [],
        warnings: sortedWarnings(warnings),
        versionMetadata: { schemaVersion: 1, parserVersion: 'tcx-1.0.0' }
    };
    const validation = validateImportedActivityBundle(bundle);
    if (!validation.ok) fail();
    return deepFreeze(bundle);
}

export const tcxDecoder = Object.freeze({
    id: 'tcx',
    mediaType: TCX_MEDIA_TYPE,
    decode(input) {
        const values = ownDataValues(input, INPUT_FIELDS);
        if (!values) fail();
        if (typeof values.mediaType !== 'string' || typeof values.content !== 'string') fail();
        try {
            structuredClone(input);
        } catch {
            fail();
        }
        if (values.mediaType !== TCX_MEDIA_TYPE) fail(IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT);
        try {
            return buildBundle(parseXml(values.content));
        } catch (error) {
            if (error instanceof ImportError) throw error;
            fail();
        }
    }
});
