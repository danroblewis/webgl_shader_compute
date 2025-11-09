import { GridSimulation } from '../grid-simulation.js';
import { GPUCompute } from '../gpu-compute.js';

// Load template files
const defaultJS = await fetch('./template.js').then(r => r.text());
const defaultGLSL = await fetch('./template.glsl').then(r => r.text());

// LocalStorage keys
const STORAGE_KEYS = {
    JS_CODE: 'playground_js_code',
    GLSL_CODE: 'playground_glsl_code',
    BRUSH_SIZE: 'playground_brush_size',
    SPEED: 'playground_speed',
    IS_PLAYING: 'playground_is_playing',
    TEST_CASES: 'playground_test_cases'
};

// Load saved state from localStorage
function loadState() {
    return {
        jsCode: localStorage.getItem(STORAGE_KEYS.JS_CODE) || defaultJS,
        glslCode: localStorage.getItem(STORAGE_KEYS.GLSL_CODE) || defaultGLSL,
        brushSize: parseInt(localStorage.getItem(STORAGE_KEYS.BRUSH_SIZE)) || 3,
        speed: parseInt(localStorage.getItem(STORAGE_KEYS.SPEED)) || 1,
        isPlaying: localStorage.getItem(STORAGE_KEYS.IS_PLAYING) === 'true'
    };
}

// Save state to localStorage
function saveState() {
    if (jsEditor && glslEditor) {
        localStorage.setItem(STORAGE_KEYS.JS_CODE, jsEditor.getValue());
        localStorage.setItem(STORAGE_KEYS.GLSL_CODE, glslEditor.getValue());
    }
    localStorage.setItem(STORAGE_KEYS.BRUSH_SIZE, brushSize.toString());
    localStorage.setItem(STORAGE_KEYS.SPEED, stepsPerFrame.toString());
    localStorage.setItem(STORAGE_KEYS.IS_PLAYING, (!isPaused).toString());
}

// Clear saved state
function clearState() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}

// Test Cases Management
function loadTestCases() {
    const data = localStorage.getItem(STORAGE_KEYS.TEST_CASES);
    return data ? JSON.parse(data) : [];
}

function saveTestCases(testCases) {
    localStorage.setItem(STORAGE_KEYS.TEST_CASES, JSON.stringify(testCases));
}

function saveTestCase() {
    if (!sim) {
        alert('No simulation running!');
        return;
    }
    
    // Capture current state
    const buffer = sim.getCurrentBuffer();
    const cellData = Array.from(buffer); // Convert to regular array for JSON
    
    // Capture canvas as thumbnail (scaled down for storage efficiency)
    const thumbnail = canvas.toDataURL('image/png', 0.7);
    
    // Create test case
    const testCase = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        cellData: cellData,
        thumbnail: thumbnail,
        generation: sim.generation
    };
    
    // Save to localStorage
    const testCases = loadTestCases();
    testCases.push(testCase);
    saveTestCases(testCases);
    
    // Re-render test cases
    renderTestCases();
    
    console.log('✅ Test case saved!', testCase.id);
}

function loadTestCase(testCaseId) {
    const testCases = loadTestCases();
    const testCase = testCases.find(tc => tc.id === testCaseId);
    
    if (!testCase || !sim) return;
    
    // Restore cell data
    const buffer = sim.getCurrentBuffer();
    const cellData = new Float32Array(testCase.cellData);
    buffer.set(cellData);
    sim.syncBuffer(buffer);
    
    // Start playing
    isPaused = false;
    document.getElementById('playToggle').checked = true;
    
    // Render
    render();
    
    console.log('✅ Test case loaded!', testCaseId);
}

function deleteTestCase(testCaseId, event) {
    event.stopPropagation(); // Prevent loading the test case when clicking delete
    
    const testCases = loadTestCases();
    const filtered = testCases.filter(tc => tc.id !== testCaseId);
    saveTestCases(filtered);
    
    renderTestCases();
    
    console.log('🗑 Test case deleted!', testCaseId);
}

function renderTestCases() {
    const grid = document.getElementById('testCasesGrid');
    const testCases = loadTestCases();
    
    grid.innerHTML = '';
    
    testCases.forEach(testCase => {
        const card = document.createElement('div');
        card.className = 'test-case-card';
        card.title = `Generation ${testCase.generation}\n${new Date(testCase.timestamp).toLocaleString()}`;
        
        const img = document.createElement('img');
        img.src = testCase.thumbnail;
        img.alt = `Test case ${testCase.id}`;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'test-case-delete';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => deleteTestCase(testCase.id, e);
        
        card.appendChild(img);
        card.appendChild(deleteBtn);
        card.onclick = () => loadTestCase(testCase.id);
        
        grid.appendChild(card);
    });
}

// Monaco Editor setup
let jsEditor, glslEditor;

