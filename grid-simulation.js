/**
 * Grid Simulation (Layers 2 & 3)
 * High-level cellular automaton simulation with escape hatches
 * 
 * CELLS ARE RGBA vec4: Each cell has 4 float values [r, g, b, a]
 * Subclasses can interpret these however they want (e.g., binary, material types, etc.)
 * 
 * Layer 3 (High-Level): getCellState(), setCell(), step()
 * Layer 2 (Buffer Access): getCurrentBuffer(), getSnapshotBuffer()
 * Layer 1 (GPU Access): getTexture(), getContext(), getBuffers()
 */

import { GPUCompute } from './gpu-compute.js';

class GridSimulation {
    static CellType = {
        EMPTY: new Float32Array([0, 0, 0, 0])
    }

    constructor(config) {
        this.width = config.width;
        this.height = config.height;
        this.wrap = config.wrap !== false;  // Default true
        this.generation = 0;
        
        // Rule (GLSL shader) is required - this is the user's application logic
        if (!config.rule) {
            throw new Error('GridSimulation requires a "rule" (GLSL fragment shader source)');
        }
        
        // Initialize GPU compute
        this.compute = new GPUCompute(config.canvas);
        
        // Compile the user's shader
        this.kernel = this.compute.compileKernel(config.rule);
        
        // Create ping-pong buffers
        this.buffer0 = this.compute.createBuffer(this.width, this.height);
        this.buffer1 = this.compute.createBuffer(this.width, this.height);
        
        this.inputBuffer = this.buffer0;
        this.outputBuffer = this.buffer1;
        
        // Layer 2: Buffer cache (RGBA format: 4 floats per cell)
        this.cachedBuffer = null;
        this.bufferDirty = true;
        
        // Initialize state
        if (config.initialState === 'random') {
            this.randomize(0.3);
        } else if (config.initialState instanceof Float32Array) {
            // Assume initialState is already in RGBA format (4 floats per cell)
            const data = new Float32Array(this.width * this.height * 4);
            data.set(config.initialState);
            this.compute.upload(this.buffer0, data, this.width, this.height);
            this.bufferDirty = true;
        } else {
            // Default: empty (all zeros)
            this.clear();
        }
    }
    
    // ============================================
    // LAYER 3: High-Level Simulation API
    // ============================================
    
    /**
     * Get the state of a specific cell as RGBA vec4
     * Note: May trigger GPU download if buffer is stale
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Array<number>} Cell state as [r, g, b, a]
     */
    getCellState(x, y) {
        if (this.bufferDirty) {
            this.#downloadBuffer();
        }
        
        const index = (y * this.width + x) * 4;
        return [
            this.cachedBuffer[index],
            this.cachedBuffer[index + 1],
            this.cachedBuffer[index + 2],
            this.cachedBuffer[index + 3]
        ];
    }
    
    /**
     * Set the state of a specific cell from RGBA vec4
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Array<number>|Float32Array} value - Cell state as [r, g, b, a]
     */
    setCell(x, y, value) {
        // Ensure value is array-like with 4 components
        if (!value || value.length !== 4) {
            throw new Error('Cell value must be an array of 4 floats [r, g, b, a]');
        }
        
        // Update GPU buffer directly
        const data = new Float32Array(value);
        this.compute.uploadRegion(this.inputBuffer, data, x, y, 1, 1);
        
        // Invalidate cache
        this.bufferDirty = true;
    }
    
    /**
     * Fill a rectangular region with RGBA value
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {Array<number>|Float32Array} value - Fill value as [r, g, b, a]
     */
    fillRect(x, y, w, h, value) {
        if (!value || value.length !== 4) {
            throw new Error('Fill value must be an array of 4 floats [r, g, b, a]');
        }
        
        const data = new Float32Array(w * h * 4);
        for (let i = 0; i < w * h; i++) {
            data[i * 4] = value[0];
            data[i * 4 + 1] = value[1];
            data[i * 4 + 2] = value[2];
            data[i * 4 + 3] = value[3];
        }
        this.compute.uploadRegion(this.inputBuffer, data, x, y, w, h);
        this.bufferDirty = true;
    }
    
