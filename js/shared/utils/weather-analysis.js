import { formatSpeedBike } from './core.js';
import {
    WEATHER_CONSENT_COPY,
    canRequestHistoricalWeather,
    grantWeatherConsent,
    isWeatherConsentGranted,
    requestHistoricalWeather,
    revokeWeatherConsent
} from '../../app/weather-consent.js';

function weatherCodeToMeta(code) {
    const map = {
        0: { text: 'Clear', icon: '☀️' },
        1: { text: 'Mostly clear', icon: '🌤️' },
        2: { text: 'Partly cloudy', icon: '⛅' },
        3: { text: 'Overcast', icon: '☁️' },
        45: { text: 'Fog', icon: '🌫️' },
        48: { text: 'Fog', icon: '🌫️' },
        51: { text: 'Drizzle', icon: '🌦️' },
        53: { text: 'Drizzle', icon: '🌦️' },
        55: { text: 'Drizzle', icon: '🌦️' },
        61: { text: 'Rain', icon: '🌧️' },
        63: { text: 'Rain', icon: '🌧️' },
        65: { text: 'Rain', icon: '🌧️' },
        71: { text: 'Snow', icon: '🌨️' },
        73: { text: 'Snow', icon: '🌨️' },
        75: { text: 'Snow', icon: '🌨️' },
        80: { text: 'Showers', icon: '🌦️' },
        81: { text: 'Showers', icon: '🌦️' },
        82: { text: 'Showers', icon: '⛈️' },
        95: { text: 'Thunderstorm', icon: '⛈️' },
        96: { text: 'Thunderstorm', icon: '⛈️' },
        99: { text: 'Thunderstorm', icon: '⛈️' }
    };
    return Number.isFinite(code)
        ? map[code] || { text: `Code ${code}`, icon: '🌡️' }
        : { text: 'N/A', icon: '🌡️' };
}

function validCoordinate(value) {
    try {
        if (!Array.isArray(value) || value.length < 2) return null;
        const latitude = value[0];
        const longitude = value[1];
        if (
            typeof latitude !== 'number'
            || typeof longitude !== 'number'
            || !Number.isFinite(latitude)
            || !Number.isFinite(longitude)
            || latitude < -90 || latitude > 90
            || longitude < -180 || longitude > 180
        ) return null;
        return [latitude, longitude];
    } catch {
        return null;
    }
}

function firstCoordinate(activity, coords) {
    try {
        if (Array.isArray(coords)) {
            for (const coordinate of coords) {
                const valid = validCoordinate(coordinate);
                if (valid) return valid;
            }
        }
        return validCoordinate(activity?.start_latlng);
    } catch {
        return null;
    }
}

function requestInput(activity, coords) {
    try {
        const input = {
            coordinate: firstCoordinate(activity, coords),
            startDateLocal: activity?.start_date_local
        };
        return canRequestHistoricalWeather(input) ? input : null;
    } catch {
        return null;
    }
}

function consentMarkup() {
    return `
        <div class="weather-consent" role="group" aria-label="External weather permission">
            <h3>Historical weather permission</h3>
            <p>${WEATHER_CONSENT_COPY}</p>
            <div class="weather-consent__actions">
                <button type="button" data-weather-consent-allow>Allow for this tab</button>
                <button type="button" data-weather-consent-deny>Not now</button>
            </div>
            <p class="weather-consent__status" role="status" aria-live="polite"></p>
        </div>
    `;
}

function revokeMarkup() {
    return '<button type="button" data-weather-consent-revoke>Revoke weather access</button>';
}

function bindRevoke(body, rerender) {
    const button = body.querySelector?.('[data-weather-consent-revoke]');
    button?.addEventListener('click', () => {
        revokeWeatherConsent();
        void rerender();
    }, { once: true });
}

function renderConsent(body, rerender) {
    body.innerHTML = consentMarkup();
    const allow = body.querySelector?.('[data-weather-consent-allow]');
    const deny = body.querySelector?.('[data-weather-consent-deny]');
    const status = body.querySelector?.('.weather-consent__status');
    allow?.addEventListener('click', () => {
        if (grantWeatherConsent()) {
            void rerender();
        } else if (status) {
            status.textContent = 'Weather access remains unavailable in this tab.';
        }
    }, { once: true });
    deny?.addEventListener('click', () => {
        if (status) status.textContent = 'Weather access was not granted.';
    });
}

function valueText(value, digits, suffix) {
    return Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : 'N/A';
}

