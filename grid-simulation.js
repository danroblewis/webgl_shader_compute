/**
 * Grid Simulation (Layers 2 & 3)
 * High-level cellular automaton simulation with escape hatches
 * 
 * Layer 3 (High-Level): getCellState(), setCell(), step()
 * Layer 2 (Buffer Access): getCurrentBuffer(), getSnapshotBuffer()
 * Layer 1 (GPU Access): getTexture(), getContext(), getBuffers()
 */

import { GPUCompute } from './gpu-compute.js';

// Built-in rules
const RULES = {
    gameOfLife: `
        precision highp float;
        uniform sampler2D u_state;
        uniform float u_width;
        uniform float u_height;
        varying vec2 v_texCoord;
        
        void main() {
            float cellWidth = 1.0 / u_width;
            float cellHeight = 1.0 / u_height;
            
            // Count neighbors
            int neighbors = 0;
            for (int y = -1; y <= 1; y++) {
                for (int x = -1; x <= 1; x++) {
                    if (x == 0 && y == 0) continue;
                    
                    vec2 offset = vec2(float(x) * cellWidth, float(y) * cellHeight);
                    vec2 coord = v_texCoord + offset;
                    
                    // Wrap coordinates (toroidal topology)
                    coord = fract(coord);
                    
                    float cell = texture2D(u_state, coord).r;
                    if (cell > 0.5) neighbors++;
                }
            }
            
            float current = texture2D(u_state, v_texCoord).r;
            float alive = 0.0;
            
            // Conway's rules: B3/S23
            if (current > 0.5) {
                alive = (neighbors == 2 || neighbors == 3) ? 1.0 : 0.0;
            } else {
                alive = (neighbors == 3) ? 1.0 : 0.0;
            }
            
            gl_FragColor = vec4(alive, 0.0, 0.0, 1.0);
        }
    `,
    
    rule110: `
        precision highp float;
        uniform sampler2D u_state;
        uniform float u_width;
        varying vec2 v_texCoord;
        
        void main() {
            float cellWidth = 1.0 / u_width;
            
            // Sample neighbors with wrapping
            vec2 leftCoord = v_texCoord - vec2(cellWidth, 0.0);
            vec2 rightCoord = v_texCoord + vec2(cellWidth, 0.0);
            
            leftCoord.x = fract(leftCoord.x);
            rightCoord.x = fract(rightCoord.x);
            
            float left = texture2D(u_state, leftCoord).r;
            float center = texture2D(u_state, v_texCoord).r;
            float right = texture2D(u_state, rightCoord).r;
            
            // Rule 110: 01101110 in binary
            float sum = left * 4.0 + center * 2.0 + right;
            float result = 0.0;
            
            if (sum == 6.0 || sum == 5.0 || sum == 3.0 || sum == 2.0 || sum == 1.0) {
                result = 1.0;
            }
            
            gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
        }
    `
};

class GridSimulation {
    constructor(config) {
        this.width = config.width;
        this.height = config.height;
        this.wrap = config.wrap !== false;  // Default true
        this.generation = 0;
        
        // Initialize GPU compute
        this.compute = new GPUCompute(config.canvas);
        
        // Compile kernel
        const ruleSource = typeof config.rule === 'string' 
            ? RULES[config.rule] || RULES.gameOfLife
            : config.rule;
        
        this.kernel = this.compute.compileKernel(ruleSource);
        
        // Create ping-pong buffers
        this.buffer0 = this.compute.createBuffer(this.width, this.height);
        this.buffer1 = this.compute.createBuffer(this.width, this.height);
        
        this.inputBuffer = this.buffer0;
        this.outputBuffer = this.buffer1;
        
        // Layer 2: Buffer cache
        this.cachedBuffer = null;
        this.bufferDirty = true;
        
        // Initialize state
        if (config.initialState === 'random') {
            this.randomize(0.3);
        } else if (config.initialState instanceof Float32Array) {
            const data = new Float32Array(this.width * this.height);
            data.set(config.initialState);
            this.compute.upload(this.buffer0, data, this.width, this.height);
            this.bufferDirty = true;
        } else {
            // Default: empty
            this.clear();
        }
    }
    
    // ============================================
    // LAYER 3: High-Level Simulation API
    // ============================================
    
    /**
     * Get the state of a specific cell
     * Note: May trigger GPU download if buffer is stale
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Cell state (0.0 or 1.0)
     */
    getCellState(x, y) {
        if (this.bufferDirty) {
            this.#downloadBuffer();
        }
        
        return this.cachedBuffer[y * this.width + x];
    }
    
    /**
     * Set the state of a specific cell
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} value - Cell state (0.0 or 1.0)
     */
    setCell(x, y, value) {
        // Update GPU buffer directly
        const data = new Float32Array([value]);
        this.compute.uploadRegion(this.inputBuffer, data, x, y, 1, 1);
        
        // Invalidate cache
        this.bufferDirty = true;
    }
    
    /**
     * Fill a rectangular region
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {number} value - Fill value
     */
    fillRect(x, y, w, h, value) {
        const data = new Float32Array(w * h);
        data.fill(value);
        this.compute.uploadRegion(this.inputBuffer, data, x, y, w, h);
        this.bufferDirty = true;
    }
    
