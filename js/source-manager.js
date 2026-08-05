import { startSourceManager } from './app/source-manager.js';

let application = null;

startSourceManager({
    document,
    location,
    indexedDB,
    IDBKeyRange,
    crypto,
    Worker
}).then(result => {
    application = result;
}).catch(() => {
    const panel = document.getElementById('blocking-error');
    if (panel) panel.hidden = false;
});

addEventListener('pagehide', () => {
    application?.close().catch(() => {});
}, { once: true });
