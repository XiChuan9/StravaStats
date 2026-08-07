import { startStorageBackup } from './app/storage-backup.js';

let application = null;

startStorageBackup({
    document,
    location,
    indexedDB,
    IDBKeyRange,
    crypto,
    localStorage,
    URL,
    Blob
}).then(result => {
    application = result;
}).catch(() => {
    const panel = document.getElementById('blocking-error');
    if (panel) panel.hidden = false;
});

addEventListener('pagehide', () => {
    application?.close().catch(() => {});
}, { once: true });