    /**
     * Fill a circular region (approximate)
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Radius
     * @param {number} value - Fill value
     */
    fillCircle(cx, cy, radius, value) {
        // Calculate bounding box
        const x0 = Math.max(0, Math.floor(cx - radius));
        const y0 = Math.max(0, Math.floor(cy - radius));
        const x1 = Math.min(this.width, Math.ceil(cx + radius));
        const y1 = Math.min(this.height, Math.ceil(cy + radius));
        
        const w = x1 - x0;
        const h = y1 - y0;
        const data = new Float32Array(w * h);
        
        // Fill pixels within circle
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const dx = (x0 + x) - cx;
                const dy = (y0 + y) - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist <= radius) {
                    data[y * w + x] = value;
                }
            }
        }
        
        this.compute.uploadRegion(this.inputBuffer, data, x0, y0, w, h);
        this.bufferDirty = true;
    }
    
    /**
     * Randomize grid with given probability
     * @param {number} probability - Probability of cell being alive (0-1)
     */
    randomize(probability = 0.5) {
        const data = new Float32Array(this.width * this.height);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() < probability ? 1.0 : 0.0;
        }
        this.compute.upload(this.inputBuffer, data, this.width, this.height);
        this.bufferDirty = true;
    }
    
    /**
     * Clear all cells to 0
     */
    clear() {
        const data = new Float32Array(this.width * this.height);
        this.compute.upload(this.inputBuffer, data, this.width, this.height);
        this.bufferDirty = true;
    }
    
    /**
     * Run simulation for N steps
     * PERFORMANCE: Pure GPU, no downloads
     * @param {number} count - Number of steps (default 1)
     */
    step(count = 1) {
        for (let i = 0; i < count; i++) {
            // Run kernel
            this.compute.run(
                this.kernel,
                {
                    u_state: this.inputBuffer,
                    u_width: this.width,
                    u_height: this.height
                },
                this.outputBuffer,
                this.width,
                this.height
            );
            
            // Swap buffers (ping-pong)
            [this.inputBuffer, this.outputBuffer] = [this.outputBuffer, this.inputBuffer];
            
            this.generation++;
            this.bufferDirty = true;
        }
    }
    
    /**
     * Reset simulation to generation 0
     */
    reset() {
        this.generation = 0;
        this.clear();
    }
    
    /**
     * Count cells matching a predicate
     * Note: Triggers GPU download
     * @param {Function} predicate - Function to test each cell
     * @returns {number} Count of matching cells
     */
    countWhere(predicate) {
        const buffer = this.getCurrentBuffer();
        let count = 0;
        for (let i = 0; i < buffer.length; i++) {
            if (predicate(buffer[i])) count++;
        }
        return count;
    }
    
    /**
     * Count alive cells (value > 0.5)
     * @returns {number} Number of alive cells
     */
    countAlive() {
        return this.countWhere(cell => cell > 0.5);
    }
    
    // ============================================
    // LAYER 2: Direct Buffer Access
    // ============================================
    
    /**
     * Get current state as Float32Array
     * PERFORMANCE: Returns cached buffer if available (no download)
     * The returned array is a REFERENCE - modifications affect the cache
     * @returns {Float32Array} Current state buffer
     */
    getCurrentBuffer() {
        if (this.bufferDirty) {
            this.#downloadBuffer();
        }
        return this.cachedBuffer;
    }
    
    /**
     * Force fresh download from GPU
     * Use this if you suspect the cache is stale
     * @returns {Float32Array} Fresh state buffer
     */
    getSnapshotBuffer() {
        this.#downloadBuffer();
        return this.cachedBuffer;
    }
    
    /**
     * Upload modified buffer back to GPU
     * Use this after modifying the buffer returned by getCurrentBuffer()
     * @param {Float32Array} buffer - Modified buffer
     */
    syncBuffer(buffer) {
        this.compute.upload(this.inputBuffer, buffer, this.width, this.height);
        this.cachedBuffer = buffer;
        this.bufferDirty = false;
    }
    
    /**
     * Check if buffer cache is stale (needs download)
     * @returns {boolean} True if buffer needs download
     */
    isBufferStale() {
        return this.bufferDirty;
    }
    
    /**
     * Invalidate buffer cache (force next access to re-download)
     */
    invalidateBufferCache() {
        this.bufferDirty = true;
    }
    
    // ============================================
    // LAYER 1: Raw GPU Resources
    // ============================================
    
    /**
     * Get current input texture (WebGLTexture)
     * Use for WebGL rendering or custom compute passes
     * @returns {WebGLTexture} Current state texture
     */
    getTexture() {
        return this.inputBuffer;
    }
    
    /**
     * Get both ping-pong textures
     * @returns {{input: WebGLTexture, output: WebGLTexture}} Buffer pair
     */
    getBuffers() {
        return {
            input: this.inputBuffer,
            output: this.outputBuffer
        };
    }
    
    /**
     * Get WebGL rendering context
     * @returns {WebGLRenderingContext} WebGL context
     */
    getContext() {
        return this.compute.getContext();
    }
    
    /**
     * Get compiled kernel program
     * @returns {WebGLProgram} Kernel program
     */
    getProgram() {
        return this.kernel;
    }
    
    /**
     * Get underlying compute engine
     * @returns {GPUCompute} Compute engine
     */
    getComputeEngine() {
        return this.compute;
    }
    
    /**
     * Clean up GPU resources
     */
    dispose() {
        this.compute.dispose();
    }
    
    // ============================================
    // Private Methods
    // ============================================
    
    #downloadBuffer() {
        if (!this.cachedBuffer) {
            this.cachedBuffer = new Float32Array(this.width * this.height);
        }
        
        this.compute.download(this.inputBuffer, this.cachedBuffer, this.width, this.height);
        this.bufferDirty = false;
    }
}

export { GridSimulation };

