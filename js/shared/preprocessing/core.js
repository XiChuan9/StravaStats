// js/preprocessing.js
import { rollingMean } from '../utils/index.js';

// ===================================================================
// CONFIGURACIÓN
// ===================================================================
const SUFFER_TO_TSS = 1;
const MAX_HR_DEFAULT = 190;

// ===================================================================
// Pool length estimation for all swim activities
// ===================================================================
const STANDARD_POOL_LENGTHS = [20, 25, 50];

function estimatePoolLengths(activities) {
    const swims = activities.filter(a => {
        const t = (a.sport_type || a.type || '').toLowerCase();
        return t.includes('swim') && !t.includes('openwater');
    });
    if (!swims.length) return;

    // Build historical frequency of which pool lengths appear
    const historicalCounts = { 20: 0, 25: 0, 50: 0 };
    swims.forEach(a => {
        if (a.pool_length) { historicalCounts[a.pool_length] = (historicalCounts[a.pool_length] || 0) + 1; return; }
        if (!a.distance) return;
        const candidates = STANDARD_POOL_LENGTHS.filter(p => a.distance % p === 0);
        if (candidates.length === 1) historicalCounts[candidates[0]]++;
    });

    // Assign pool_length to swims that don't have it yet
    swims.forEach(a => {
        if (a.pool_length) return; // Already set (e.g. by 20m correction)
        if (!a.distance || !a.moving_time) return;

        const candidates = STANDARD_POOL_LENGTHS.filter(p => {
            if (a.distance % p !== 0) return false;
            const lengths = a.distance / p;
            const timePerLength = a.moving_time / lengths;
            // Realistic time per length: 15-120 seconds
            return timePerLength >= 15 && timePerLength <= 120;
        });

        if (candidates.length === 1) {
            a.pool_length = candidates[0];
        } else if (candidates.length > 1) {
            // Use historical frequency to pick most likely
            candidates.sort((x, y) => (historicalCounts[y] || 0) - (historicalCounts[x] || 0));
            a.pool_length = candidates[0];
        }
    });
}

// ===================================================================
// 1. TSS: hrTSS = (minutes/60) × (avgHR/maxHR)² × 100 × sportMultiplier
// ===================================================================
//
// Sport hardness per minute at a given HR (from hardest to easiest):
//  1. HIIT           1.20  – extreme metabolic disruption, eccentric damage
//  2. Trail Running  1.12  – running + elevation + technical terrain
//  3. Running        1.08  – weight-bearing, high impact
//  4. Soccer         1.05  – running + agility + direction changes
//  5. Hiking         0.95  – weight-bearing sustained, elevation
//  6. Cycling/Ride   0.90  – non-weight-bearing, mechanically efficient
//  7. Gravel/MTB     0.92  – cycling + vibration + technical
//  8. Workout (gen)  0.78  – mixed moderate
//  9. Weight Train.  0.72  – intermittent, lots of recovery between sets
// 10. Swimming       0.65  – no impact, HR suppressed in water
// 11. Alpine Ski     0.62  – lots of lift time, intermittent
// 12. Walking        0.52  – low impact
// 13. Yoga           0.35  – minimal metabolic stress
//
const SPORT_TSS_MULTIPLIER = {
    // Runs
    Run: 1.07,
    VirtualRun: 1.05,
    TrailRun: 1.15,
    // Cycling
    Ride: 0.78,
    VirtualRide: 0.66,
    GravelRide: 0.80,
    MountainBikeRide: 0.85,
    EBikeRide: 0.71,
    // Water
    Swim: 0.75,
    PoolSwim: 0.75,
    OpenWaterSwim: 2.0, // Open water rule: final TSS multiplier ×2
    // Team/field
    Soccer: 1.05,
    // Hiking & walking
    Hike: 0.93,
    Walk: 0.52,
    // Gym & fitness
    WeightTraining: 0.73,
    Workout: 0.78,
    HIIT: 1.15,
    Crossfit: 1.10,
    Yoga: 0.35,
    // Winter
    AlpineSki: 0.62,
    NordicSki: 0.80,
    Snowboard: 0.58,
    // Other
    Rowing: 0.82,
    Kayaking: 0.70,
    IceSkate: 0.65,
};

function getSportMultiplier(activity) {
    const sportType = activity.sport_type || activity.type || '';
    return SPORT_TSS_MULTIPLIER[sportType] ?? 0.80;
}

