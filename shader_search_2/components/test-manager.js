import { loadTestSuite, parseTestSuite } from '../lib/test-suite-parser.js';

/**
 * TestManager - Manages test cases and provides event notifications
 */
export class TestManager {
    constructor() {
        this.tests = [];
        this.listeners = [];
    }
    
    /**
     * Load tests from file or custom content
     * @param {string} [customContent] - Optional custom test suite content
     */
    async loadTests(customContent = null) {
        try {
            this.tests = await loadTestSuite(customContent);
            this.#notifyListeners();
            return this.tests;
        } catch (error) {
            console.error('Failed to load tests:', error);
            throw error;
        }
    }
    
    /**
     * Parse and set tests from content
     */
    setTestsFromContent(content) {
        try {
            this.tests = parseTestSuite(content);
            this.#notifyListeners();
            return this.tests;
        } catch (error) {
            console.error('Failed to parse test content:', error);
            throw error;
        }
    }
    
    /**
     * Get all tests
     */
    getTests() {
        return this.tests;
    }
    
    /**
     * Get test by name
     */
    getTest(name) {
        return this.tests.find(t => t.name === name);
    }
    
    /**
     * Get test by index
     */
    getTestAt(index) {
        return this.tests[index];
    }
    
    /**
     * Get test count
     */
    getTestCount() {
        return this.tests.length;
    }
    
    /**
     * Add a new test
     */
    addTest(test) {
        this.tests.push(test);
        this.#saveAndNotify();
    }
    
    /**
     * Update an existing test
     */
    updateTest(index, test) {
        if (index >= 0 && index < this.tests.length) {
            this.tests[index] = test;
            this.#saveAndNotify();
        }
    }
    
    /**
     * Delete a test
     */
    deleteTest(index) {
        if (index >= 0 && index < this.tests.length) {
            this.tests.splice(index, 1);
            this.#saveAndNotify();
        }
    }
    
    /**
     * Convert tests to test suite text format
     */
    toTestSuiteText() {
        let text = '';
        
        for (const test of this.tests) {
            text += `TEST: ${test.name}\n`;
            text += `GRID: ${test.width}x${test.height}\n`;
            
            for (const frame of test.frames) {
                text += '\nFRAME:\n';
                for (const row of frame) {
                    text += row.map(cell => {
                        if (cell === 0) return '.';
                        if (cell === 1) return 's';
                        if (cell === 2) return '#';
                        return '?';
                    }).join(' ') + '\n';
                }
            }
            
            text += '\n';
        }
        
        return text;
    }
    
    /**
     * Subscribe to test changes
     */
    onTestsChanged(callback) {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
    
    /**
     * Notify all listeners of test changes
     */
    #notifyListeners() {
        for (const listener of this.listeners) {
            listener(this.tests);
        }
    }
    
    /**
     * Save to localStorage and notify listeners
     */
    #saveAndNotify() {
        const content = this.toTestSuiteText();
        localStorage.setItem('customTestSuite', content);
        this.#notifyListeners();
    }
    
    /**
     * Save tests to localStorage
     */
    saveToLocalStorage(content) {
        localStorage.setItem('customTestSuite', content);
    }
    
    /**
     * Clear localStorage
     */
    clearLocalStorage() {
        localStorage.removeItem('customTestSuite');
    }
}

