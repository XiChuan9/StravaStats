export const SYNTHETIC_TCX_START = '2031-04-05T06:07:08.000Z';

function escapeText(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function tag(name, content, attributes = '') {
    return `<${name}${attributes}>${content}</${name}>`;
}

function renderPoint(point, corePrefix) {
    const c = name => `${corePrefix}${name}`;
    const fields = [tag(c('Time'), escapeText(point.time))];
    if (point.latitude !== undefined || point.longitude !== undefined) {
        const position = [];
        if (point.latitude !== undefined) {
            position.push(tag(c('LatitudeDegrees'), escapeText(point.latitude)));
        }
        if (point.longitude !== undefined) {
            position.push(tag(c('LongitudeDegrees'), escapeText(point.longitude)));
        }
        fields.push(tag(c('Position'), position.join('')));
    }
    if (point.altitude !== undefined) {
        fields.push(tag(c('AltitudeMeters'), escapeText(point.altitude)));
    }
    if (point.distance !== undefined) {
        fields.push(tag(c('DistanceMeters'), escapeText(point.distance)));
    }
    if (point.heartRate !== undefined) {
        fields.push(tag(
            c('HeartRateBpm'),
            tag(c('Value'), escapeText(point.heartRate))
        ));
    }
    if (point.cadence !== undefined) {
        fields.push(tag(c('Cadence'), escapeText(point.cadence)));
    }
    const activityExtension = [];
    if (point.speed !== undefined) {
        activityExtension.push(tag('ae:Speed', escapeText(point.speed)));
    }
    if (point.runCadence !== undefined) {
        activityExtension.push(tag('ae:RunCadence', escapeText(point.runCadence)));
    }
    if (point.power !== undefined) {
        activityExtension.push(tag('ae:Watts', escapeText(point.power)));
    }
    const temperatureExtension = [];
    if (point.temperature !== undefined) {
        temperatureExtension.push(tag('tpe:atemp', escapeText(point.temperature)));
    }
    if (point.waterTemperature !== undefined) {
        temperatureExtension.push(tag('tpe:wtemp', escapeText(point.waterTemperature)));
    }
    const extensions = [];
    if (activityExtension.length > 0) {
        extensions.push(tag('ae:TPX', activityExtension.join('')));
    }
    if (temperatureExtension.length > 0) {
        extensions.push(tag('tpe:TrackPointExtension', temperatureExtension.join('')));
    }
    if (point.unknownExtension) {
        extensions.push(`<synthetic:Unknown synthetic:flag="bounded">ignored</synthetic:Unknown>`);
    }
    if (extensions.length > 0) {
        fields.push(tag(c('Extensions'), extensions.join('')));
    }
    return tag(c('Trackpoint'), fields.join(''));
}

function renderLap(lap, corePrefix) {
    const c = name => `${corePrefix}${name}`;
    const fields = [
        tag(c('TotalTimeSeconds'), escapeText(lap.totalTime ?? 30)),
        tag(c('DistanceMeters'), escapeText(lap.distance ?? 1000)),
        tag(c('Calories'), escapeText(lap.calories ?? 100)),
        tag(c('Intensity'), escapeText(lap.intensity ?? 'Active')),
        tag(c('TriggerMethod'), escapeText(lap.triggerMethod ?? 'Manual'))
    ];
    for (const track of lap.tracks ?? []) {
        fields.push(tag(c('Track'), track.map(point => renderPoint(point, corePrefix)).join('')));
    }
    if (lap.emptyTrack) fields.push(`<${c('Track')}></${c('Track')}>`);
    if (lap.lapExtension) {
        fields.push(tag(c('Extensions'), '<ae:LX><ae:AvgSpeed>1</ae:AvgSpeed></ae:LX>'));
    }
    return tag(
        c('Lap'),
        fields.join(''),
        ` StartTime="${escapeText(lap.start)}"`
    );
}

export function createSyntheticTcxActivity(options = {}) {
    const prefixed = options.prefixed ?? false;
    const corePrefix = prefixed ? 'tcx:' : '';
    const c = name => `${corePrefix}${name}`;
    const activityId = options.activityId ?? SYNTHETIC_TCX_START;
    const laps = options.laps ?? [{
        start: SYNTHETIC_TCX_START,
        totalTime: 30,
        distance: 1000,
        tracks: [[
            {
                time: SYNTHETIC_TCX_START,
                latitude: 0,
                longitude: 0,
                altitude: 12.5,
                distance: 0,
                heartRate: 120,
                cadence: 0,
                speed: 0,
                power: 0,
                temperature: 0,
                waterTemperature: 0
            },
            {
                time: '2031-04-05T06:07:38.000Z',
                latitude: 1.25,
                longitude: 2.5,
                altitude: 15,
                distance: 1000,
                heartRate: 150,
                runCadence: 82,
                speed: 4.5,
                power: 250,
                temperature: 18,
                waterTemperature: 16
            }
        ]]
    }];
    const namespace = prefixed
        ? ' xmlns:tcx="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"'
        : ' xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"';
    const rootAttributes = `${namespace}`
        + ' xmlns:ae="http://www.garmin.com/xmlschemas/ActivityExtension/v2"'
        + ' xmlns:tpe="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"'
        + ' xmlns:synthetic="urn:stravastats:synthetic:tcx"'
        + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
        + (options.schemaLocation
            ? ' xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 https://invalid.example/synthetic.xsd"'
            : '');
    const activity = tag(
        c('Activity'),
        [
            tag(c('Id'), escapeText(activityId)),
            ...laps.map(lap => renderLap(lap, corePrefix)),
            options.creator
                ? tag(c('Creator'), tag(c('Name'), 'Synthetic Device'), ' xsi:type="Device_t"')
                : '',
            options.activityExtension
                ? tag(c('Extensions'), '<synthetic:Metadata>ignored</synthetic:Metadata>')
                : ''
        ].join(''),
        ` Sport="${escapeText(options.sport ?? 'Running')}"`
    );
    const rootChildren = tag(c('Activities'), activity)
        + (options.author ? tag(c('Author'), tag(c('Name'), 'Synthetic App')) : '');
    return `${options.xmlDeclaration ?? '<?xml version="1.0" encoding="UTF-8"?>'}`
        + tag(c('TrainingCenterDatabase'), rootChildren, rootAttributes);
}

export function syntheticTcxDescriptor(content = createSyntheticTcxActivity()) {
    return Object.freeze({
        mediaType: 'application/vnd.garmin.tcx+xml',
        content
    });
}