// Zone-weighted intensity factor using athlete's actual HR zones from Strava.
// Each zone gets a physiological weight that reflects the exponential cost of
// training at higher %maxHR.  If the athlete's average HR sits inside zone N,
// the weight for that zone is used as the squared-IF equivalent.
//
// Strava zones format: [{min, max}, ...] (5 zones, zone 5 max = -1 meaning ∞)
//
// Zone weights (loosely mapped to TRIMP zone factors):
//   Z1  0.40   Recovery / very easy
//   Z2  0.55   Endurance / aerobic
//   Z3  0.72   Tempo
//   Z4  0.88   Threshold
//   Z5  1.05   VO2max / anaerobic
const ZONE_WEIGHTS = [0.40, 0.55, 0.72, 0.88, 1.05];

function hrZoneIntensity(avgHR, hrZones) {
    if (!hrZones || !hrZones.length || !avgHR) return null;

    for (let i = 0; i < hrZones.length; i++) {
        const zoneMax = hrZones[i].max === -1 ? Infinity : hrZones[i].max;
        if (avgHR >= hrZones[i].min && avgHR < zoneMax) {
            const weight = ZONE_WEIGHTS[i] ?? ZONE_WEIGHTS[ZONE_WEIGHTS.length - 1];
            // Interpolate within the zone for finer resolution
            const zoneRange = (zoneMax === Infinity) ? 20 : (zoneMax - hrZones[i].min);
            const posInZone = zoneRange > 0 ? (avgHR - hrZones[i].min) / zoneRange : 0.5;
            const nextWeight = ZONE_WEIGHTS[Math.min(i + 1, ZONE_WEIGHTS.length - 1)];
            return weight + posInZone * (nextWeight - weight);
        }
    }
    // Above all zones → cap at Z5 weight
    return ZONE_WEIGHTS[ZONE_WEIGHTS.length - 1];
}

function setTssEstimateMetadata(activity, contextStatus, method) {
    if (contextStatus === 'legacy') return;

    activity.tss_profile_status = contextStatus;
    activity.tss_estimate_scope = (
        contextStatus === 'configured'
        && (method === 'heartrate' || method === 'heartrate_zones')
    ) ? 'personalized' : 'general';
}

function calculateTSS(
    activity,
    maxHr = MAX_HR_DEFAULT,
    hrZones = null,
    { heartRateEnabled = true, contextStatus = 'legacy' } = {}
) {
    const minutes = (activity.moving_time || 0) / 60;
    if (minutes <= 0) {
        activity.tss = 0;
        activity.tss_method = 'none';
        setTssEstimateMetadata(activity, contextStatus, 'none');
        return 0;
    }

    const hours = minutes / 60;
    const sportMult = getSportMultiplier(activity);
    let tss = 0;
    let method = 'none';

    // --- Primary: power-based (NP if available) ---
    if (activity.average_watts > 0 && activity.ftp > 0) {
        const IF = activity.average_watts / activity.ftp;
        tss = hours * IF * IF * 100 * sportMult;
        method = 'power';
    }

    // --- Secondary: HR-based using athlete zones when available ---
    if (heartRateEnabled && method === 'none' && activity.average_heartrate > 0) {
        const zoneIF = hrZoneIntensity(activity.average_heartrate, hrZones);
        if (zoneIF !== null) {
            // Zone-weighted: the zoneIF already represents an IF²-equivalent
            tss = hours * zoneIF * 100 * sportMult;
            method = 'heartrate_zones';
        } else {
            // Fallback: simple ratio² against maxHR
            const hrRatio = activity.average_heartrate / maxHr;
            tss = hours * hrRatio * hrRatio * 100 * sportMult;
            method = 'heartrate';
        }
    }

    // --- Tertiary: suffer_score ---
    if (method === 'none' && activity.suffer_score > 0) {
        tss = activity.suffer_score * SUFFER_TO_TSS * sportMult;
        method = 'suffer_score';
    }

    // --- Last resort: time-only estimate ---
    if (method === 'none') {
        tss = hours * 36 * sportMult;
        method = 'time';
    }

    // Long low-intensity correction: taper down beyond 4 h at low IF
    if (heartRateEnabled && hours > 4 && activity.average_heartrate > 0) {
        const hrRatio = activity.average_heartrate / maxHr;
        if (hrRatio < 0.7) {
            tss *= Math.max(0.7, 1 - 0.05 * (hours - 4));
        }
    }

    if (isNaN(tss)) tss = 0;
    activity.tss = +tss.toFixed(2);
    activity.tss_method = method;
    setTssEstimateMetadata(activity, contextStatus, method);
    return activity.tss;
}

