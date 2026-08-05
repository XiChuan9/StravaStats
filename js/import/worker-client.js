import { IMPORT_ERROR_CODE, importError } from './errors.js';
import { processSyntheticImport } from './synthetic-import-worker.js';
import { findDataMethod } from './safe-data.js';

export function createInlineImportWorker() {
    let closed = false;
    return Object.freeze({
        async process(input) {
            if (closed) throw importError(IMPORT_ERROR_CODE.WORKER_CRASHED, true, 'decode');
            return processSyntheticImport(input);
        },
        close() {
            closed = true;
        }
    });
}

export function createBrowserImportWorker(worker) {
    const postMessage = findDataMethod(worker, 'postMessage');
    const terminate = findDataMethod(worker, 'terminate');
    if (!postMessage || !terminate) {
        throw importError(IMPORT_ERROR_CODE.INVALID_REQUEST);
    }
    let sequence = 0;
    let closed = false;
    let terminated = false;
    const pending = new Map();
    const failAll = () => {
        closed = true;
        for (const entry of pending.values()) {
            entry.reject(importError(IMPORT_ERROR_CODE.WORKER_CRASHED, true, 'decode'));
        }
        pending.clear();
    };
    worker.onmessage = event => {
        const entry = pending.get(event?.data?.id);
        if (!entry) return;
        pending.delete(event.data.id);
        entry.resolve(event.data.result);
    };
    worker.onerror = failAll;
    worker.onmessageerror = failAll;
    return Object.freeze({
        process(input) {
            if (closed) {
                return Promise.reject(importError(
                    IMPORT_ERROR_CODE.WORKER_CRASHED,
                    true,
                    'decode'
                ));
            }
            sequence += 1;
            return new Promise((resolve, reject) => {
                pending.set(sequence, { resolve, reject });
                try {
                    postMessage.call(worker, { id: sequence, input });
                } catch {
                    pending.delete(sequence);
                    reject(importError(
                        IMPORT_ERROR_CODE.WORKER_CRASHED,
                        true,
                        'decode'
                    ));
                }
            });
        },
        close() {
            if (!terminated) {
                terminated = true;
                try {
                    terminate.call(worker);
                } catch {
                    // Worker termination is best-effort; pending work still fails safely.
                }
            }
            failAll();
        }
    });
}