require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
    const savedState = loadState();
    
    glslEditor = monaco.editor.create(document.getElementById('glslEditor'), {
        value: savedState.glslCode,
        language: 'cpp', // Use C++ for GLSL syntax highlighting
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 11,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 4
    });

    jsEditor = monaco.editor.create(document.getElementById('jsEditor'), {
        value: savedState.jsCode,
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 11,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 4
    });

    // Auto-recompile with 0.5-second debounce
    let recompileTimeout = null;
    const scheduleRecompile = () => {
        clearTimeout(recompileTimeout);
        recompileTimeout = setTimeout(() => {
            compileAndRun();
        }, 500);
    };

    glslEditor.onDidChangeModelContent(() => {
        scheduleRecompile();
    });

    jsEditor.onDidChangeModelContent(() => {
        scheduleRecompile();
    });

    // Initialize controls with saved state
    brushSize = savedState.brushSize;
    stepsPerFrame = savedState.speed;
    document.getElementById('brushSlider').value = brushSize;
    document.getElementById('brushValue').textContent = brushSize;
    document.getElementById('speedSlider').value = stepsPerFrame;
    document.getElementById('speedValue').textContent = stepsPerFrame;

    // Auto-save state every 5 seconds
    setInterval(() => {
        saveState();
    }, 5000);

    // Initial compile
    compileAndRun();
    
    // Load and render test cases
    renderTestCases();
});

// Canvas setup
const SIZE = 128;
const DISPLAY_SIZE = 360;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = SIZE;
offscreenCanvas.height = SIZE;
const offscreenCtx = offscreenCanvas.getContext('2d');

// State
let sim = null;
let SimulationClass = null;
let materialColors = {};
let currentMaterial = null;
let brushSize = 3;
let stepsPerFrame = 1;
let isDrawing = false;
let isPaused = true;
let lastTime = 0;
let generationCount = 0;
let hzTime = 0;

// Error handling
function showError(message) {
    const container = document.getElementById('errorContainer');
    container.innerHTML = `<div class="error">${message}</div>`;
}

function clearError() {
    document.getElementById('errorContainer').innerHTML = '';
}

// Compile and run simulation
async function compileAndRun() {
    try {
        clearError();
        
        if (!jsEditor || !glslEditor) {
            return; // Editors not ready yet
        }
        
        const jsCode = jsEditor.getValue();
        const glslCode = glslEditor.getValue();
        
        // Save current cell data before disposing
        let savedBuffer = null;
        if (sim) {
            try {
                const currentBuffer = sim.getCurrentBuffer();
                savedBuffer = new Float32Array(currentBuffer);
            } catch (e) {
                console.warn('Could not save buffer:', e);
            }
            sim.dispose();
            sim = null;
        }
        
        // Create simulation class
        const classCode = `
            ${jsCode}
            return PlaygroundSimulation;
        `;
        
        SimulationClass = new Function('GridSimulation', classCode)(GridSimulation);
        
        // Check if CellType is defined
        if (!SimulationClass.CellType) {
            throw new Error('CellType static property must be defined');
        }
        
        // Create simulation instance
        sim = new SimulationClass({
            width: SIZE,
            height: SIZE,
            rule: glslCode,
            initialState: 'empty'
        });
        
        // Restore previous cell data if available, or randomize on first load
        if (savedBuffer) {
            try {
                const newBuffer = sim.getCurrentBuffer();
                newBuffer.set(savedBuffer);
                sim.syncBuffer(newBuffer);
            } catch (e) {
                console.warn('Could not restore buffer:', e);
            }
        } else {
            // First load: randomize
            if (typeof sim.randomize === 'function') {
                sim.randomize();
            }
            // Check if we have a saved play state, otherwise default to playing
            const savedState = loadState();
            const shouldPlay = savedBuffer === null ? true : savedState.isPlaying;
            isPaused = !shouldPlay;
            document.getElementById('playToggle').checked = shouldPlay;
        }
        
        // Setup cell types
        setupCellTypes();
        
        // Initial render
        render();
        
        console.log('✅ Simulation compiled successfully!');
    } catch (error) {
        showError(`Compilation Error:\n${error.message}\n\n${error.stack}`);
        console.error('Compilation error:', error);
    }
}

