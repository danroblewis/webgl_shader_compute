import { parseTestSuite } from '../lib/test-suite-parser.js';
import { GridVisualizer } from './grid-visualizer.js';

/**
 * TestEditor - Unified test creation, editing, and result viewing
 */
export class TestEditor {
    constructor(containerId, testManager, simulationEngine, cellTypeColors) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container #${containerId} not found`);
        }
        
        this.testManager = testManager;
        this.simulationEngine = simulationEngine;
        this.cellTypeColors = cellTypeColors;
        
        this.selectedTestIndex = null;
        this.testResults = null;
        this.currentFrame = 0;
        this.playInterval = null;
        this.comparisonVisualizer = null;
        
        this.#render();
        this.#setupEventListeners();
    }
    
    #render() {
        this.container.innerHTML = `
            <div style="display: grid; grid-template-columns: 300px 1fr; gap: 20px; height: 100%;">
                <!-- Left: Test List -->
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="display: flex; gap: 10px;">
                        <button id="runAllTestsBtn" style="flex: 1;">▶️ Run All</button>
                        <button id="clearResultsBtn" style="flex: 1;" class="danger">Clear</button>
                    </div>
                    
                    <div style="background-color: #1e1e1e; border: 1px solid #3e3e42; border-radius: 4px; padding: 10px;">
                        <strong>Results:</strong> <span id="testResultsSummary">Not run</span>
                    </div>
                    
                    <div id="testList" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 5px;">
                        <!-- Test items will be rendered here -->
                    </div>
                    
                    <button id="addTestBtn" style="width: 100%;">➕ Add New Test</button>
                </div>
                
                <!-- Right: Test Detail/Editor -->
                <div id="testDetail" style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="text-align: center; color: #858585; padding: 40px;">
                        Select a test from the list to view or edit
                    </div>
                </div>
            </div>
        `;
        
        this.#renderTestList();
    }
    
    #renderTestList() {
        const testList = this.container.querySelector('#testList');
        const tests = this.testManager.getTests();
        
        testList.innerHTML = '';
        
        tests.forEach((test, index) => {
            const item = document.createElement('div');
            item.className = 'test-item';
            
            // Add result indicator if tests have been run
            let indicator = '';
            if (this.testResults && this.testResults.results[index]) {
                const result = this.testResults.results[index];
                indicator = result.passed ? '✅' : '❌';
                item.classList.add(result.passed ? 'passed' : 'failed');
            }
            
            item.innerHTML = `${indicator} ${test.name}`;
            item.style.cursor = 'pointer';
            item.onclick = () => this.selectTest(index);
            
            if (index === this.selectedTestIndex) {
                item.style.backgroundColor = '#0e639c';
            }
            
            testList.appendChild(item);
        });
    }
    
    selectTest(index) {
        // Stop any running animation
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        
        this.selectedTestIndex = index;
        this.currentFrame = 0;
        
        // Re-run test in detailed mode when selected
        const test = this.testManager.getTestAt(index);
        let result = null;
        
        if (test) {
            result = this.simulationEngine.runTest(test, true);
            
            // Update results array
            if (!this.testResults) {
                this.testResults = {
                    passed: 0,
                    failed: 0,
                    total: this.testManager.getTestCount(),
                    results: new Array(this.testManager.getTestCount()).fill(null)
                };
            }
            
            // Update result with detailed info
            this.testResults.results[index] = {
                name: test.name,
                ...result
            };
        }
        
        this.#renderTestList();
        this.#renderTestDetail();
        
        // Auto-start playing if test has multiple frames
        if (result && result.frames && result.frames.length > 1) {
            // Small delay to ensure UI is rendered
            setTimeout(() => {
                const playBtn = this.container.querySelector('#testPlayBtn');
                if (playBtn && !this.playInterval) {
                    this.#togglePlay();
                }
            }, 100);
        }
    }
    
    #renderTestDetail() {
        const testDetail = this.container.querySelector('#testDetail');
        const test = this.testManager.getTestAt(this.selectedTestIndex);
        
        if (!test) {
            testDetail.innerHTML = `
                <div style="text-align: center; color: #858585; padding: 40px;">
                    Select a test from the list to view or edit
                </div>
            `;
            return;
        }
        
        // Get test result if available
        const result = this.testResults && this.testResults.results[this.selectedTestIndex];
        
        testDetail.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0;">${test.name}</h3>
                <div style="display: flex; gap: 10px;">
                    <button id="runSingleTestBtn">▶️ Run This Test</button>
                    <button id="editTestBtn">✏️ Edit</button>
                    <button id="deleteTestBtn" class="danger">🗑️ Delete</button>
                </div>
            </div>
            
            ${result ? `
                <div class="status-message ${result.passed ? 'success' : 'error'}">
                    ${result.passed ? '✅ Test Passed' : '❌ Test Failed: ' + result.error}
                </div>
            ` : ''}
            
            <div style="background-color: #1e1e1e; border: 1px solid #3e3e42; border-radius: 4px; padding: 15px;">
                <div style="margin-bottom: 10px;">
                    <strong>Grid Size:</strong> ${test.width}×${test.height}
                    <strong style="margin-left: 20px;">Frames:</strong> ${test.frames.length}
                </div>
            </div>
            
            ${result && result.passed === false && result.frames ? `
                <div>
                    <h4>Detailed Comparison</h4>
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                        <button id="testPrevFrameBtn">⏮</button>
                        <button id="testPlayBtn">▶️ Play</button>
                        <button id="testNextFrameBtn">⏭</button>
                        <span id="frameInfo" style="flex: 1; text-align: center; color: #858585;">Frame 1/${result.frames.length}</span>
                    </div>
                    <div id="comparisonView"></div>
                </div>
            ` : result && result.passed ? `
                <div>
                    <h4>All Frames Passed</h4>
                    <div id="successView"></div>
                </div>
            ` : ''}
        `;
        
        // Setup comparison visualizer if test failed
        if (result && !result.passed && result.frames) {
            this.currentFrame = 0;
            this.comparisonVisualizer = new GridVisualizer('comparisonView', this.cellTypeColors);
            this.#renderFrame();
            
            // Setup frame navigation
            testDetail.querySelector('#testPrevFrameBtn').onclick = () => this.#changeFrame(-1);
            testDetail.querySelector('#testNextFrameBtn').onclick = () => this.#changeFrame(1);
            testDetail.querySelector('#testPlayBtn').onclick = () => this.#togglePlay();
        } else if (result && result.passed) {
            // Show first frame for passed tests
            const successView = new GridVisualizer('successView', this.cellTypeColors);
            successView.renderGrid(test.frames[0]);
        }
        
        // Setup event listeners
        testDetail.querySelector('#runSingleTestBtn').onclick = () => this.#runSingleTest();
        testDetail.querySelector('#editTestBtn').onclick = () => this.#editTest();
        testDetail.querySelector('#deleteTestBtn').onclick = () => this.#deleteTest();
    }
    
    #renderFrame() {
        if (!this.testResults || !this.testResults.results[this.selectedTestIndex]) return;
        
        const result = this.testResults.results[this.selectedTestIndex];
        const frame = result.frames[this.currentFrame];
        
        this.comparisonVisualizer.renderComparison(frame.actual, frame.expected);
        
        const frameInfo = this.container.querySelector('#frameInfo');
        if (frameInfo) {
            frameInfo.textContent = `Frame ${this.currentFrame + 1}/${result.frames.length}`;
        }
    }
    
    #changeFrame(delta) {
        const result = this.testResults.results[this.selectedTestIndex];
        this.currentFrame += delta;
        this.currentFrame = Math.max(0, Math.min(this.currentFrame, result.frames.length - 1));
        this.#renderFrame();
    }
    
    #togglePlay() {
        const result = this.testResults.results[this.selectedTestIndex];
        if (!result || !result.frames) return;
        
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
            const btn = this.container.querySelector('#testPlayBtn');
            if (btn) btn.textContent = '▶️ Play';
        } else {
            const btn = this.container.querySelector('#testPlayBtn');
            if (btn) btn.textContent = '⏸️ Pause';
            
            this.playInterval = setInterval(() => {
                this.currentFrame = (this.currentFrame + 1) % result.frames.length;
                this.#renderFrame();
            }, 500);
        }
    }
    
    #runSingleTest() {
        const test = this.testManager.getTestAt(this.selectedTestIndex);
        const result = this.simulationEngine.runTest(test, true);
        
        // Update results
        if (!this.testResults) {
            this.testResults = {
                passed: 0,
                failed: 0,
                total: this.testManager.getTestCount(),
                results: new Array(this.testManager.getTestCount()).fill(null)
            };
        }
        
        // Update this specific test result
        if (this.testResults.results[this.selectedTestIndex]) {
            // Remove old result from counts
            if (this.testResults.results[this.selectedTestIndex].passed) {
                this.testResults.passed--;
            } else {
                this.testResults.failed--;
            }
        }
        
        this.testResults.results[this.selectedTestIndex] = {
            name: test.name,
            ...result
        };
        
        // Add new result to counts
        if (result.passed) {
            this.testResults.passed++;
        } else {
            this.testResults.failed++;
        }
        
        this.#updateResultsSummary();
        this.#renderTestList();
        this.#renderTestDetail();
    }
    
    #deleteTest() {
        if (!confirm(`Delete test "${this.testManager.getTestAt(this.selectedTestIndex).name}"?`)) {
            return;
        }
        
        this.testManager.deleteTest(this.selectedTestIndex);
        this.testResults = null;
        this.selectedTestIndex = null;
        this.#renderTestList();
        this.#renderTestDetail();
    }
    
    #setupEventListeners() {
        this.container.querySelector('#runAllTestsBtn').onclick = () => this.runAllTests();
        this.container.querySelector('#clearResultsBtn').onclick = () => this.clearResults();
        this.container.querySelector('#addTestBtn').onclick = () => this.#addTest();
    }
    
    runAllTests() {
        const tests = this.testManager.getTests();
        this.testResults = this.simulationEngine.runAllTests(tests);
        
        this.#updateResultsSummary();
        this.#renderTestList();
        
        // If a test is selected, update its detail view
        if (this.selectedTestIndex !== null) {
            this.#renderTestDetail();
        }
    }
    
    #updateResultsSummary() {
        const summary = this.container.querySelector('#testResultsSummary');
        if (this.testResults) {
            summary.textContent = `${this.testResults.passed} passed, ${this.testResults.failed} failed`;
            summary.style.color = this.testResults.failed === 0 ? '#4ec9b0' : '#f48771';
        } else {
            summary.textContent = 'Not run';
            summary.style.color = '#858585';
        }
    }
    
    clearResults() {
        this.testResults = null;
        this.#updateResultsSummary();
        this.#renderTestList();
        if (this.selectedTestIndex !== null) {
            this.#renderTestDetail();
        }
    }
    
    #addTest() {
        this.#openTestCreator(null);
    }
    
    #editTest() {
        const test = this.testManager.getTestAt(this.selectedTestIndex);
        if (test) {
            this.#openTestCreator(test);
        }
    }
    
    #openTestCreator(existingTest = null) {
        // Stop any running animation
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        
        const isEdit = existingTest !== null;
        
        // Initialize test creator state
        this.testCreatorState = {
            name: isEdit ? existingTest.name : '',
            width: isEdit ? existingTest.width : 5,
            height: isEdit ? existingTest.height : 5,
            frames: isEdit ? existingTest.frames.map(f => f.map(row => [...row])) : [[]], // Deep copy
            currentFrame: 0,
            selectedCellType: 0
        };
        
        // Initialize first frame if creating new
        if (!isEdit) {
            this.testCreatorState.frames[0] = this.#createEmptyGrid(5, 5);
        }
        
        // Render test creator modal
        this.#renderTestCreator(isEdit);
    }
    
    #createEmptyGrid(width, height) {
        const grid = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push(0); // EMPTY
            }
            grid.push(row);
        }
        return grid;
    }
    
    #renderTestCreator(isEdit) {
        const state = this.testCreatorState;
        
        // Create modal overlay
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        modal.innerHTML = `
            <div style="background: #252526; border: 1px solid #3e3e42; border-radius: 8px; padding: 20px; max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #4ec9b0;">${isEdit ? 'Edit Test' : 'Create New Test'}</h2>
                    <button id="closeCreator" style="background: none; border: none; color: #d4d4d4; font-size: 24px; cursor: pointer;">✕</button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: #858585;">Test Name</label>
                        <input type="text" id="testName" value="${state.name}" style="width: 100%; padding: 8px; background: #3c3c3c; border: 1px solid #3e3e42; color: #d4d4d4; border-radius: 4px;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; margin-bottom: 5px; color: #858585;">Width</label>
                            <input type="number" id="testWidth" value="${state.width}" min="1" max="20" style="width: 100%; padding: 8px; background: #3c3c3c; border: 1px solid #3e3e42; color: #d4d4d4; border-radius: 4px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 5px; color: #858585;">Height</label>
                            <input type="number" id="testHeight" value="${state.height}" min="1" max="20" style="width: 100%; padding: 8px; background: #3c3c3c; border: 1px solid #3e3e42; color: #d4d4d4; border-radius: 4px;">
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: #858585;">Paint Cell Type</label>
                    <div style="display: flex; gap: 10px;">
                        <button class="cell-type-btn" data-type="0" style="flex: 1; padding: 8px; background: #1e1e1e; border: 2px solid #3e3e42; color: #d4d4d4; border-radius: 4px; cursor: pointer;">Empty (0)</button>
                        <button class="cell-type-btn" data-type="1" style="flex: 1; padding: 8px; background: #f4d03f; border: 2px solid #3e3e42; color: #000; border-radius: 4px; cursor: pointer;">Sand (1)</button>
                        <button class="cell-type-btn" data-type="2" style="flex: 1; padding: 8px; background: #808080; border: 2px solid #3e3e42; color: #fff; border-radius: 4px; cursor: pointer;">Stone (2)</button>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <label style="color: #858585;">Frame ${state.currentFrame + 1}/${state.frames.length}</label>
                        <div style="display: flex; gap: 10px;">
                            <button id="prevFrame">⏮ Prev</button>
                            <button id="nextFrame">Next ⏭</button>
                            <button id="addFrame">➕ Add Frame</button>
                            <button id="deleteFrame" ${state.frames.length <= 1 ? 'disabled' : ''}>🗑️ Delete Frame</button>
                        </div>
                    </div>
                    <div id="gridEditor" style="display: inline-block; border: 2px solid #3e3e42; cursor: crosshair;"></div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancelCreator" class="danger">Cancel</button>
                    <button id="saveTest" class="success">💾 Save Test</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup event listeners
        modal.querySelector('#closeCreator').onclick = () => this.#closeTestCreator(modal);
        modal.querySelector('#cancelCreator').onclick = () => this.#closeTestCreator(modal);
        modal.querySelector('#saveTest').onclick = () => this.#saveTest(modal, isEdit);
        
        modal.querySelector('#testName').oninput = (e) => { state.name = e.target.value; };
        modal.querySelector('#testWidth').onchange = (e) => this.#resizeGrid(parseInt(e.target.value), state.height, modal);
        modal.querySelector('#testHeight').onchange = (e) => this.#resizeGrid(state.width, parseInt(e.target.value), modal);
        
        modal.querySelectorAll('.cell-type-btn').forEach(btn => {
            btn.onclick = (e) => {
                state.selectedCellType = parseInt(e.target.dataset.type);
                modal.querySelectorAll('.cell-type-btn').forEach(b => b.style.borderColor = '#3e3e42');
                btn.style.borderColor = '#4ec9b0';
            };
        });
        
        // Set initial selected cell type
        modal.querySelector(`.cell-type-btn[data-type="${state.selectedCellType}"]`).style.borderColor = '#4ec9b0';
        
        modal.querySelector('#prevFrame').onclick = () => this.#changeCreatorFrame(-1, modal);
        modal.querySelector('#nextFrame').onclick = () => this.#changeCreatorFrame(1, modal);
        modal.querySelector('#addFrame').onclick = () => this.#addCreatorFrame(modal);
        modal.querySelector('#deleteFrame').onclick = () => this.#deleteCreatorFrame(modal);
        
        // Render initial grid
        this.#renderCreatorGrid(modal);
    }
    
    #renderCreatorGrid(modal) {
        const state = this.testCreatorState;
        const gridEditor = modal.querySelector('#gridEditor');
        const frame = state.frames[state.currentFrame];
        
        gridEditor.innerHTML = '';
        const cellSize = 30;
        
        for (let y = 0; y < state.height; y++) {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.height = cellSize + 'px';
            
            for (let x = 0; x < state.width; x++) {
                const cell = document.createElement('div');
                cell.style.width = cellSize + 'px';
                cell.style.height = cellSize + 'px';
                cell.style.border = '1px solid #3e3e42';
                cell.style.boxSizing = 'border-box';
                
                const cellValue = frame[y][x];
                const color = this.cellTypeColors[cellValue] || '#ff00ff';
                cell.style.backgroundColor = color;
                
                let isDrawing = false;
                
                cell.onmousedown = (e) => {
                    e.preventDefault();
                    isDrawing = true;
                    frame[y][x] = state.selectedCellType;
                    cell.style.backgroundColor = this.cellTypeColors[state.selectedCellType];
                };
                
                cell.onmouseenter = (e) => {
                    if (isDrawing) {
                        frame[y][x] = state.selectedCellType;
                        cell.style.backgroundColor = this.cellTypeColors[state.selectedCellType];
                    }
                };
                
                row.appendChild(cell);
            }
            
            gridEditor.appendChild(row);
        }
        
        // Add mouseup listener to stop drawing
        document.onmouseup = () => { isDrawing = false; };
    }
    
    #resizeGrid(newWidth, newHeight, modal) {
        const state = this.testCreatorState;
        state.width = newWidth;
        state.height = newHeight;
        
        // Resize all frames
        for (let f = 0; f < state.frames.length; f++) {
            const oldFrame = state.frames[f];
            const newFrame = this.#createEmptyGrid(newWidth, newHeight);
            
            // Copy old data
            for (let y = 0; y < Math.min(oldFrame.length, newHeight); y++) {
                for (let x = 0; x < Math.min(oldFrame[0].length, newWidth); x++) {
                    newFrame[y][x] = oldFrame[y][x];
                }
            }
            
            state.frames[f] = newFrame;
        }
        
        this.#renderCreatorGrid(modal);
    }
    
    #changeCreatorFrame(delta, modal) {
        const state = this.testCreatorState;
        state.currentFrame = Math.max(0, Math.min(state.frames.length - 1, state.currentFrame + delta));
        
        // Update frame label
        modal.querySelector('label').textContent = `Frame ${state.currentFrame + 1}/${state.frames.length}`;
        
        this.#renderCreatorGrid(modal);
    }
    
    #addCreatorFrame(modal) {
        const state = this.testCreatorState;
        
        // Copy current frame as starting point
        const newFrame = state.frames[state.currentFrame].map(row => [...row]);
        state.frames.push(newFrame);
        state.currentFrame = state.frames.length - 1;
        
        // Update UI
        modal.querySelector('label').textContent = `Frame ${state.currentFrame + 1}/${state.frames.length}`;
        modal.querySelector('#deleteFrame').disabled = false;
        
        this.#renderCreatorGrid(modal);
    }
    
    #deleteCreatorFrame(modal) {
        const state = this.testCreatorState;
        
        if (state.frames.length <= 1) return;
        
        state.frames.splice(state.currentFrame, 1);
        state.currentFrame = Math.min(state.currentFrame, state.frames.length - 1);
        
        // Update UI
        modal.querySelector('label').textContent = `Frame ${state.currentFrame + 1}/${state.frames.length}`;
        if (state.frames.length <= 1) {
            modal.querySelector('#deleteFrame').disabled = true;
        }
        
        this.#renderCreatorGrid(modal);
    }
    
    #saveTest(modal, isEdit) {
        const state = this.testCreatorState;
        
        // Validate
        if (!state.name.trim()) {
            alert('Please enter a test name');
            return;
        }
        
        // Create test object
        const test = {
            name: state.name.trim(),
            width: state.width,
            height: state.height,
            frames: state.frames
        };
        
        // Save to test manager
        if (isEdit) {
            this.testManager.updateTest(this.selectedTestIndex, test);
        } else {
            this.testManager.addTest(test);
        }
        
        // Close modal and refresh
        this.#closeTestCreator(modal);
        this.testResults = null;
        this.selectedTestIndex = null;
        this.#renderTestList();
        this.#renderTestDetail();
    }
    
    #closeTestCreator(modal) {
        modal.remove();
        this.testCreatorState = null;
    }
    
    /**
     * Refresh the test list (call this when tests are updated externally)
     */
    refresh() {
        this.testResults = null;
        this.#renderTestList();
        if (this.selectedTestIndex !== null) {
            this.#renderTestDetail();
        }
    }
}

