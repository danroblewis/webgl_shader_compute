import { GridSimulation } from '../grid-simulation.js';
import { GPUCompute } from '../gpu-compute.js';

// Load template files
const defaultJS = await fetch('./template.js').then(r => r.text());
const defaultGLSL = await fetch('./template.glsl').then(r => r.text());

// Monaco Editor setup
let jsEditor, glslEditor;

require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
    jsEditor = monaco.editor.create(document.getElementById('jsEditor'), {
        value: defaultJS,
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 4
    });

    glslEditor = monaco.editor.create(document.getElementById('glslEditor'), {
        value: defaultGLSL,
        language: 'cpp', // Use C++ for GLSL syntax highlighting
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 4
    });
});

// Canvas setup
const SIZE = 128;
const DISPLAY_SIZE = 512;
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
let isDrawing = false;
let isPaused = true;
let lastTime = 0;
let frameCount = 0;
let fpsTime = 0;

// Error handling
function showError(message) {
    const container = document.getElementById('errorContainer');
    container.innerHTML = `<div class="error">${message}</div>`;
}

function clearError() {
    document.getElementById('errorContainer').innerHTML = '';
}

// Run simulation
document.getElementById('runBtn').addEventListener('click', async () => {
    try {
        clearError();
        
        if (!jsEditor || !glslEditor) {
            throw new Error('Editors not initialized yet');
        }
        
        const jsCode = jsEditor.getValue();
        const glslCode = glslEditor.getValue();
        
        // Create simulation class
        const classCode = `
            class PlaygroundSimulation extends GridSimulation {
                ${jsCode}
            }
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
        
        // Setup materials
        setupMaterials();
        
        // Initial render
        render();
        
        console.log('✅ Simulation compiled successfully!');
    } catch (error) {
        showError(`Compilation Error:\n${error.message}\n\n${error.stack}`);
        console.error('Compilation error:', error);
    }
});

// Setup materials from CellType
function setupMaterials() {
    const grid = document.getElementById('materialsGrid');
    grid.innerHTML = '';
    
    // Default colors for common materials
    const defaultColors = {
        EMPTY: [0, 0, 0],
        SAND: [194, 178, 128],
        WATER: [64, 164, 223],
        OIL: [139, 69, 19],
        STONE: [128, 128, 128],
        WOOD: [139, 90, 43]
    };
    
    materialColors = {};
    let firstMaterial = null;
    
    Object.entries(SimulationClass.CellType).forEach(([name, value]) => {
        const materialValue = value[0]; // R channel
        materialColors[materialValue] = defaultColors[name] || [255, 0, 255];
        
        if (name !== 'EMPTY') {
            if (!firstMaterial) firstMaterial = value;
            
            const btn = document.createElement('button');
            btn.className = 'material-btn';
            btn.textContent = name;
            btn.dataset.material = materialValue;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.material-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMaterial = value;
            });
            grid.appendChild(btn);
        }
    });
    
    // Select first material
    if (firstMaterial) {
        currentMaterial = firstMaterial;
        grid.querySelector('.material-btn').classList.add('active');
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
    
    sim.step();
    render();
    
    // Update stats
    frameCount++;
    const deltaTime = currentTime - fpsTime;
    if (deltaTime >= 1000) {
        document.getElementById('fps').textContent = Math.round(frameCount / (deltaTime / 1000));
        frameCount = 0;
        fpsTime = currentTime;
    }
    
    document.getElementById('generation').textContent = sim.generation;
}

requestAnimationFrame(animate);

// Drawing
function getGridCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / DISPLAY_SIZE * SIZE);
    const y = Math.floor((e.clientY - rect.top) / DISPLAY_SIZE * SIZE);
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

document.getElementById('playBtn').addEventListener('click', () => {
    if (!sim) return;
    isPaused = false;
    document.getElementById('playBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
});

document.getElementById('pauseBtn').addEventListener('click', () => {
    isPaused = true;
    document.getElementById('playBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
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

document.getElementById('resetBtn').addEventListener('click', () => {
    if (jsEditor && glslEditor) {
        jsEditor.setValue(defaultJS);
        glslEditor.setValue(defaultGLSL);
    }
    sim = null;
    SimulationClass = null;
    isPaused = true;
    document.getElementById('playBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
    document.getElementById('materialsGrid').innerHTML = '';
    document.getElementById('generation').textContent = '0';
    document.getElementById('fps').textContent = '-';
    clearError();
});

