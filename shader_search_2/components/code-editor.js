/**
 * CodeEditor - Monaco Editor wrapper with standardized interface
 */
export class CodeEditor {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.editor = null;
        this.changeCallbacks = [];
        
        this.options = {
            value: options.value || '',
            language: options.language || 'javascript',
            theme: options.theme || 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: options.fontSize || 12,
            readOnly: options.readOnly || false,
            ...options
        };
        
        this.#initialize();
    }
    
    /**
     * Initialize Monaco Editor
     */
    #initialize() {
        // Wait for Monaco to be available
        if (typeof monaco === 'undefined') {
            console.error('Monaco editor not loaded');
            return;
        }
        
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container #${this.containerId} not found`);
            return;
        }
        
        this.editor = monaco.editor.create(container, this.options);
        
        // Setup change listener
        this.editor.onDidChangeModelContent(() => {
            this.#notifyChangeCallbacks();
        });
    }
    
    /**
     * Get current value
     */
    getValue() {
        return this.editor ? this.editor.getValue() : '';
    }
    
    /**
     * Set value
     */
    setValue(value) {
        if (this.editor) {
            this.editor.setValue(value);
        }
    }
    
    /**
     * Register callback for content changes
     * @param {function} callback
     * @returns {function} Unsubscribe function
     */
    onDidChangeContent(callback) {
        this.changeCallbacks.push(callback);
        return () => {
            const index = this.changeCallbacks.indexOf(callback);
            if (index > -1) {
                this.changeCallbacks.splice(index, 1);
            }
        };
    }
    
    /**
     * Notify all change callbacks
     */
    #notifyChangeCallbacks() {
        const value = this.getValue();
        for (const callback of this.changeCallbacks) {
            callback(value);
        }
    }
    
    /**
     * Set language
     */
    setLanguage(language) {
        if (this.editor) {
            const model = this.editor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, language);
            }
        }
    }
    
    /**
     * Set theme
     */
    setTheme(theme) {
        if (this.editor) {
            monaco.editor.setTheme(theme);
        }
    }
    
    /**
     * Set read-only mode
     */
    setReadOnly(readOnly) {
        if (this.editor) {
            this.editor.updateOptions({ readOnly });
        }
    }
    
    /**
     * Focus editor
     */
    focus() {
        if (this.editor) {
            this.editor.focus();
        }
    }
    
    /**
     * Layout/resize editor
     */
    layout() {
        if (this.editor) {
            this.editor.layout();
        }
    }
    
    /**
     * Dispose editor
     */
    dispose() {
        if (this.editor) {
            this.editor.dispose();
            this.editor = null;
        }
    }
}

