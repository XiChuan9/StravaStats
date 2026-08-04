/**
 * ADVANCED_ANALYSIS.JS — Integration module for activity analysis
 * Bridges new analysis engine with activity page UI
 */

import { analyzeActivity } from '../../analysis/index.js';
import { GPXExporter, CSVExporter, JSONExporter } from '../../analysis/export/index.js';

export class AdvancedActivityAnalyzer {
    constructor(activity_id, metadata, streams, analysis = analyzeActivity) {
        this.activity_id = activity_id;
        this.metadata = structuredClone(metadata);
        this.streams = structuredClone(streams);
        this.analysis = analysis;
        this.analysis_result = null;
    }

    /**
     * Run complete analysis
     */
    async analyze(mode = 'normal', athlete_profile = null) {
        if (!this.metadata || !this.streams) {
            throw new Error('Activity data is unavailable');
        }
        this.analysis_result = await this.analysis(
            this.activity_id,
            this.metadata,
            this.streams,
            athlete_profile,
            mode
        );
        return this.analysis_result;
    }

    /**
     * Export analysis in various formats
     */
    async export(format = 'json') {
        if (!this.analysis_result) {
            throw new Error('No analysis result to export');
        }

        switch (format.toLowerCase()) {
            case 'gpx':
                if (!this.analysis_result.track) {
                    console.warn('Track data not available for GPX export');
                    return null;
                }
                return GPXExporter.export(this.analysis_result.track, this.metadata.name);

            case 'csv':
                if (!this.analysis_result.track) {
                    console.warn('Track data not available for CSV export');
                    return null;
                }
                return CSVExporter.export(this.analysis_result.track);

            case 'json':
            default:
                return JSONExporter.export(this.analysis_result);
        }
    }

    /**
     * Download export
     */
    downloadExport(format = 'json') {
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `${this.metadata.name.replace(/\s+/g, '_')}_${timestamp}`;

        switch (format.toLowerCase()) {
            case 'gpx':
                GPXExporter.download(this.analysis_result.track, `${filename}.gpx`);
                break;
            case 'csv':
                CSVExporter.download(this.analysis_result.track, `${filename}.csv`);
                break;
            case 'json':
            default:
                JSONExporter.download(this.analysis_result, `${filename}.json`);
        }
    }

    /**
     * Get formatted summary for UI display
     */
    getSummary() {
        if (!this.analysis_result) return null;

        return {
            title: this.metadata.name,
            sport: this.metadata.sport_type,
            distance: this.analysis_result.distance_total?.toFixed(2),
            duration: this._formatDuration(this.analysis_result.time_total),
            moving_time: this._formatDuration(this.analysis_result.time_moving),
            elevation_gain: this.analysis_result.elevation_gain,
            elevation_loss: this.analysis_result.elevation_loss,
            avg_speed: this.analysis_result.speed_avg?.toFixed(2),
            max_speed: this.analysis_result.speed_max?.toFixed(2),
            avg_hr: this.analysis_result.hr_avg?.toFixed(0),
            max_hr: this.analysis_result.hr_max,
            avg_pace: this.analysis_result.pace_avg,
            avg_power: this.analysis_result.power_avg?.toFixed(0),
            normalized_power: this.analysis_result.power_normalized?.toFixed(0),
            tss: this.analysis_result.tss,
            cadence_avg: this.analysis_result.cadence_avg?.toFixed(0),
            climbs: this.analysis_result.climbs?.length || 0,
            stops: this.analysis_result.stops?.length || 0,
            fatigue_detected: this.analysis_result.fatigue_data?.fatigue_detected,
            fatigue_onset_distance: this.analysis_result.fatigue_data?.fatigue_onset_distance,
            processing_time_ms: this.analysis_result.processing_time_ms,
            insights: this.analysis_result.insights,
            sport_specific: this.analysis_result.sport_analysis
        };
    }

    /**
     * Format duration in readable format
     */
    _formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.round(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m ${secs}s`;
    }

    /**
     * Get detailed climb data
     */
    getClimbDetails() {
        if (!this.analysis_result?.climbs) return [];

        return this.analysis_result.climbs.map(climb => ({
            name: `Climb ${climb.distance.toFixed(1)}km @ ${climb.avg_grade.toFixed(1)}%`,
            distance: climb.distance.toFixed(2),
            elevation_gain: climb.elevation_gain,
            avg_grade: climb.avg_grade.toFixed(1),
            max_grade: climb.max_grade.toFixed(1),
            category: climb.category,
            vam: climb.vam?.toFixed(0),
            duration: this._formatDuration(climb.duration)
        }));
    }

    /**
     * Get detailed segment breakdown
     */
    getSegmentBreakdown() {
        if (!this.analysis_result?.segments) return { distance: [], time: [], terrain: [] };

        return {
            distance: (this.analysis_result.segments.distance_segments || []).map(seg => ({
                name: seg.name,
                distance: seg.distance.toFixed(2),
                avg_speed: seg.avg_speed.toFixed(1),
                avg_hr: seg.avg_heart_rate?.toFixed(0),
                elevation_gain: seg.elevation_gain.toFixed(0)
            })),
            time: (this.analysis_result.segments.time_segments || []).map(seg => ({
                name: seg.name,
                duration: this._formatDuration(seg.duration),
                distance: seg.distance.toFixed(2),
                avg_speed: seg.avg_speed.toFixed(1)
            })),
            terrain: (this.analysis_result.segments.terrain_segments || []).map(seg => ({
                name: seg.name,
                terrain: seg.terrain_type,
                distance: seg.distance.toFixed(2),
                elevation_gain: seg.elevation_gain.toFixed(0),
                avg_grade: seg.avg_grade.toFixed(1)
            }))
        };
    }
}

/**
 * Global instance for use in activity page
 */
export let currentActivityAnalyzer = null;

/**
 * Initialize analyzer for current activity
 */
export async function initializeActivityAnalyzer(activity_id, metadata, streams) {
    currentActivityAnalyzer = new AdvancedActivityAnalyzer(activity_id, metadata, streams);
    return currentActivityAnalyzer;
}
