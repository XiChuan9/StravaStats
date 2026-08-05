import { validateImportedActivityBundle } from '../../data/contracts/index.js';
import {
    IMPORT_ERROR_CODE,
    ImportError,
    importError
} from '../../import/errors.js';
import { deepFreeze, ownDataValues } from '../../import/safe-data.js';

export const GPX_MEDIA_TYPE = 'application/gpx+xml';

export const GPX_LIMITS = deepFreeze({
    maxXmlBytes: 16_777_216,
    maxDepth: 32,
    maxElements: 500_000,
    maxAttributesPerElement: 32,
    maxAttributes: 500_000,
    maxTextNodeBytes: 262_144,
    maxAttributeValueBytes: 4_096,
    maxQNameBytes: 128,
    maxChildrenPerElement: 200_000,
    maxTracks: 10_000,
    maxSegments: 20_000,
    maxTrackpoints: 225_000,
    maxTimedRows: 200_000,
    maxExtensionElements: 400_000,
    maxExtensionChildren: 32
});

const INPUT_FIELDS = Object.freeze(['mediaType', 'content']);
const GPX_NS = 'http://www.topografix.com/GPX/1/1';
const TRACKPOINT_EXT_NS = 'http://www.garmin.com/xmlschemas/TrackPointExtension/v2';
const ACTIVITY_EXT_NS = 'http://www.garmin.com/xmlschemas/ActivityExtension/v2';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const XINCLUDE_NS = 'http://www.w3.org/2001/XInclude';
const NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const INTEGER = /^(?:0|[1-9]\d*)$/;
const DECIMAL = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))$/;
const DOUBLE = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
const XML_SPACE_ONLY = /^[\u0009\u000a\u000d\u0020]*$/;

