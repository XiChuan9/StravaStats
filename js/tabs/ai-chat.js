const SAFE_STATUS = Object.freeze({
    AI_COACH_INPUT_INVALID: 'Enter a question of 4,000 characters or fewer.',
    AI_COACH_ACTIVITY_INVALID: 'Training aggregates could not be prepared safely. Nothing was sent.',
    AI_COACH_API_KEY_INVALID: 'Enter a valid API key. It will remain only in this page memory.',
    AI_COACH_API_KEY_REQUIRED: 'Enter an API key in page memory before preparing a request.',
    AI_COACH_CONSENT_REQUIRED: 'This one-time request was not authorized. Nothing was sent.',
    AI_COACH_OFFLINE: 'You appear to be offline. Nothing was sent.',
    AI_COACH_TIMEOUT: 'The request timed out after four seconds and was cancelled.',
    AI_COACH_CANCELLED: 'The request was cancelled.',
    AI_COACH_BUSY: 'One AI Coach request is already in progress.',
    AI_COACH_PROVIDER_ERROR: 'Google Gemini returned an error. No provider details were retained.',
    AI_COACH_RESPONSE_INVALID: 'Google Gemini returned an invalid or oversized response.',
    AI_COACH_NETWORK_ERROR: 'The request could not be completed. No automatic retry was made.',
    AI_COACH_LEGACY_STORAGE_ERROR: 'Previously saved AI data could not be inspected safely.'
});