// ===================================================================
// 2. VO₂max: solo running (ACSM + HR)
// ===================================================================
function computeVO2max(
    activity,
    maxHr = MAX_HR_DEFAULT,
    { requireHeartRate = false, contextStatus = 'legacy' } = {}
) {
    if (activity.type !== 'Run' || !activity.distance || activity.moving_time < 600) {
        activity.vo2max = null;
        return;
    }

    if (contextStatus === 'unconfigured' || (requireHeartRate && !(activity.average_heartrate > 0))) {
        activity.vo2max = null;
        activity.vo2max_profile_status = contextStatus;
        activity.vo2max_estimate_scope = 'unavailable';
        return;
    }

    const speedMperMin = (activity.distance / activity.moving_time) * 60;
    const vo2 = -4.60 + 0.182258 * speedMperMin + 0.000104 * speedMperMin ** 2;
    const hrFraction = activity.average_heartrate ? activity.average_heartrate / maxHr : 0.8;
    const vo2max = vo2 / hrFraction;

    activity.vo2max = (vo2max > 25 && vo2max < 90) ? +vo2max.toFixed(2) : null;
    if (contextStatus !== 'legacy') {
        activity.vo2max_profile_status = contextStatus;
        activity.vo2max_estimate_scope = activity.vo2max === null ? 'unavailable' : 'personalized';
    }
}

// ===================================================================
// 3. Group by day without external enrichment
// ===================================================================
async function groupByDay(activities, heartRateConfig) {
    const daily = {};

    activities.forEach(a => {
        const date = a.start_date_local?.split('T')[0];
        if (!date) return;

        if (heartRateConfig.contextStatus === 'legacy') {
            computeVO2max(a);
        } else {
            computeVO2max(a, heartRateConfig.maxHr, {
                requireHeartRate: true,
                contextStatus: heartRateConfig.contextStatus
            });
        }

        if (!daily[date]) {
            daily[date] = { tss: 0, count: 0 };
        }
        daily[date].tss += a.tss;
        daily[date].count += 1;
    });

    return daily;
}

// ===================================================================
// 4. Serie temporal
// ===================================================================
function getTimeSeries(daily) {
    const dates = Object.keys(daily).sort();
    const tssValues = dates.map(d => daily[d].tss);
    return { dates, tssValues };
}

// ===================================================================
// 5. PMC: ATL (7d), CTL (42d), TSB, Ramp Rate
// ===================================================================
function calculatePMC(tssSeries) {
    const atl = rollingMean(tssSeries, 7);
    const ctl = rollingMean(tssSeries, 42);
    const tsb = [];
    const rampRate = [0];

    for (let i = 0; i < tssSeries.length; i++) {
        const a = atl[i];
        const c = ctl[i];
        // Canonical TSB sign: form = CTL - ATL (negative means fatigue, positive means freshness)
        tsb.push(+(c - a).toFixed(1));

        if (i > 0) {
            rampRate.push(+(c - ctl[i - 1]).toFixed(1));
        }
    }

    return { atl, ctl, tsb, rampRate, tssSeries };
}