const WARNING_DEFINITIONS = deepFreeze({
    GPX_IMPORT_TIME_FALLBACK: {
        path: '/sources/0/importedAt',
        message: 'The first timed GPX trackpoint is used as the deterministic import time.'
    },
    GPX_TIMEZONE_NAME_UNAVAILABLE: {
        path: '/activity/timeZone/ianaName',
        message: 'GPX trackpoint timestamps do not provide a trustworthy IANA time zone name.'
    },
    GPX_UNTIMED_TRACKPOINT_IGNORED: {
        path: '/gpx/tracks/trackpoints',
        message: 'An untimed GPX trackpoint was ignored because no offset can be represented safely.'
    },
    GPX_TRACK_NAME_CONFLICT_IGNORED: {
        path: '/activity/name',
        message: 'Conflicting GPX track names were ignored.'
    },
    GPX_SPORT_UNMAPPED: {
        path: '/activity/sportCategory',
        message: 'GPX track type metadata could not be mapped.'
    },
    GPX_NON_TRACK_CONTENT_IGNORED: {
        path: '/gpx',
        message: 'Schema-valid GPX waypoint or route content was ignored.'
    },
    GPX_EXTENSION_FIELD_IGNORED: {
        path: '/gpx/tracks/extensions',
        message: 'A supported but unmapped Garmin GPX extension field was ignored.'
    },
    GPX_UNKNOWN_EXTENSION_IGNORED: {
        path: '/gpx/extensions',
        message: 'An unsupported GPX extension was ignored.'
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
    if (typeof qname !== 'string' || utf8Length(qname) > GPX_LIMITS.maxQNameBytes) fail();
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
    if (utf8Length(content) > GPX_LIMITS.maxXmlBytes) fail();

    const source = content.startsWith('\ufeff') ? content.slice(1) : content;
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
        if (raw.includes(']]>') || utf8Length(raw) > GPX_LIMITS.maxTextNodeBytes) fail();
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
            if (utf8Length(value) > GPX_LIMITS.maxAttributeValueBytes) fail();
            rawAttributes.push({ qname: attributeQName, value });
            if (rawAttributes.length > GPX_LIMITS.maxAttributesPerElement) fail();
            rest = rest.slice(match[0].length);
        }

        elements += 1;
        attributes += rawAttributes.length;
        if (elements > GPX_LIMITS.maxElements || attributes > GPX_LIMITS.maxAttributes) fail();
        if (stack.length + 1 > GPX_LIMITS.maxDepth) fail();

        const parentNamespaces = stack.length > 0
            ? stack[stack.length - 1].namespaces
            : rootNamespace;
        const namespaces = Object.create(parentNamespaces);
        const declared = new Set();
        for (const item of rawAttributes) {
            const attributeName = splitQName(item.qname);
            const isDefault = item.qname === 'xmlns';
            const isPrefixed = attributeName.prefix === 'xmlns';
            if (!isDefault && !isPrefixed) continue;
            const prefix = isDefault ? '' : attributeName.local;
            if (declared.has(prefix) || item.value.length === 0) fail();
            if (
                prefix === 'xmlns'
                || (/^xml/i.test(prefix) && prefix !== 'xml')
                || item.value === XMLNS_NS
                || item.value === XINCLUDE_NS
                || (prefix === 'xml' && item.value !== XML_NS)
                || (prefix !== 'xml' && item.value === XML_NS)
            ) fail();
            declared.add(prefix);
            namespaces[prefix] = item.value;
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
        for (const item of rawAttributes) {
            const attributeName = splitQName(item.qname);
            if (item.qname === 'xmlns' || attributeName.prefix === 'xmlns') continue;
            const attributeUri = attributeName.prefix === '' ? '' : namespaces[attributeName.prefix];
            if (typeof attributeUri !== 'string' || attributeUri === XMLNS_NS) fail();
            const key = `${attributeUri}\u0000${attributeName.local}`;
            if (resolvedNames.has(key)) fail();
            resolvedNames.add(key);
            resolvedAttributes.push({
                uri: attributeUri,
                local: attributeName.local,
                value: item.value
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
            if (parent.children.length >= GPX_LIMITS.maxChildrenPerElement) fail();
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
    return element.uri === GPX_NS && element.local === local;
}

function requireWhitespace(element) {
    if (!XML_SPACE_ONLY.test(element.text)) fail();
}

function stringValue(element) {
    if (element.children.length > 0) fail();
    return element.text;
}

function exactTextValue(element) {
    if (
        element.children.length > 0
        || element.text.length === 0
        || element.text !== trimXmlSpace(element.text)
    ) fail();
    return element.text;
}

function assertAttributes(element, allowed = []) {
    for (const item of element.attributes) {
        const key = `${item.uri}\u0000${item.local}`;
        if (
            allowed.includes(key)
            || (item.uri === XSI_NS
                && (item.local === 'type' || item.local === 'schemaLocation'))
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
        if (child.uri !== GPX_NS || !allowed.includes(child.local)) fail();
        const current = allowed.indexOf(child.local);
        if (current < previous) fail();
        previous = current;
    }
}

function parseNumber(element, {
    integer = false,
    allowExponent = false,
    min = null,
    max = null,
    maxExclusive = false
} = {}) {
    assertAttributes(element);
    const value = exactTextValue(element);
    if (!(integer ? INTEGER : allowExponent ? DOUBLE : DECIMAL).test(value)) fail();
    const number = Number(value);
    if (!Number.isFinite(number) || (integer && !Number.isSafeInteger(number))) fail();
    if (min !== null && number < min) fail();
    if (max !== null && (maxExclusive ? number >= max : number > max)) fail();
    return number;
}

function parseCoordinateValue(value, minimum, maximum, maximumExclusive = false) {
    if (!DECIMAL.test(value)) fail();
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum) fail();
    if (maximumExclusive ? number >= maximum : number > maximum) fail();
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
    const epochMs = date.getTime() - offsetMinutes * 60_000;
    if (!Number.isFinite(epochMs)) fail();
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
    return [...warnings.values()].sort((left, right) => {
        if (left.code < right.code) return -1;
        if (left.code > right.code) return 1;
        if (left.path < right.path) return -1;
        if (left.path > right.path) return 1;
        return left.message < right.message ? -1 : left.message > right.message ? 1 : 0;
    });
}

function extensionSize(element, state) {
    state.extensionElements += 1;
    if (state.extensionElements > GPX_LIMITS.maxExtensionElements) fail();
    for (const child of element.children) extensionSize(child, state);
}

function controlledNamespace(uri) {
    return uri === ''
        || uri === GPX_NS
        || uri === TRACKPOINT_EXT_NS
        || uri === ACTIVITY_EXT_NS
        || uri === XINCLUDE_NS
        || uri === XSI_NS
        || uri === XML_NS;
}

function validateUnknownExtensionTree(element) {
    if (controlledNamespace(element.uri)) fail();
    for (const child of element.children) validateUnknownExtensionTree(child);
}

function parseUnknownOnlyExtensions(element, state) {
    assertAttributes(element);
    requireWhitespace(element);
    if (element.children.length > GPX_LIMITS.maxExtensionChildren) fail();
    for (const child of element.children) {
        extensionSize(child, state);
        validateUnknownExtensionTree(child);
        addWarning(state.warnings, 'GPX_UNKNOWN_EXTENSION_IGNORED');
    }
}

function parseNestedExtension(element, state, ownerNamespace) {
    assertAttributes(element);
    requireWhitespace(element);
    if (element.children.length > GPX_LIMITS.maxExtensionChildren) fail();
    for (const child of element.children) {
        if (child.uri === ownerNamespace) fail();
        validateUnknownExtensionTree(child);
        addWarning(state.warnings, 'GPX_UNKNOWN_EXTENSION_IGNORED');
    }
}

function parseTrackPointExtension(element, state) {
    assertAttributes(element);
    requireWhitespace(element);
    const order = ['atemp', 'wtemp', 'depth', 'hr', 'cad', 'speed', 'course', 'bearing', 'Extensions'];
    let previous = -1;
    const result = { heartRate: null, cadence: null };
    for (const field of element.children) {
        if (field.uri !== TRACKPOINT_EXT_NS) fail();
        const current = order.indexOf(field.local);
        if (current < 0 || current < previous) fail();
        previous = current;
        if (element.children.filter(item => item.local === field.local).length > 1) fail();
        if (field.local === 'hr') {
            result.heartRate = parseNumber(field, { integer: true, min: 1, max: 255 });
        } else if (field.local === 'cad') {
            result.cadence = parseNumber(field, { integer: true, min: 0, max: 254 });
        } else if (field.local === 'atemp' || field.local === 'wtemp' || field.local === 'depth') {
            parseNumber(field, { allowExponent: true });
            addWarning(state.warnings, 'GPX_EXTENSION_FIELD_IGNORED');
        } else if (field.local === 'speed') {
            parseNumber(field, { allowExponent: true, min: 0 });
            addWarning(state.warnings, 'GPX_EXTENSION_FIELD_IGNORED');
        } else if (field.local === 'course' || field.local === 'bearing') {
            parseNumber(field, { min: 0, max: 360 });
            addWarning(state.warnings, 'GPX_EXTENSION_FIELD_IGNORED');
        } else if (field.local === 'Extensions') {
            parseNestedExtension(field, state, TRACKPOINT_EXT_NS);
        }
    }
    return result;
}

function parseActivityExtension(element, state) {
    assertAttributes(element, ['\u0000CadenceSensor']);
    const sensor = attribute(element, '', 'CadenceSensor', false);
    if (sensor !== null && sensor !== 'Footpod' && sensor !== 'Bike') fail();
    requireWhitespace(element);
    const order = ['Speed', 'RunCadence', 'Watts', 'Extensions'];
    let previous = -1;
    const result = { cadence: null, power: null };
    for (const field of element.children) {
        if (field.uri !== ACTIVITY_EXT_NS) fail();
        const current = order.indexOf(field.local);
        if (current < 0 || current < previous) fail();
        previous = current;
        if (element.children.filter(item => item.local === field.local).length > 1) fail();
        if (field.local === 'Speed') {
            parseNumber(field, { allowExponent: true });
            addWarning(state.warnings, 'GPX_EXTENSION_FIELD_IGNORED');
        } else if (field.local === 'RunCadence') {
            result.cadence = parseNumber(field, { integer: true, min: 0, max: 254 });
        } else if (field.local === 'Watts') {
            result.power = parseNumber(field, { integer: true, min: 0, max: 65_535 });
        } else if (field.local === 'Extensions') {
            parseNestedExtension(field, state, ACTIVITY_EXT_NS);
        }
    }
    return result;
}

function parsePointExtensions(element, state) {
    assertAttributes(element);
    requireWhitespace(element);
    if (element.children.length > GPX_LIMITS.maxExtensionChildren) fail();
    const result = { heartRate: null, cadence: null, power: null };
    let sawTpe = false;
    let sawAe = false;
    for (const child of element.children) {
        extensionSize(child, state);
        if (child.uri === TRACKPOINT_EXT_NS && child.local === 'TrackPointExtension') {
            if (sawTpe) fail();
            sawTpe = true;
            const parsed = parseTrackPointExtension(child, state);
            result.heartRate = parsed.heartRate;
            result.cadence = parsed.cadence;
        } else if (child.uri === ACTIVITY_EXT_NS && child.local === 'TPX') {
            if (sawAe) fail();
            sawAe = true;
            const parsed = parseActivityExtension(child, state);
            if (result.cadence !== null && parsed.cadence !== null && result.cadence !== parsed.cadence) fail();
            result.cadence ??= parsed.cadence;
            result.power = parsed.power;
        } else if (child.uri === TRACKPOINT_EXT_NS || child.uri === ACTIVITY_EXT_NS) fail();
        else {
            validateUnknownExtensionTree(child);
            addWarning(state.warnings, 'GPX_UNKNOWN_EXTENSION_IGNORED');
        }
    }
    return result;
}

function parseLink(element) {
    assertAttributes(element, ['\u0000href']);
    attribute(element, '', 'href', true);
    assertCoreChildren(element, ['text', 'type']);
    for (const local of ['text', 'type']) {
        const child = oneChild(element, local, false);
        if (child) {
            assertAttributes(child);
            stringValue(child);
        }
    }
}

function parsePerson(element) {
    assertAttributes(element);
    assertCoreChildren(element, ['name', 'email', 'link']);
    const name = oneChild(element, 'name', false);
    if (name) {
        assertAttributes(name);
        stringValue(name);
    }
    const email = oneChild(element, 'email', false);
    if (email) {
        assertAttributes(email, ['\u0000id', '\u0000domain']);
        attribute(email, '', 'id', true);
        attribute(email, '', 'domain', true);
        requireWhitespace(email);
        if (email.children.length !== 0) fail();
    }
    const link = oneChild(element, 'link', false);
    if (link) parseLink(link);
}

function parseCopyright(element) {
    assertAttributes(element, ['\u0000author']);
    attribute(element, '', 'author', true);
    assertCoreChildren(element, ['year', 'license']);
    const year = oneChild(element, 'year', false);
    if (year) {
        assertAttributes(year);
        if (!/^\d{4}$/.test(exactTextValue(year))) fail();
    }
    const license = oneChild(element, 'license', false);
    if (license) {
        assertAttributes(license);
        stringValue(license);
    }
}

function parseBounds(element) {
    assertAttributes(element, ['\u0000minlat', '\u0000minlon', '\u0000maxlat', '\u0000maxlon']);
    requireWhitespace(element);
    if (element.children.length !== 0) fail();
    const minlat = parseCoordinateValue(attribute(element, '', 'minlat', true), -90, 90);
    const minlon = parseCoordinateValue(attribute(element, '', 'minlon', true), -180, 180, true);
    const maxlat = parseCoordinateValue(attribute(element, '', 'maxlat', true), -90, 90);
    const maxlon = parseCoordinateValue(attribute(element, '', 'maxlon', true), -180, 180, true);
    if (minlat > maxlat || minlon > maxlon) fail();
}

function parseMetadata(element, state) {
    assertAttributes(element);
    assertCoreChildren(element, [
        'name', 'desc', 'author', 'copyright', 'link', 'time',
        'keywords', 'bounds', 'extensions'
    ]);
    for (const local of ['name', 'desc', 'keywords']) {
        const child = oneChild(element, local, false);
        if (child) {
            assertAttributes(child);
            const value = stringValue(child);
            if (local === 'name') state.metadataName = trimXmlSpace(value);
        }
    }
    const author = oneChild(element, 'author', false);
    if (author) parsePerson(author);
    const copyright = oneChild(element, 'copyright', false);
    if (copyright) parseCopyright(copyright);
    for (const link of children(element, 'link')) parseLink(link);
    const time = oneChild(element, 'time', false);
    if (time) parseDateTime(time);
    const bounds = oneChild(element, 'bounds', false);
    if (bounds) parseBounds(bounds);
    const extensions = oneChild(element, 'extensions', false);
    if (extensions) parseUnknownOnlyExtensions(extensions, state);
}

function parseWaypoint(element, state, trackpoint = false) {
    assertAttributes(element, ['\u0000lat', '\u0000lon']);
    const position = [
        parseCoordinateValue(attribute(element, '', 'lat', true), -90, 90),
        parseCoordinateValue(attribute(element, '', 'lon', true), -180, 180, true)
    ];
    assertCoreChildren(element, [
        'ele', 'time', 'magvar', 'geoidheight', 'name', 'cmt', 'desc', 'src',
        'link', 'sym', 'type', 'fix', 'sat', 'hdop', 'vdop', 'pdop',
        'ageofdgpsdata', 'dgpsid', 'extensions'
    ]);
    const elevationElement = oneChild(element, 'ele', false);
    const timeElement = oneChild(element, 'time', false);
    const elevation = elevationElement ? parseNumber(elevationElement) : null;
    const time = timeElement ? parseDateTime(timeElement) : null;
    const magvar = oneChild(element, 'magvar', false);
    if (magvar) parseNumber(magvar, { min: 0, max: 360, maxExclusive: true });
    const geoid = oneChild(element, 'geoidheight', false);
    if (geoid) parseNumber(geoid);
    for (const local of ['name', 'cmt', 'desc', 'src', 'sym', 'type']) {
        const child = oneChild(element, local, false);
        if (child) {
            assertAttributes(child);
            stringValue(child);
        }
    }
    for (const link of children(element, 'link')) parseLink(link);
    const fix = oneChild(element, 'fix', false);
    if (fix) {
        assertAttributes(fix);
        if (!['none', '2d', '3d', 'dgps', 'pps'].includes(exactTextValue(fix))) fail();
    }
    const sat = oneChild(element, 'sat', false);
    if (sat) parseNumber(sat, { integer: true, min: 0 });
    for (const local of ['hdop', 'vdop', 'pdop', 'ageofdgpsdata']) {
        const child = oneChild(element, local, false);
        if (child) parseNumber(child);
    }
    const dgpsid = oneChild(element, 'dgpsid', false);
    if (dgpsid) parseNumber(dgpsid, { integer: true, min: 0, max: 1023 });
    const extensionsElement = oneChild(element, 'extensions', false);
    let extensions = { heartRate: null, cadence: null, power: null };
    if (extensionsElement) {
        extensions = trackpoint
            ? parsePointExtensions(extensionsElement, state)
            : (parseUnknownOnlyExtensions(extensionsElement, state), extensions);
    }
    return {
        epochMs: time?.epochMs ?? null,
        iso: time?.iso ?? null,
        offsetMinutes: time?.offsetMinutes ?? null,
        position,
        altitude: elevation,
        heartRate: extensions.heartRate,
        cadence: extensions.cadence,
        power: extensions.power
    };
}

function parseRoute(element, state) {
    assertAttributes(element);
    assertCoreChildren(element, [
        'name', 'cmt', 'desc', 'src', 'link', 'number', 'type', 'extensions', 'rtept'
    ]);
    for (const local of ['name', 'cmt', 'desc', 'src', 'type']) {
        const child = oneChild(element, local, false);
        if (child) {
            assertAttributes(child);
            stringValue(child);
        }
    }
    for (const link of children(element, 'link')) parseLink(link);
    const number = oneChild(element, 'number', false);
    if (number) parseNumber(number, { integer: true, min: 0 });
    const extensions = oneChild(element, 'extensions', false);
    if (extensions) parseUnknownOnlyExtensions(extensions, state);
    for (const point of children(element, 'rtept')) parseWaypoint(point, state, false);
}

function sameValue(left, right) {
    if (Array.isArray(left) && Array.isArray(right)) {
        return left.length === right.length && left.every((value, index) => value === right[index]);
    }
    return left === right;
}

function appendPoint(state, point) {
    if (point.epochMs === null) {
        addWarning(state.warnings, 'GPX_UNTIMED_TRACKPOINT_IGNORED');
        return;
    }
    const previous = state.rows.at(-1);
    if (previous && point.epochMs < previous.epochMs) fail();
    if (previous && point.epochMs === previous.epochMs) {
        for (const field of ['position', 'altitude', 'heartRate', 'cadence', 'power']) {
            if (point[field] === null) continue;
            if (previous[field] !== null && !sameValue(previous[field], point[field])) fail();
            if (previous[field] === null) previous[field] = point[field];
        }
        return;
    }
    if (state.rows.length >= GPX_LIMITS.maxTimedRows) fail();
    state.rows.push(point);
}

function parseSegment(element, state) {
    state.segments += 1;
    if (state.segments > GPX_LIMITS.maxSegments) fail();
    assertAttributes(element);
    assertCoreChildren(element, ['trkpt', 'extensions']);
    for (const pointElement of children(element, 'trkpt')) {
        state.trackpoints += 1;
        if (state.trackpoints > GPX_LIMITS.maxTrackpoints) fail();
        appendPoint(state, parseWaypoint(pointElement, state, true));
    }
    const extensions = oneChild(element, 'extensions', false);
    if (extensions) parseUnknownOnlyExtensions(extensions, state);
}

function mapSport(value, state) {
    const normalized = trimXmlSpace(value).replace(/[A-Z]/g, character => character.toLowerCase());
    if (normalized === 'run' || normalized === 'running') return 'run';
    if (['ride', 'riding', 'bike', 'biking', 'cycling'].includes(normalized)) return 'ride';
    if (normalized === 'walk' || normalized === 'walking') return 'walk';
    if (normalized === 'hike' || normalized === 'hiking') return 'hike';
    if (normalized === 'workout') return 'workout';
    addWarning(state.warnings, 'GPX_SPORT_UNMAPPED');
    return 'other';
}

function parseTrack(element, state) {
    state.tracks += 1;
    if (state.tracks > GPX_LIMITS.maxTracks) fail();
    assertAttributes(element);
    assertCoreChildren(element, [
        'name', 'cmt', 'desc', 'src', 'link', 'number', 'type', 'extensions', 'trkseg'
    ]);
    for (const local of ['name', 'cmt', 'desc', 'src']) {
        const child = oneChild(element, local, false);
        if (child) {
            assertAttributes(child);
            const value = stringValue(child);
            if (local === 'name') {
                const name = trimXmlSpace(value);
                if (name.length > 0) state.trackNames.add(name);
            }
        }
    }
    for (const link of children(element, 'link')) parseLink(link);
    const number = oneChild(element, 'number', false);
    if (number) parseNumber(number, { integer: true, min: 0 });
    const type = oneChild(element, 'type', false);
    if (type) {
        assertAttributes(type);
        state.sports.add(mapSport(stringValue(type), state));
    }
    const extensions = oneChild(element, 'extensions', false);
    if (extensions) parseUnknownOnlyExtensions(extensions, state);
    for (const segment of children(element, 'trkseg')) parseSegment(segment, state);
}

function buildStreams(activityId, rows) {
    const startEpochMs = rows[0].epochMs;
    const offsetsSeconds = rows.map(row => (row.epochMs - startEpochMs) / 1000);
    if (offsetsSeconds.some(offset => !Number.isFinite(offset) || offset < 0)) fail();
    const definitions = [
        ['position', 'wgs84', 'position'],
        ['altitude', 'm', 'altitude'],
        ['heartRate', 'bpm', 'heartRate'],
        ['cadence', 'rpm', 'cadence'],
        ['power', 'W', 'power']
    ];
    const series = [];
    for (const [streamType, unit, field] of definitions) {
        const values = rows.map(row => row[field]);
        if (values.some(value => value !== null)) {
            series.push({ streamType, unit, offsetsSeconds: [...offsetsSeconds], values });
        }
    }
    return { activityId, series };
}

function buildBundle(root) {
    if (!core(root, 'gpx')) fail();
    assertAttributes(root, ['\u0000version', '\u0000creator']);
    if (attribute(root, '', 'version', true) !== '1.1') fail();
    attribute(root, '', 'creator', true);
    assertCoreChildren(root, ['metadata', 'wpt', 'rte', 'trk', 'extensions']);

    const warnings = new Map();
    const state = {
        warnings,
        rows: [],
        tracks: 0,
        segments: 0,
        trackpoints: 0,
        extensionElements: 0,
        trackNames: new Set(),
        metadataName: '',
        sports: new Set()
    };
    const metadata = oneChild(root, 'metadata', false);
    if (metadata) parseMetadata(metadata, state);
    const waypoints = children(root, 'wpt');
    const routes = children(root, 'rte');
    for (const waypoint of waypoints) parseWaypoint(waypoint, state, false);
    for (const route of routes) parseRoute(route, state);
    if (waypoints.length > 0 || routes.length > 0) {
        addWarning(warnings, 'GPX_NON_TRACK_CONTENT_IGNORED');
    }
    for (const track of children(root, 'trk')) parseTrack(track, state);
    const extensions = oneChild(root, 'extensions', false);
    if (extensions) parseUnknownOnlyExtensions(extensions, state);

    if (state.tracks === 0 || state.segments === 0 || state.trackpoints === 0 || state.rows.length === 0) fail();
    if (state.sports.size > 1) fail();
    const sport = state.sports.size === 1 ? [...state.sports][0] : 'other';
    const start = state.rows[0];
    const activityId = `gpx-track:${encodeURIComponent(start.iso)}:${state.tracks}:${state.segments}:${state.rows.length}`;
    const streams = buildStreams(activityId, state.rows);
    const streamTypes = new Set(streams.series.map(item => item.streamType));
    addWarning(warnings, 'GPX_IMPORT_TIME_FALLBACK');
    addWarning(warnings, 'GPX_TIMEZONE_NAME_UNAVAILABLE');
    const activity = {
        schemaVersion: 1,
        id: activityId,
        sportCategory: sport,
        sportVariant: null,
        startTimeUtc: start.iso,
        timeZone: { ianaName: null, utcOffsetMinutes: start.offsetMinutes },
        capabilities: {
            hasGps: streamTypes.has('position'),
            hasHeartRate: streamTypes.has('heartRate'),
            hasPower: streamTypes.has('power'),
            hasCadence: streamTypes.has('cadence'),
            hasLaps: false
        }
    };
    if (state.trackNames.size === 1) activity.name = [...state.trackNames][0];
    else if (state.trackNames.size > 1) addWarning(warnings, 'GPX_TRACK_NAME_CONFLICT_IGNORED');
    else if (state.metadataName.length > 0) activity.name = state.metadataName;

    const source = {
        id: `${activityId}:source:0`,
        activityId,
        provider: 'gpx',
        externalId: null,
        rawArtifactId: null,
        acquisitionMethod: 'local-file',
        deviceId: null,
        importedAt: start.iso
    };
    const bundle = {
        schemaVersion: 1,
        activity,
        streams,
        laps: [],
        events: [],
        sources: [source],
        devices: [],
        warnings: sortedWarnings(warnings),
        versionMetadata: { schemaVersion: 1, parserVersion: 'gpx-1.0.0' }
    };
    const validation = validateImportedActivityBundle(bundle);
    if (!validation.ok) fail();
    return deepFreeze(bundle);
}

export const gpxDecoder = Object.freeze({
    id: 'gpx',
    mediaType: GPX_MEDIA_TYPE,
    decode(input) {
        const values = ownDataValues(input, INPUT_FIELDS);
        if (!values) fail();
        if (typeof values.mediaType !== 'string' || typeof values.content !== 'string') fail();
        try {
            structuredClone(input);
        } catch {
            fail();
        }
        if (values.mediaType !== GPX_MEDIA_TYPE) fail(IMPORT_ERROR_CODE.UNSUPPORTED_FORMAT);
        try {
            return buildBundle(parseXml(values.content));
        } catch (error) {
            if (error instanceof ImportError) throw error;
            fail();
        }
    }
});
