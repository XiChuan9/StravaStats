import { GPX_MEDIA_TYPE } from '../../../../js/decoders/gpx/decoder.js';

export const SYNTHETIC_GPX_START = '2032-05-06T07:08:09.000Z';

function tag(name, value) {
    return value === undefined || value === null ? '' : `<${name}>${value}</${name}>`;
}

export function createSyntheticGpxPoint({
    latitude = 0,
    longitude = 0,
    elevation,
    time,
    heartRate,
    cadence,
    runCadence,
    power,
    speed,
    unknownExtension = false,
    extra = ''
} = {}) {
    const tpeFields = [
        tag('gpxtpx:hr', heartRate),
        tag('gpxtpx:cad', cadence),
        tag('gpxtpx:speed', speed)
    ].join('');
    const aeFields = [
        tag('gpxax:RunCadence', runCadence),
        tag('gpxax:Watts', power)
    ].join('');
    const extensions = tpeFields || aeFields || unknownExtension
        ? `<extensions>${tpeFields ? `<gpxtpx:TrackPointExtension>${tpeFields}</gpxtpx:TrackPointExtension>` : ''}${aeFields ? `<gpxax:TPX>${aeFields}</gpxax:TPX>` : ''}${unknownExtension ? '<synthetic:Unknown synthetic:flag="bounded"/>' : ''}</extensions>`
        : '';
    return `<trkpt lat="${latitude}" lon="${longitude}">${tag('ele', elevation)}${tag('time', time)}${extensions}${extra}</trkpt>`;
}

export function createSyntheticGpxActivity({
    prefixed = false,
    schemaLocation = false,
    declaration = true,
    metadataName = 'Synthetic GPX Activity',
    metadataTime,
    bounds,
    tracks
} = {}) {
    const defaultTracks = [{
        name: 'Synthetic GPX Activity',
        type: 'Running',
        segments: [[
            createSyntheticGpxPoint({
                latitude: 0,
                longitude: 0,
                elevation: 0,
                time: SYNTHETIC_GPX_START,
                heartRate: 140,
                cadence: 0,
                runCadence: 0,
                power: 0
            }),
            createSyntheticGpxPoint({
                latitude: 1,
                longitude: 2,
                elevation: 12.5,
                time: '2032-05-06T07:08:19.000Z',
                heartRate: 150,
                cadence: 90,
                runCadence: 90,
                power: 250
            })
        ]]
    }];
    const selectedTracks = tracks ?? defaultTracks;
    const pointPrefix = prefixed ? 'g:' : '';
    const core = local => `${pointPrefix}${local}`;
    const renderPoint = point => prefixed
        ? point.replaceAll('<trkpt', '<g:trkpt').replaceAll('</trkpt>', '</g:trkpt>')
            .replaceAll('<ele>', '<g:ele>').replaceAll('</ele>', '</g:ele>')
            .replaceAll('<time>', '<g:time>').replaceAll('</time>', '</g:time>')
            .replaceAll('<extensions>', '<g:extensions>').replaceAll('</extensions>', '</g:extensions>')
        : point;
    const trackXml = selectedTracks.map(track => {
        const segments = (track.segments ?? []).map(segment =>
            `<${core('trkseg')}>${segment.map(renderPoint).join('')}</${core('trkseg')}>`
        ).join('');
        return `<${core('trk')}>${tag(core('name'), track.name)}${tag(core('type'), track.type)}${segments}</${core('trk')}>`;
    }).join('');
    const boundsXml = bounds
        ? `<${core('bounds')} minlat="${bounds.minlat}" minlon="${bounds.minlon}" maxlat="${bounds.maxlat}" maxlon="${bounds.maxlon}"/>`
        : '';
    const metadata = metadataName !== null || metadataTime !== undefined || bounds
        ? `<${core('metadata')}>${tag(core('name'), metadataName)}${tag(core('time'), metadataTime)}${boundsXml}</${core('metadata')}>`
        : '';
    const namespace = prefixed
        ? 'xmlns:g="http://www.topografix.com/GPX/1/1"'
        : 'xmlns="http://www.topografix.com/GPX/1/1"';
    const rootName = core('gpx');
    return `${declaration ? '<?xml version="1.0" encoding="UTF-8"?>' : ''}<${rootName} ${namespace} xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v2" xmlns:gpxax="http://www.garmin.com/xmlschemas/ActivityExtension/v2" xmlns:synthetic="urn:stravastats:synthetic:gpx" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.1" creator="StravaStats synthetic fixture"${schemaLocation ? ' xsi:schemaLocation="http://www.topografix.com/GPX/1/1 https://invalid.example/gpx.xsd"' : ''}>${metadata}${trackXml}</${rootName}>`;
}

export function syntheticGpxDescriptor(content = createSyntheticGpxActivity()) {
    return { mediaType: GPX_MEDIA_TYPE, content };
}
