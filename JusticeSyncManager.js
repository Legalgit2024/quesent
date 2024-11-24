// Add this to the existing JavaScript, just before the last closing script tag

class JusticeSyncManager {
    constructor() {
        this.settings = {
            autoSync: true,
            customHotkeys: {
                quickSave: 'Control+Shift+S',
                quickAccess: 'Control+Shift+Space',
                customCopy: 'Control+Shift+C',
                customPaste: 'Control+Shift+V'
            },
            syncSources: {
                systemClipboard: true,
                browserExtension: true,
                mobileApp: true,
                desktopApp: true
            },
            syncInterval: 1000, // ms
            maxHistorySize: 1000,
            notificationsEnabled: true
        };
        
        this.clipboardBuffer = new Set();
        this.initialize();
    }

    initialize() {
        this.setupKeyboardListeners();
        this.setupClipboardWatcher();
        this.setupSystemIntegration();
        this.initializeSettingsUI();
    }

    setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            // Quick Save Hotkey
            if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                this.quickSave();
            }
            // Quick Access Hotkey
            if (e.ctrlKey && e.shiftKey && e.key === ' ') {
                e.preventDefault();
                this.toggleQuickAccess();
            }
            // Custom Copy
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.customCopy();
            }
            // Custom Paste
            if (e.ctrlKey && e.shiftKey && e.key === 'V') {
                e.preventDefault();
                this.customPaste();
            }
        });
    }

    async setupClipboardWatcher() {
        if ('clipboard' in navigator && 'readText' in navigator.clipboard) {
            setInterval(async () => {
                try {
                    const clipboardContent = await navigator.clipboard.readText();
                    if (clipboardContent && !this.clipboardBuffer.has(clipboardContent)) {
                        this.clipboardBuffer.add(clipboardContent);
                        this.handleNewClipboardContent(clipboardContent);
                    }
                } catch (error) {
                    console.warn('Clipboard access denied:', error);
                }
            }, this.settings.syncInterval);
        }
    }

    setupSystemIntegration() {
        // Register browser extension message listener
        if (window.chrome && chrome.runtime) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.type === 'newClipboardContent') {
                    this.handleNewClipboardContent(request.content);
                }
            });
        }

        // Setup WebSocket connection for desktop app sync
        this.setupWebSocket();
    }

    setupWebSocket() {
        const ws = new WebSocket('ws://localhost:8080'); // Local WebSocket server for desktop app
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'clipboardUpdate') {
                this.handleNewClipboardContent(data.content);
            }
        };

        ws.onerror = (error) => {
            console.log('WebSocket error:', error);
        };
    }

    async handleNewClipboardContent(content) {
        if (this.settings.autoSync && content) {
            const title = await generateTitle(content);
            const clipData = {
                title,
                content,
                timestamp: Date.now(),
                source: this.detectSource(),
                tags: this.generateTags(content)
            };

            await this.saveToDatabase(clipData);
            this.updateUI(clipData);
            this.showNotification(clipData);
        }
    }

    detectSource() {
        if (window.chrome && chrome.runtime) return 'browser';
        if (window.electron) return 'desktop';
        if (/Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'mobile';
        return 'web';
    }

    generateTags(content) {
        // Simple tag generation based on content
        const words = content.toLowerCase().split(/\s+/);
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but']);
        return [...new Set(words.filter(word => 
            word.length > 3 && !commonWords.has(word)
        ))].slice(0, 5);
    }

    async saveToDatabase(clipData) {
        // Save to Firebase/IndexedDB
        try {
            const db = firebase.firestore();
            await db.collection('clips').add(clipData);
        } catch (error) {
            // Fallback to IndexedDB
            await this.saveToIndexedDB(clipData);
        }
    }

    async saveToIndexedDB(clipData) {
        // Implementation for IndexedDB backup
        const request = indexedDB.open('JusticeSyncDB', 1);
        request.onerror = (event) => console.error('IndexedDB error:', event);
        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['clips'], 'readwrite');
            const store = transaction.objectStore('clips');
            store.add(clipData);
        };
    }

    showNotification(clipData) {
        if (this.settings.notificationsEnabled && 'Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification('JusticeSync Pro', {
                    body: `New clip saved: ${clipData.title}`,
                    icon: '/path/to/icon.png'
                });
            }
        }
    }

    // UI Components
    initializeSettingsUI() {
        const settingsHTML = `
            <div class="settings-panel" id="settingsPanel">
                <div class="settings-header">
                    <h2>JusticeSync Settings</h2>
                    <button class="close-btn">×</button>
                </div>
                <div class="settings-content">
                    <div class="settings-section">
                        <h3>Sync Sources</h3>
                        <label>
                            <input type="checkbox" name="systemClipboard" 
                                ${this.settings.syncSources.systemClipboard ? 'checked' : ''}>
                            System Clipboard
                        </label>
                        <label>
                            <input type="checkbox" name="browserExtension"
                                ${this.settings.syncSources.browserExtension ? 'checked' : ''}>
                            Browser Extension
                        </label>
                        <label>
                            <input type="checkbox" name="mobileApp"
                                ${this.settings.syncSources.mobileApp ? 'checked' : ''}>
                            Mobile App
                        </label>
                        <label>
                            <input type="checkbox" name="desktopApp"
                                ${this.settings.syncSources.desktopApp ? 'checked' : ''}>
                            Desktop App
                        </label>
                    </div>
                    <div class="settings-section">
                        <h3>Hotkeys</h3>
                        <div class="hotkey-setting">
                            <span>Quick Save:</span>
                            <input type="text" value="${this.settings.customHotkeys.quickSave}"
                                readonly data-hotkey="quickSave">
                        </div>
                        <div class="hotkey-setting">
                            <span>Quick Access:</span>
                            <input type="text" value="${this.settings.customHotkeys.quickAccess}"
                                readonly data-hotkey="quickAccess">
                        </div>
                    </div>
                    <div class="settings-section">
                        <h3>Sync Settings</h3>
                        <label>
                            <input type="checkbox" name="autoSync"
                                ${this.settings.autoSync ? 'checked' : ''}>
                            Auto-sync new clips
                        </label>
                        <label>
                            Sync Interval:
                            <input type="number" name="syncInterval"
                                value="${this.settings.syncInterval / 1000}" min="1" max="60">
                            seconds
                        </label>
                    </div>
                </div>
            </div>
        `;

        // Inject settings panel into DOM
        const settingsContainer = document.createElement('div');
        settingsContainer.innerHTML = settingsHTML;
        document.body.appendChild(settingsContainer);

        // Add event listeners for settings
        this.setupSettingsListeners();
    }

    setupSettingsListeners() {
        // Implementation for settings panel event listeners
        document.querySelectorAll('.settings-panel input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const setting = e.target.name;
                const value = e.target.checked;
                this.updateSetting(setting, value);
            });
        });

        // Hotkey recording
        document.querySelectorAll('.hotkey-setting input').forEach(input => {
            input.addEventListener('focus', () => {
                input.value = 'Press keys...';
                const hotkeyName = input.dataset.hotkey;
                
                const recordHotkey = (e) => {
                    e.preventDefault();
                    const keys = [];
                    if (e.ctrlKey) keys.push('Control');
                    if (e.shiftKey) keys.push('Shift');
                    if (e.altKey) keys.push('Alt');
                    if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
                        keys.push(e.key);
                    }
                    
                    if (keys.length > 0) {
                        const hotkey = keys.join('+');
                        this.settings.customHotkeys[hotkeyName] = hotkey;
                        input.value = hotkey;
                        input.blur();
                    }
                };

                input.addEventListener('keydown', recordHotkey, { once: true });
            });
        });
    }

    updateSetting(setting, value) {
        // Update setting in local storage and memory
        if (setting.includes('.')) {
            const [category, key] = setting.split('.');
            this.settings[category][key] = value;
        } else {
            this.settings[setting] = value;
        }
        localStorage.setItem('justicesync_settings', JSON.stringify(this.settings));
    }
}

// Initialize JusticeSyncManager
const justiceSyncManager = new JusticeSyncManager();

// Add these styles to the existing CSS