// ===================================================================
// 6. INJURY RISK (adaptive percentile-based)
// ===================================================================
function calculateInjuryRiskImproved(tsb, rampRate, atl, tssSeries) {
    const riskHistory = [];
    const len = tsb.length;

    // Helper: percentil relativo al historial
    const percentile = (arr, val) => {
        const filtered = arr.filter(x => !isNaN(x));
        if (!filtered.length) return 0.5;
        const sorted = filtered.sort((a, b) => a - b);
        let count = 0;
        for (const x of sorted) if (x <= val) count++;
        return count / sorted.length;
    }

    for (let i = 0; i < len; i++) {
        // --- 1. TSB relativo (fatiga) ---
        const tsbWindow = tsb.slice(Math.max(0, i - 42), i + 1);
        const tsbPerc = 1 - percentile(tsbWindow, tsb[i]); // más negativo → más riesgo
        let risk = 0.6 * Math.pow(tsbPerc, 1.5); // efecto no lineal

        // --- 2. Ramp Rate relativo ---
        const rrWindow = rampRate.slice(Math.max(0, i - 14), i + 1);
        const rrPerc = percentile(rrWindow, rampRate[i]);
        risk += 0.25 * Math.pow(rrPerc, 1.3) * tsbPerc; // interacción: ramp fuerte + fatiga

        // --- 3. ATL relativo (carga aguda) ---
        const atlWindow = atl.slice(Math.max(0, i - 7), i + 1);
        const atlPerc = percentile(atlWindow, atl[i]);
        risk += 0.15 * Math.pow(atlPerc, 1.2);

        // --- 4. Variabilidad reciente ---
        const recent = tssSeries.slice(Math.max(0, i - 6), i + 1);
        if (recent.length > 1) {
            const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
            if (!isNaN(mean) && mean > 0) {
                const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
                const cv = Math.sqrt(variance) / mean;
                risk *= 1 + Math.min(cv, 1) * 0.3; // hasta +30% si CV alto
            }
        }

        // --- Normalizar a [0,1] ---
        risk = Math.min(Math.max(risk, 0), 1);

        // --- Suavizado EWMA adaptativo ---
        if (i > 0) {
            const prev = riskHistory[i - 1];
            const alpha = 0.2 + 0.5 * Math.min(1, Math.abs(risk - prev));
            risk = prev * (1 - alpha) + risk * alpha;
        }

        if (isNaN(risk)) risk = 0;
        riskHistory.push(+risk.toFixed(3));
    }

    return riskHistory;
}

// ===================================================================
// 6b. RECOVERY HOURS (based on TSS, sport factor, HR zone, duration, TSB)
// ===================================================================
const RECOVERY_SPORT_FACTORS = {
    Run: 1.2,
    TrailRun: 1.5,
    Ride: 0.9,
    MountainBikeRide: 1.1,
    Swim: 0.7,
    WeightTraining: 1.0,
    Soccer: 1.1,
    Padel: 0.8,
    AlpineSki: 0.8,
    Hike: 0.7,
    Rowing: 1.0,
    Walk: 0.4,
    Workout: 0.8,
    VirtualRun: 1.1,
    VirtualRide: 0.85,
    GravelRide: 0.95,
    EBikeRide: 0.75,
};

const RECOVERY_HR_ZONE_MULTIPLIERS = {
    1: 0.60, // Z1: recovery
    2: 0.85, // Z2: aerobic easy
    3: 1.00, // Z3: aerobic base
    4: 1.25, // Z4: threshold
    5: 1.50, // Z5: max effort
};

function getRecoverySportFactor(activity) {
    const sport = activity.sport_type || activity.type || 'Run';
    return RECOVERY_SPORT_FACTORS[sport] ?? 1.0;
}

function getRecoveryHrZone(avgHr, maxHr, hrZones = null) {
    if (!avgHr || !maxHr || avgHr <= 0 || maxHr <= 0) return 3; // default Z3
    if (Array.isArray(hrZones) && hrZones.length > 0) {
        const index = hrZones.findIndex(zone => {
            const zoneMax = zone.max === -1 ? Infinity : zone.max;
            return avgHr >= zone.min && avgHr < zoneMax;
        });
        if (index >= 0) return Math.min(index + 1, 5);
    }
    const pct = avgHr / maxHr;
    if (pct < 0.60) return 1;
    if (pct < 0.70) return 2;
    if (pct < 0.80) return 3;
    if (pct < 0.90) return 4;
    return 5;
}

function calculateRecoveryHours(
    activity,
    maxHr = MAX_HR_DEFAULT,
    hrZones = null,
    { heartRateEnabled = true } = {}
) {
    if (!activity) return 4;

    const tss = activity.tss || 30; // fallback
    const durHours = (activity.moving_time || 3600) / 3600;
    const avgHr = activity.average_heartrate;
    const tsb = activity.tsb ?? null;

    const sf = getRecoverySportFactor(activity);
    const zone = heartRateEnabled ? getRecoveryHrZone(avgHr, maxHr, hrZones) : null;
    const hm = zone === null ? 1 : RECOVERY_HR_ZONE_MULTIPLIERS[zone];
    const df = Math.sqrt(durHours);

    let raw = (tss * sf * hm * df) / 10;

    // Ajuste por TSB acumulado
    if (typeof tsb === 'number' && !isNaN(tsb)) {
        if (tsb <= -20) raw += 24;
        else if (tsb <= -10) raw += 12;
    }

    return Math.round(Math.min(Math.max(raw, 4), 96));
}