// Generate color palette
function generateColorPalette(name, index, total) {
    // Predefined colors for common cell types
    const predefinedColors = {
        EMPTY: [0, 0, 0],
        ALIVE: [50, 255, 50],
        DEAD: [0, 0, 0],
        SAND: [194, 178, 128],
        WATER: [64, 164, 223],
        OIL: [139, 69, 19],
        STONE: [128, 128, 128],
        WOOD: [139, 90, 43],
        FIRE: [255, 100, 0],
        STEAM: [200, 200, 255],
        LAVA: [255, 69, 0]
    };
    
    if (predefinedColors[name]) {
        return predefinedColors[name];
    }
    
    // Generate color using HSL for better distribution
    const hue = (index * 360 / total) % 360;
    const saturation = 70 + (index % 3) * 10;
    const lightness = 50 + (index % 2) * 10;
    
    // Convert HSL to RGB
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;
    
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function setupCellTypes() {
    const grid = document.getElementById('celltypeGrid');
    grid.innerHTML = '';
    
    materialColors = {};
    let firstCellType = null;
    
    const cellTypeEntries = Object.entries(SimulationClass.CellType);
    
    cellTypeEntries.forEach(([name, value], index) => {
        const cellValue = value[0]; // R channel
        const color = generateColorPalette(name, index, cellTypeEntries.length);
        materialColors[cellValue] = color;
        
        if (!firstCellType) firstCellType = value;
        
        const btn = document.createElement('button');
        btn.className = 'celltype-btn';
        btn.textContent = name;
        btn.dataset.celltype = cellValue;
        // Use linear gradient with semi-transparent black overlay to darken the color
        btn.style.background = `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.celltype-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMaterial = value;
        });
        grid.appendChild(btn);
    });
    
    // Select first cell type
    if (firstCellType) {
        currentMaterial = firstCellType;
        grid.querySelector('.celltype-btn').classList.add('active');
    }
}

// Render
function render() {
    if (!sim) return;
    
    const buffer = sim.getCurrentBuffer();
    const imageData = offscreenCtx.createImageData(SIZE, SIZE);
    
    for (let cellIdx = 0; cellIdx < SIZE * SIZE; cellIdx++) {
        const bufferIdx = cellIdx * 4;
        const material = Math.round(buffer[bufferIdx]);
        const color = materialColors[material] || [255, 0, 255];
        const imageIdx = cellIdx * 4;
        imageData.data[imageIdx] = color[0];
        imageData.data[imageIdx + 1] = color[1];
        imageData.data[imageIdx + 2] = color[2];
        imageData.data[imageIdx + 3] = 255;
    }
    
    offscreenCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(offscreenCanvas, 0, 0, SIZE, SIZE, 0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
}

// Animation loop
function animate(currentTime) {
    requestAnimationFrame(animate);
    
    if (!sim || isPaused) return;
    
    // Run multiple steps per frame based on speed slider
    for (let i = 0; i < stepsPerFrame; i++) {
        sim.step();
    }
    render();
    
    // Update stats - track generations per second
    generationCount += stepsPerFrame;
    const deltaTime = currentTime - hzTime;
    if (deltaTime >= 1000) {
        document.getElementById('fps').textContent = Math.round(generationCount / (deltaTime / 1000));
        generationCount = 0;
        hzTime = currentTime;
    }
    
    document.getElementById('generation').textContent = sim.generation;
}

requestAnimationFrame(animate);

// Drawing
function getGridCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / rect.width * SIZE);
    const y = Math.floor((e.clientY - rect.top) / rect.height * SIZE);
    return { x, y };
}

function placeMaterial(x, y) {
    if (!sim || !currentMaterial) return;
    
    const buffer = sim.getCurrentBuffer();
    for (let dy = -brushSize; dy <= brushSize; dy++) {
        for (let dx = -brushSize; dx <= brushSize; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= brushSize) {
                const px = x + dx;
                const py = y + dy;
                if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
                    const cellIdx = py * SIZE + px;
                    const bufferIdx = cellIdx * 4;
                    buffer.set(currentMaterial, bufferIdx);
                }
            }
        }
    }
    sim.syncBuffer(buffer);
    render();
}

canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    const { x, y } = getGridCoords(e);
    placeMaterial(x, y);
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const { x, y } = getGridCoords(e);
    placeMaterial(x, y);
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
});

canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
});

// Controls
document.getElementById('brushSlider').addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
    document.getElementById('brushValue').textContent = brushSize;
});

document.getElementById('speedSlider').addEventListener('input', (e) => {
    stepsPerFrame = parseInt(e.target.value);
    document.getElementById('speedValue').textContent = stepsPerFrame;
});

document.getElementById('playToggle').addEventListener('change', (e) => {
    if (!sim) return;
    isPaused = !e.target.checked;
});

document.getElementById('stepBtn').addEventListener('click', () => {
    if (!sim) return;
    sim.step();
    render();
    document.getElementById('generation').textContent = sim.generation;
});

document.getElementById('clearBtn').addEventListener('click', () => {
    if (!sim) return;
    sim.clear();
    render();
});

document.getElementById('randomizeBtn').addEventListener('click', () => {
    if (!sim) return;
    if (typeof sim.randomize === 'function') {
        sim.randomize();
    }
    render();
});

document.getElementById('saveTestBtn').addEventListener('click', () => {
    saveTestCase();
});

document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset to default template? This will clear your current code and saved state.')) {
        return;
    }
    
    if (jsEditor && glslEditor) {
        jsEditor.setValue(defaultJS);
        glslEditor.setValue(defaultGLSL);
    }
    sim = null;
    SimulationClass = null;
    isPaused = true;
    document.getElementById('playToggle').checked = false;
    ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
    document.getElementById('celltypeGrid').innerHTML = '';
    document.getElementById('generation').textContent = '0';
    document.getElementById('fps').textContent = '-';
    clearError();
    clearState(); // Clear saved state
});

