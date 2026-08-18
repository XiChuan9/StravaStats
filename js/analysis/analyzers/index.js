/**
 * ANALYZERS INDEX — Export all sport analyzers
 */

export { BaseAnalyzer } from './base-analyzer.js';
export { RunningAnalyzer } from './running.js';
export { TrailRunAnalyzer } from './trail-run.js';
export { CyclingAnalyzer } from './cycling.js';
export { HikingAnalyzer } from './hiking.js';
export { GravelMTBAnalyzer } from './gravel-mtb.js';

/**
 * Factory function to get appropriate analyzer for sport type
 */
export function getAnalyzerForSport(sport_type, track, config = {}) {
    const type = (sport_type || '').toLowerCase();

    if (type.includes('run')) {
        if (type.includes('trail')) {
            return import('./trail-run.js').then(m => {
                const analyzer = new m.TrailRunAnalyzer(track, config);
                return analyzer;
            });
        }
        return import('./running.js').then(m => {
            const analyzer = new m.RunningAnalyzer(track, config);
            return analyzer;
        });
    }

    if (type.includes('ride') || type.includes('bike') || type.includes('mtb')) {
        if (type.includes('gravel') || type.includes('mtb') || type.includes('mountainbike')) {
            return import('./gravel-mtb.js').then(m => {
                const analyzer = new m.GravelMTBAnalyzer(track, config);
                return analyzer;
            });
        }
        return import('./cycling.js').then(m => {
            const analyzer = new m.CyclingAnalyzer(track, config);
            return analyzer;
        });
    }

    if (type.includes('hike')) {
        return import('./hiking.js').then(m => {
            const analyzer = new m.HikingAnalyzer(track, config);
            return analyzer;
        });
    }

    return import('./base-analyzer.js').then(m => {
        const analyzer = new m.BaseAnalyzer(track, config);
        return analyzer;
    });
}
