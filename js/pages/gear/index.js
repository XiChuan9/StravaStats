import { isDemoMode } from '../../demo/index.js';
import { createMapLocationBoundary } from '../../app/map-location-egress.js';
import { renderGearDetailPage as renderGearDetail } from './gear-analysis.js';

export async function renderGearDetailPage(gearId, { demoModeReader = isDemoMode } = {}) {
    const demo = demoModeReader();
    const sessionMode = demo ? 'demo' : 'real';
    const mapLocationBoundary = createMapLocationBoundary({ sessionMode });
    return renderGearDetail(gearId, { sessionMode, mapLocationBoundary });
}