function calculateDailyRecovery(activitiesArray, heartRateConfig) {
    if (!activitiesArray || !activitiesArray.length) return 0;
    if (heartRateConfig.contextStatus === 'legacy') {
        if (activitiesArray.length === 1) return calculateRecoveryHours(activitiesArray[0]);

        const legacyHours = activitiesArray.map(a => calculateRecoveryHours(a));
        const legacyMax = Math.max(...legacyHours);
        const legacyRest = legacyHours.filter(hours => hours !== legacyMax);
        const legacyCombined = legacyMax * 0.7 + (
            legacyRest.length > 0
                ? legacyRest.reduce((sum, hours) => sum + hours, 0) * 0.3
                : 0
        );
        const legacyPenalty = 1.0 + (legacyHours.length - 1) * 0.12;
        return Math.round(Math.min(legacyCombined * legacyPenalty, 96));
    }

    const options = {
        heartRateEnabled: heartRateConfig.contextStatus !== 'unconfigured'
    };
    if (activitiesArray.length === 1) {
        return calculateRecoveryHours(
            activitiesArray[0],
            heartRateConfig.maxHr,
            heartRateConfig.hrZones,
            options
        );
    }

    const hours = activitiesArray.map(a => calculateRecoveryHours(
        a,
        heartRateConfig.maxHr,
        heartRateConfig.hrZones,
        options
    ));
    const maxH = Math.max(...hours);
    const rest = hours.filter(h => h !== maxH);
    const combined = maxH * 0.7 + (rest.length > 0 ? rest.reduce((s, h) => s + h, 0) * 0.3 : 0);
    const penalty = 1.0 + (hours.length - 1) * 0.12;
    return Math.round(Math.min(combined * penalty, 96));
}

function calculateRecoveryHoursSeries(activities, dates, heartRateConfig) {
    const dailyMap = {};

    // Initialize daily buckets
    dates.forEach(date => {
        dailyMap[date] = [];
    });

    // Group activities by date
    activities.forEach(a => {
        const date = a.start_date_local?.split('T')[0];
        if (date && dailyMap[date]) {
            dailyMap[date].push(a);
        }
    });

    // Calculate daily recovery for each date
    const recoveryHours = dates.map(date => {
        return calculateDailyRecovery(dailyMap[date], heartRateConfig);
    });

    return recoveryHours;
}

// ===================================================================
// 7. Asignar métricas
// ===================================================================
function getSportCategory(activity) {
    const sportType = activity.sport_type || activity.type || '';
    if (/Run/i.test(sportType)) return 'run';
    if (/Swim/i.test(sportType)) return 'swim';
    if (/Ride|Bike|Cycling/i.test(sportType)) return 'bike';
    return null;
}

function computeEfficiencyFields(activity) {
    const distance = Number(activity.distance) || 0;
    const movingTime = Number(activity.moving_time) || 0;
    const avgHr = Number(activity.average_heartrate) || 0;

    if (!avgHr || distance <= 0 || movingTime <= 0) {
        return { efficiency: null, method: null };
    }

    const category = getSportCategory(activity);
    if (category === 'run') {
        const paceMinPerKm = (movingTime / 60) / (distance / 1000);
        return { efficiency: paceMinPerKm / avgHr, method: 'pace_per_hr' };
    }
    if (category === 'swim') {
        const paceMinPer100m = (movingTime / 60) / (distance / 100);
        return { efficiency: paceMinPer100m / avgHr, method: 'pace100m_per_hr' };
    }
    if (category === 'bike') {
        const avgSpeedKmh = (distance / 1000) / (movingTime / 3600);
        return { efficiency: avgSpeedKmh / avgHr, method: 'speed_per_hr' };
    }
    return { efficiency: null, method: null };
}

