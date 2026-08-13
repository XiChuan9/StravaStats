/**
 * Demo Polylines - Encoded Google polyline format
 * SYNTHETIC_ROUTE_PROVENANCE_V1: deliberately fabricated coordinate geometry;
 * no person or real GPS trace is represented or was used as source material.
 * These abstract shapes are not tied to any named place.
 */

export const DEMO_POLYLINES = {
    // Fabricated compact linework
    Run: [
        '_ibE~reKoF_DgEvBnAnFnFf@vBgE',
        'wtcEfrfK_DcGwGg@wBfErDfEjHS',
        'o`eEnqgKkH?_DsD?kHzEkCbGvB',
        'glfEvphKwBvGoF~CwGoAg@cGfEsD',
        '_xgE~oiKgEgEgEfEfEfEfEgEgEgE',
        'wciEfojKoA_IsDkCwGf@kCnFz@jH',
        'oojEnnkKcGwBcBwG~C{EjH?jCnF',
        'g{kEvmlKsDfE_If@_DoFf@kHbGkC',
        '_gmE~lmKcBoF{E_DkH?gErDf@vG',
        'wrnEflnKwGnAsDnFz@jHbGvBzE_D',
        'o~oEnkoKkCsD_D{Ez@kHbGcBfErD',
        'gjqEvjpK{E{@cGjCwBvGjCnFjHf@',
        '_vrE~iqK{@bGgEzEkHRsDgEf@wG',
        'watEfirKoFoFkH?wBbG~CbGjHR',
    ],

    // Fabricated extended linework
    Ride: [
        '_}hQ_glWgJ_DsIoFoFsIg@{JfEsIrIgEzJ?jHnFbBzJ',
        'gujQ_ujWsD{JgJoFoK?_IbGwBnKrDfJzJ~CfJgE~C{J',
        'omlQ_ciWoK{@sIcGgE{Jf@cLbG_InKwBfJfE~CzJkCnK',
        'wenQ_qgWcGrIoKvB{J_D{EgJf@cLjHkHbLg@~HvGz@bL',
        '_~oQ__fWcL?gJgE{EgJ?cLnFsIzJ_DnKvBbGrISbL',
        'gvqQ_mdWkCcL_IkHcL{@gJzE_DnKjCbLfJnFbLg@jH_I',
        'onsQ_{bWsIcGcLSsIbGcBbLzEfJnKjCzJsDrD{JkCcL',
        'wfuQ_iaWoKvB_IjHoAbLfEzJzJrDnKwBvGsIf@cLoFsI',
        '__wQ_w_W{EgJoKkC{JrDsDzJjCbLfJzEbLoAbGgJ{@cL',
        'gwxQ_e~V{JgE{J~CgEzJvBbLfJnFbLg@jH_IRcLwGsI',
        'oozQ_s|VkHjHcLf@gJoFwBcLfE{JnKkCzJfEjCnKsDzJ',
    ],

    // Fabricated short linework
    Swim: [
        '~po]_{rc@sDoAsDoAsDoA',
        'flm]sctc@kCvBkCvBkCvB',
        'ngk]gluc@oF?oF?',
        'vbi]{tvc@?{E?{E',
        '~}f]o}wc@_D_D~C_D~C~C',
        'fyd]cfyc@gEz@gE{@gEz@',
        'ntb]wnzc@wBgEwBfEwBgE',
    ],
};

/**
 * Generates a random polyline from the demo collection
 */
export function getRandomPolyline(activityType) {
    const candidates = DEMO_POLYLINES[activityType] || DEMO_POLYLINES.Run;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Utility: Decode a polyline string into coordinates
 * (Used by the map to render routes)
 */
export function decodePolyline(encoded) {
    if (!encoded) return [];
    let index = 0, lat = 0, lng = 0, coordinates = [];
    while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += deltaLat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += deltaLng;

        coordinates.push([lat / 1e5, lng / 1e5]);
    }
    return coordinates;
}
