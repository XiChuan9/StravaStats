// js/main.js
import { installGlobalDiagnosticsListeners } from './diagnostics/index.js';
import './app/main.js';

installGlobalDiagnosticsListeners({ page: 'dashboard' });