function element(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

function button(text, id = '') {
    const node = element('button', '', text);
    node.type = 'button';
    if (id) node.id = id;
    return node;
}

function statusText(error) {
    return SAFE_STATUS[error?.code] ?? 'AI Coach could not complete this action safely.';
}

function renderMessage(message) {
    const role = message?.role === 'user' ? 'user' : 'model';
    const row = element('div', `ai-msg ai-msg--${role}`);
    const bubble = element('div', 'ai-msg-bubble');
    bubble.textContent = typeof message?.text === 'string' ? message.text : '';
    row.append(bubble);
    return row;
}

function renderDisabled(container) {
    const wrapper = element('div', 'ai-chat-wrapper');
    const title = element('h2', '', 'AI Coach');
    const message = element(
        'p',
        'ai-chat-subtitle',
        'AI Coach is unavailable in Demo. Demo performs no consent, API-key, provider, history, or storage I/O.'
    );
    wrapper.append(title, message);
    container.replaceChildren(wrapper);
}

export function renderAIChatTab(allActivities, options = {}) {
    const container = document.getElementById('ai-chat-tab');
    if (!container) return;
    const session = options?.aiCoach;
    if (options?.sessionMode !== 'real' || session?.enabled !== true) {
        renderDisabled(container);
        return;
    }

    const wrapper = element('div', 'ai-chat-wrapper');
    const header = element('div', 'ai-chat-header');
    const titleBox = element('div', 'ai-chat-title');
    const icon = element('span', 'ai-chat-icon', '🤖');
    const heading = element('div');
    heading.append(
        element('h2', '', 'AI Coach'),
        element(
            'p',
            'ai-chat-subtitle',
            `Google Gemini API · ${session.model} · external request only after confirmation`
        )
    );
    titleBox.append(icon, heading);
    const controls = element('div', 'ai-chat-header-controls');
    const clearButton = button('🗑️ Clear conversation', 'ai-clear-history');
    const revokeButton = button('Revoke AI access', 'ai-revoke-access');
    controls.append(clearButton, revokeButton);
    header.append(titleBox, controls);

    const disclosure = element('section', 'ai-egress-disclosure');
    disclosure.setAttribute('aria-label', 'AI Coach external request disclosure');
    disclosure.append(
        element('strong', '', 'External request disclosure'),
        element('p', '', session.disclosure)
    );

    const keyArea = element('section', 'ai-apikey-banner');
    if (!session.hasApiKey()) {
        keyArea.append(
            element('strong', '', '🔑 Gemini API key required'),
            element('p', '', 'The key is kept only in memory for this page. It is never saved automatically.')
        );
        const form = element('div', 'ai-apikey-form');
        const input = element('input');
        input.type = 'password';
        input.id = 'ai-apikey-input';
        input.placeholder = 'Paste your Gemini API key for this page…';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.maxLength = 4096;
        form.append(input, button('Use key in page memory', 'ai-apikey-save'));
        keyArea.append(form);
    } else {
        keyArea.append(
            element('span', '', '🔑 API key is available only in this page memory.'),
            button('Forget in-memory key', 'ai-apikey-forget')
        );
    }

    const legacyArea = element('section', 'ai-legacy-review');
    legacyArea.append(button('Review previously saved AI data', 'ai-review-legacy'));

    const messages = element('div', 'ai-chat-messages');
    messages.id = 'ai-chat-messages';
    const history = session.getHistory();
    if (history.length === 0) {
        const welcome = element('div', 'ai-chat-welcome');
        welcome.append(element('p', '', 'Ask about the approximate training aggregates disclosed above.'));
        const suggestions = element('div', 'ai-chat-suggestions');
        for (const text of [
            'How should I balance training and recovery?',
            'What can I improve over the next four weeks?',
            'Summarize my recent training volume.'
        ]) {
            const suggestion = button(text);
            suggestion.className = 'ai-suggestion-btn';
            suggestions.append(suggestion);
        }
        welcome.append(suggestions);
        messages.append(welcome);
    } else {
        messages.append(...history.map(renderMessage));
    }

    const status = element('p', 'ai-chat-status');
    status.id = 'ai-chat-status';
    status.setAttribute('role', 'status');
    const previewHost = element('div', 'ai-request-preview-host');
    previewHost.id = 'ai-request-preview-host';
    const inputArea = element('div', 'ai-chat-input-area');
    const question = element('textarea');
    question.id = 'ai-chat-input';
    question.placeholder = 'Ask your AI coach…';
    question.rows = 2;
    question.maxLength = 4000;
    const sendButton = button('Preview request', 'ai-chat-send');
    inputArea.append(question, sendButton);

    wrapper.append(
        header,
        disclosure,
        keyArea,
        legacyArea,
        messages,
        status,
        previewHost,
        inputArea
    );
    container.replaceChildren(wrapper);

    let prepared = null;
    let sending = false;

    function setStatus(text) {
        status.textContent = text;
    }

    function closePreview() {
        if (prepared !== null) session.cancel(prepared);
        prepared = null;
        previewHost.replaceChildren();
    }

    function showPreview() {
        if (sending || prepared !== null) return;
        if (!session.hasApiKey()) {
            setStatus(SAFE_STATUS.AI_COACH_API_KEY_REQUIRED);
            return;
        }
        try {
            prepared = session.prepare(question.value, allActivities);
        } catch (error) {
            setStatus(statusText(error));
            return;
        }
        const panel = element('section', 'ai-request-preview');
        panel.setAttribute('aria-label', 'Google Gemini request preview');
        panel.append(
            element('h3', '', 'Request preview — nothing has been sent'),
            element('p', '', prepared.disclosure),
            element('strong', '', 'Destination'),
            element('p', '', prepared.destination),
            element('strong', '', 'Included fields')
        );
        const fields = element('ul');
        for (const field of prepared.fields) fields.append(element('li', '', field));
        panel.append(fields, element('strong', '', 'Values after local minimization'));
        const values = element('pre', 'ai-request-preview-values');
        values.textContent = JSON.stringify(prepared.aggregates, null, 2);
        panel.append(values);
        const actions = element('div', 'ai-request-preview-actions');
        actions.append(
            button(prepared.confirmLabel, 'ai-confirm-send'),
            button('Cancel — send nothing', 'ai-cancel-preview')
        );
        panel.append(actions);
        previewHost.replaceChildren(panel);
        setStatus('Review the disclosed destination, fields, and minimized values before deciding.');

        panel.querySelector('#ai-cancel-preview')?.addEventListener('click', () => {
            closePreview();
            setStatus('Request cancelled. Nothing was sent.');
        });
        panel.querySelector('#ai-confirm-send')?.addEventListener('click', async () => {
            if (prepared === null || sending) return;
            const approved = prepared;
            prepared = null;
            sending = true;
            question.disabled = true;
            sendButton.disabled = true;
            const pending = element('div', 'ai-request-pending');
            pending.append(
                element('span', '', 'Sending one request to Google Gemini…'),
                button('Cancel request', 'ai-cancel-request')
            );
            previewHost.replaceChildren(pending);
            pending.querySelector('#ai-cancel-request')?.addEventListener('click', () => {
                session.cancel(approved);
            });
            try {
                await session.send(approved);
                renderAIChatTab(allActivities, options);
            } catch (error) {
                sending = false;
                question.disabled = false;
                sendButton.disabled = false;
                previewHost.replaceChildren();
                setStatus(statusText(error));
            }
        });
    }

    wrapper.querySelector('#ai-apikey-save')?.addEventListener('click', () => {
        const input = wrapper.querySelector('#ai-apikey-input');
        try {
            session.setApiKey(input?.value ?? '');
            if (input) input.value = '';
            renderAIChatTab(allActivities, options);
        } catch (error) {
            if (input) input.value = '';
            setStatus(statusText(error));
        }
    });

    wrapper.querySelector('#ai-apikey-forget')?.addEventListener('click', () => {
        closePreview();
        session.forgetApiKey();
        renderAIChatTab(allActivities, options);
    });

    clearButton.addEventListener('click', () => {
        closePreview();
        session.clearHistory();
        renderAIChatTab(allActivities, options);
    });

    revokeButton.addEventListener('click', () => {
        prepared = null;
        session.revoke();
        renderAIChatTab(allActivities, options);
    });

    wrapper.querySelector('#ai-review-legacy')?.addEventListener('click', () => {
        let inspection;
        try {
            inspection = session.inspectLegacyData();
        } catch (error) {
            setStatus(statusText(error));
            return;
        }
        const panel = element('div', 'ai-legacy-review-panel');
        panel.append(element(
            'p',
            '',
            `Previously saved key: ${inspection.hasSavedKey ? 'present' : 'not found'}. Previously saved history: ${inspection.hasSavedHistory ? 'present' : 'not found'}. No value was displayed or changed.`
        ));
        if (inspection.hasSavedKey) {
            panel.append(
                button('Copy saved key into page memory', 'ai-copy-legacy-key'),
                button('Delete previously saved key', 'ai-delete-legacy-key')
            );
        }
        if (inspection.hasSavedHistory) {
            panel.append(button('Delete previously saved AI history', 'ai-delete-legacy-history'));
        }
        legacyArea.append(panel);
        panel.querySelector('#ai-copy-legacy-key')?.addEventListener('click', () => {
            try {
                session.copyLegacyKeyToMemory();
                renderAIChatTab(allActivities, options);
            } catch (error) {
                setStatus(statusText(error));
            }
        });
        panel.querySelector('#ai-delete-legacy-key')?.addEventListener('click', () => {
            if (!globalThis.confirm?.('Delete only the previously saved Gemini API key? This cannot be undone.')) return;
            try {
                session.deleteLegacyKey();
                renderAIChatTab(allActivities, options);
            } catch (error) {
                setStatus(statusText(error));
            }
        });
        panel.querySelector('#ai-delete-legacy-history')?.addEventListener('click', () => {
            if (!globalThis.confirm?.('Delete only the previously saved AI chat history? This cannot be undone.')) return;
            try {
                session.deleteLegacyHistory();
                renderAIChatTab(allActivities, options);
            } catch (error) {
                setStatus(statusText(error));
            }
        });
    });

    sendButton.addEventListener('click', showPreview);
    question.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            showPreview();
        }
    });
    question.addEventListener('input', () => {
        question.style.height = 'auto';
        question.style.height = `${Math.min(question.scrollHeight, 140)}px`;
    });
    messages.querySelectorAll('.ai-suggestion-btn').forEach(suggestion => {
        suggestion.addEventListener('click', () => {
            question.value = suggestion.textContent ?? '';
            question.focus();
        });
    });
    messages.scrollTop = messages.scrollHeight;
}
