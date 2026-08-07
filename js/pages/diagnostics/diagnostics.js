function text(document, tag, value, className = '') {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    return element;
}

export function createDiagnosticsPage({
    document,
    diagnostics,
    URL,
    Blob,
    now = () => new Date().toISOString()
}) {
    const elements = {
        blocking: document.getElementById('blocking-error'),
        estimateStatus: document.getElementById('estimate-status'),
        usage: document.getElementById('estimate-usage'),
        quota: document.getElementById('estimate-quota'),
        headroom: document.getElementById('estimate-headroom'),
        percent: document.getElementById('estimate-percent'),
        storageStatus: document.getElementById('error-storage-status'),
        errors: document.getElementById('recent-errors'),
        empty: document.getElementById('empty-errors'),
        importPerformance: document.getElementById('import-performance-records'),
        emptyImportPerformance: document.getElementById('empty-import-performance'),
        importPerformanceStatus: document.getElementById('import-performance-status'),
        refresh: document.getElementById('refresh-diagnostics'),
        export: document.getElementById('export-diagnostics'),
        status: document.getElementById('diagnostics-status')
    };
    let currentEstimate = null;
    let currentErrors = Object.freeze([]);
    let currentImportPerformance = Object.freeze([]);

    function renderEstimate(estimate) {
        currentEstimate = estimate;
        elements.estimateStatus.textContent = estimate.status === 'available'
            ? estimate.scopeLabel
            : estimate.status === 'unsupported'
                ? 'Estimate unsupported'
                : 'Estimate unavailable';
        elements.usage.textContent = estimate.usageValue;
        elements.quota.textContent = estimate.quotaValue;
        elements.headroom.textContent = estimate.headroomValue;
        elements.percent.textContent = estimate.percentUsed;
    }

    function renderImportPerformance(records) {
        currentImportPerformance = records;
        elements.importPerformanceStatus.textContent = `${records.length} of 50 retained`;
        elements.importPerformance.replaceChildren();
        elements.emptyImportPerformance.hidden = records.length > 0;
        for (const record of records) {
            const item = text(document, 'li', '', 'report-card');
            item.append(
                text(document, 'strong', `${record.outcome} · ${record.artifactCount} artifacts`),
                text(
                    document,
                    'p',
                    `${Math.round(record.totalMilliseconds)} ms · peak Worker requests ${record.peakWorkerRequests}`
                )
            );
            elements.importPerformance.append(item);
        }
    }

    function renderErrors(state) {
        currentErrors = state.records;
        elements.storageStatus.textContent = state.status === 'available'
            ? `${state.records.length} of 20 retained`
            : `${state.records.length} of 20 retained · memory fallback`;
        elements.errors.replaceChildren();
        elements.empty.hidden = state.records.length > 0;
        for (const record of state.records) {
            const item = text(document, 'li', '', 'report-card');
            item.append(
                text(document, 'strong', `${record.category} · ${record.code}`),
                text(document, 'p', `${record.page} · ${record.occurredAt} · count ${record.count}`)
            );
            elements.errors.append(item);
        }
    }

    async function refresh() {
        elements.refresh.disabled = true;
        elements.status.textContent = 'Refreshing diagnostics…';
        try {
            const [estimate, errors, importPerformance] = await Promise.all([
                diagnostics.estimateStorage(),
                Promise.resolve(diagnostics.readErrors()),
                Promise.resolve(diagnostics.readImportPerformance())
            ]);
            renderEstimate(estimate);
            renderErrors(errors);
            renderImportPerformance(importPerformance);
            elements.status.textContent = 'Diagnostics refreshed.';
        } finally {
            elements.refresh.disabled = false;
        }
    }

    function exportSnapshot() {
        try {
            const result = diagnostics.createExport({
                createdAt: now(),
                storageEstimate: currentEstimate,
                recentErrors: currentErrors,
                importPerformance: currentImportPerformance
            });
            const blob = new Blob([result.json], { type: result.mimeType });
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = result.filename;
            anchor.hidden = true;
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(objectUrl);
            elements.status.textContent = `Diagnostics exported · ${result.byteLength} bytes.`;
        } catch {
            elements.status.textContent = 'Diagnostics export could not be created safely.';
        }
    }

    elements.refresh.addEventListener('click', () => { void refresh(); });
    elements.export.addEventListener('click', exportSnapshot);

    return Object.freeze({
        async initialize() {
            await refresh();
            return Object.freeze({ status: 'ready' });
        },
        showBlockingError() {
            elements.blocking.hidden = false;
            elements.refresh.disabled = true;
            elements.export.disabled = true;
            elements.status.textContent = 'Diagnostics are unavailable.';
        }
    });
}