function assignMetrics(activities, dates, pmc, injuryRisk, recoveryHours, heartRateConfig) {
    const map = Object.fromEntries(dates.map((d, i) => [d, i]));

    activities.forEach(a => {
        const date = a.start_date_local?.split('T')[0];
        const i = map[date];
        if (i !== undefined) {
            a.atl = +pmc.atl[i].toFixed(1);
            a.ctl = +pmc.ctl[i].toFixed(1);
            a.tsb = +pmc.tsb[i].toFixed(1);
            a.injuryRisk = +injuryRisk[i].toFixed(3); // 3 decimales para precisión
            a.recovery_hours = recoveryHours[i] ?? 4;
            if (heartRateConfig.contextStatus !== 'legacy') {
                a.recovery_profile_status = heartRateConfig.contextStatus;
                a.recovery_estimate_scope = (
                    heartRateConfig.contextStatus === 'configured'
                    && a.average_heartrate > 0
                ) ? 'personalized' : 'general';
            }
        } else {
            a.atl = a.ctl = a.tsb = a.injuryRisk = a.recovery_hours = null;
        }

        const elapsed = Number(a.elapsed_time) || 0;
        const moving = Number(a.moving_time) || 0;
        a.moving_ratio = elapsed > 0 ? moving / elapsed : null;

        const { efficiency, method } = computeEfficiencyFields(a);
        a.efficiency = efficiency;
        a.efficiency_method = method;
    });
}

function projectContextHeartRateZones(zones) {
    if (!Array.isArray(zones) || zones.length !== 5) return null;

    const projected = zones.map(zone => ({
        min: zone?.minBpm,
        max: zone?.maxBpmExclusive === null ? -1 : zone?.maxBpmExclusive
    }));
    const valid = projected.every((zone, index) => (
        Number.isInteger(zone.min)
        && zone.min >= 1
        && (zone.max === -1 || (Number.isInteger(zone.max) && zone.max > zone.min))
        && (index === 0
            ? zone.min === 1
            : zone.min === projected[index - 1].max)
        && (index < projected.length - 1 || zone.max === -1)
    ));
    return valid ? projected : null;
}

function resolveHeartRateConfig(userProfile, zones, analysisContext) {
    if (analysisContext === undefined) {
        // Legacy behavior is deliberately unchanged when no V2 context is supplied.
        let maxHr = MAX_HR_DEFAULT;
        let hrZones = null;

        if (zones?.heart_rate?.zones) {
            hrZones = zones.heart_rate.zones;
            const lastZoneMax = hrZones[hrZones.length - 1]?.max;
            if (lastZoneMax && lastZoneMax > 0 && lastZoneMax !== -1) {
                maxHr = lastZoneMax;
            }
        }
        if (userProfile.max_hr) maxHr = userProfile.max_hr;

        return { contextStatus: 'legacy', maxHr, hrZones };
    }

    const maxHr = analysisContext?.heartRate?.maxBpm;
    const hrZones = projectContextHeartRateZones(analysisContext?.heartRate?.zones);
    if (
        analysisContext?.status === 'configured'
        && Number.isInteger(maxHr)
        && maxHr >= 100
        && maxHr <= 230
        && hrZones
        && hrZones.every(zone => (
            zone.min <= maxHr
            && (zone.max === -1 || zone.max <= maxHr)
        ))
    ) {
        return { contextStatus: 'configured', maxHr, hrZones };
    }

    // Explicit but absent/malformed context is fail-closed for Canonical data.
    return { contextStatus: 'unconfigured', maxHr: null, hrZones: null };
}

// ===================================================================
// 8. Pipeline principal
// ===================================================================
export async function preprocessActivities(
    activities,
    userProfile = {},
    zones = null,
    gears = null,
    analysisContext = undefined
) {
    if (!activities?.length) return [];
    estimatePoolLengths(activities);

    const heartRateConfig = resolveHeartRateConfig(userProfile, zones, analysisContext);

    activities.forEach(a => calculateTSS(
        a,
        heartRateConfig.maxHr,
        heartRateConfig.hrZones,
        {
            heartRateEnabled: heartRateConfig.contextStatus !== 'unconfigured',
            contextStatus: heartRateConfig.contextStatus
        }
    ));

    const daily = await groupByDay(activities, heartRateConfig);
    const { dates, tssValues } = getTimeSeries(daily);
    const pmc = calculatePMC(tssValues);
    const injuryRisk = calculateInjuryRiskImproved(pmc.tsb, pmc.rampRate, pmc.atl, pmc.tssSeries);
    const recoveryHours = calculateRecoveryHoursSeries(activities, dates, heartRateConfig);

    assignMetrics(activities, dates, pmc, injuryRisk, recoveryHours, heartRateConfig);

    return activities;
}