function createWeatherMarkerHtml(weather) {
    const meta = weatherCodeToMeta(weather.weather_code);
    const windArrow = Number.isFinite(weather.wind_direction)
        ? `<div class="weather-map-marker__wind-arrow" style="transform: rotate(${(weather.wind_direction + 180) % 360}deg)">➤</div>`
        : '';
    const windColor = Number.isFinite(weather.wind_speed) && weather.wind_speed > 0
        ? weather.wind_speed < 8 ? '#22c55e'
            : weather.wind_speed < 16 ? '#84cc16'
                : weather.wind_speed < 24 ? '#f59e0b'
                    : weather.wind_speed < 32 ? '#f97316' : '#ef4444'
        : '#94a3b8';
    return `
        <div class="weather-map-marker" title="${meta.text}" style="--wind-color: ${windColor};">
            ${windArrow}
            <div class="weather-map-marker__body">
                <span class="weather-map-marker__icon">${meta.icon}</span>
                <span class="weather-map-marker__temp">${valueText(weather.temperature, 0, '°')}</span>
            </div>
        </div>
    `;
}

function renderSummary(body, weather) {
    const meta = weatherCodeToMeta(weather.weather_code);
    body.innerHTML = `
        <div class="weather-consent__active">${revokeMarkup()}</div>
        <div class="weather-summary-grid">
            <div class="weather-summary-card"><span>🌡️ Temperature</span><strong>${valueText(weather.temperature, 1, '°C')}</strong></div>
            <div class="weather-summary-card"><span>💨 Wind</span><strong>${valueText(weather.wind_speed, 1, ' km/h')}</strong></div>
            <div class="weather-summary-card"><span>🌧️ Rain</span><strong>${valueText(weather.precipitation, 1, ' mm')}</strong></div>
            <div class="weather-summary-card"><span>☁️ Condition</span><strong>${meta.text}</strong></div>
            <div class="weather-summary-card"><span>💧 Humidity</span><strong>${valueText(weather.humidity, 1, '%')}</strong></div>
            <div class="weather-summary-card"><span>🧭 Pressure</span><strong>${valueText(weather.pressure, 1, ' hPa')}</strong></div>
        </div>
        <p class="weather-summary-note">Route-level weather and wind panels are unavailable because only one approximate start point is shared.</p>
    `;
}

export async function renderWeatherAnalysis(activity, coords) {
    const section = document.getElementById('weather-analysis-section');
    if (!section) return;
    const body = section.querySelector('.weather-analysis__body');
    if (!body) return;
    const rerender = () => renderWeatherAnalysis(activity, coords);

    try {
        const input = requestInput(activity, coords);
        section.classList.remove('hidden');
        if (input === null) {
            body.innerHTML = '<p class="empty-state">Weather is unavailable for this activity.</p>';
            return;
        }
        if (!isWeatherConsentGranted()) {
            renderConsent(body, rerender);
            return;
        }

        body.innerHTML = `
            <div class="weather-consent__active">${revokeMarkup()}</div>
            <p class="empty-state">Loading weather analysis...</p>
        `;
        bindRevoke(body, rerender);
        const weather = await requestHistoricalWeather(input);
        if (!isWeatherConsentGranted()) {
            renderConsent(body, rerender);
            return;
        }
        if (weather === null) {
            body.innerHTML = `
                <div class="weather-consent__active">${revokeMarkup()}</div>
                <p class="empty-state">Weather data is unavailable.</p>
            `;
            bindRevoke(body, rerender);
            return;
        }
        renderSummary(body, weather);
        bindRevoke(body, rerender);
    } catch {
        section.classList.remove('hidden');
        body.innerHTML = '<p class="empty-state">Weather analysis could not be loaded.</p>';
    }
}

export async function renderWeatherMapDetails(activity, coords, map, enabled) {
    if (!map) return;
    if (map._weatherDetailsLayer) {
        map._weatherDetailsLayer.remove();
        map._weatherDetailsLayer = null;
    }
    if (!enabled || !isWeatherConsentGranted()) return;

    try {
        const input = requestInput(activity, coords);
        if (input === null) return;
        const weather = await requestHistoricalWeather(input);
        if (weather === null || !isWeatherConsentGranted() || !window.L) return;
        const coordinate = input.coordinate;
        const layer = L.layerGroup().addTo(map);
        map._weatherDetailsLayer = layer;
        const marker = L.marker(coordinate, {
            icon: L.divIcon({
                className: 'weather-map-divicon',
                html: createWeatherMarkerHtml(weather),
                iconSize: [54, 54],
                iconAnchor: [27, 27]
            })
        });
        const meta = weatherCodeToMeta(weather.weather_code);
        marker.bindPopup(`
            <div class="weather-popup">
                <strong>${meta.icon} ${meta.text}</strong><br>
                <span>🌡️ ${valueText(weather.temperature, 1, '°C')}</span><br>
                <span>💨 ${Number.isFinite(weather.wind_speed) ? formatSpeedBike(weather.wind_speed) : 'N/A'}</span><br>
                <span>🌧️ ${valueText(weather.precipitation, 1, ' mm')}</span>
            </div>
        `);
        marker.addTo(layer);
    } catch {
        // Weather markers are optional and never affect the local detail page.
    }
}