    /**
     * Fill a circular region (approximate) with RGBA value
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Radius
     * @param {Array<number>|Float32Array} value - Fill value as [r, g, b, a]
     */
    fillCircle(cx, cy, radius, value) {
        if (!value || value.length !== 4) {
            throw new Error('Fill value must be an array of 4 floats [r, g, b, a]');
        }
        
        // Calculate bounding box
        const x0 = Math.max(0, Math.floor(cx - radius));
        const y0 = Math.max(0, Math.floor(cy - radius));
        const x1 = Math.min(this.width, Math.ceil(cx + radius));
        const y1 = Math.min(this.height, Math.ceil(cy + radius));
        
        const w = x1 - x0;
        const h = y1 - y0;
        const data = new Float32Array(w * h * 4);
        
        // Fill pixels within circle
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const dx = (x0 + x) - cx;
                const dy = (y0 + y) - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist <= radius) {
                    const i = (y * w + x) * 4;
                    data[i] = value[0];
                    data[i + 1] = value[1];
                    data[i + 2] = value[2];
                    data[i + 3] = value[3];
                }
            }
        }
        
        this.compute.uploadRegion(this.inputBuffer, data, x0, y0, w, h);
        this.bufferDirty = true;
    }
    
    /**
     * Randomize grid with given probability (sets R channel to 0 or 1, others to 0)
     * Subclasses should override this for custom randomization
     */
    randomize() {
        const data = new Float32Array(this.width * this.height * 4);
        var cellTypes = Object.values(this.constructor.CellType);
        for (let i = 0; i < this.width * this.height; i++) {
            const idx = Math.floor(Math.random() % cellTypes.length);
            data.set(cellTypes[idx], i * 4);
        }
        this.compute.upload(this.inputBuffer, data, this.width, this.height);
        this.bufferDirty = true;
    }
    
    /**
     * Clear all cells to [0, 0, 0, 0]
     */
    clear() {
        const data = new Float32Array(this.width * this.height * 4);
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
    
    // ============================================
    // LAYER 2: Direct Buffer Access
    // ============================================
    
    /**
     * Get current state as Float32Array in RGBA format
     * PERFORMANCE: Returns cached buffer if available (no download)
     * The returned array is a REFERENCE - modifications affect the cache
     * Format: [r0, g0, b0, a0, r1, g1, b1, a1, ...] (4 floats per cell)
     * @returns {Float32Array} Current state buffer (width * height * 4 floats)
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
     * Format: [r0, g0, b0, a0, r1, g1, b1, a1, ...] (4 floats per cell)
     * @returns {Float32Array} Fresh state buffer (width * height * 4 floats)
     */
    getSnapshotBuffer() {
        this.#downloadBuffer();
        return this.cachedBuffer;
    }
    
    /**
     * Upload modified buffer back to GPU
     * Use this after modifying the buffer returned by getCurrentBuffer()
     * @param {Float32Array} buffer - Modified buffer (RGBA format, 4 floats per cell)
     */
    syncBuffer(buffer) {
        if (buffer.length !== this.width * this.height * 4) {
            throw new Error(`Buffer size mismatch. Expected ${this.width * this.height * 4} floats (RGBA), got ${buffer.length}`);
        }
        this.compute.upload(this.inputBuffer, buffer, this.width, this.height);
        this.cachedBuffer = buffer;
        this.bufferDirty = false;
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
            // RGBA format: 4 floats per cell
            this.cachedBuffer = new Float32Array(this.width * this.height * 4);
        }
        
        this.compute.download(this.inputBuffer, this.cachedBuffer, this.width, this.height);
        this.bufferDirty = false;
    }
}

export { GridSimulation };

