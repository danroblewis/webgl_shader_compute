/**
 * GPU Compute Engine (Layer 1)
 * Low-level GPU compute operations using WebGL
 * 
 * Users should typically use GridSimulation (Layer 2/3) instead.
 * This layer is exposed for:
 * - Custom compute kernels
 * - WebGL interop
 * - Performance-critical code
 */

class GPUCompute {
    constructor(canvas = null) {
        // Create or use provided canvas
        this.canvas = canvas || document.createElement('canvas');
        this.gl = this.canvas.getContext('webgl', {
            premultipliedAlpha: false,
            preserveDrawingBuffer: true
        });
        
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }
        
        // Enable required extensions
        this.extensions = {
            floatTexture: this.gl.getExtension('OES_texture_float'),
            floatColorBuffer: this.gl.getExtension('WEBGL_color_buffer_float') || 
                            this.gl.getExtension('EXT_color_buffer_float')
        };
        
        if (!this.extensions.floatTexture) {
            throw new Error('Float textures not supported');
        }
        
        if (!this.extensions.floatColorBuffer) {
            throw new Error('Float color buffers not supported (required for readback)');
        }
        
        // Standard vertex shader for full-screen quad
        this.vertexShaderSource = `
            attribute vec2 a_position;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_position * 0.5 + 0.5;
            }
        `;
        
        // Create position buffer (full-screen quad)
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        
        // Track resources for cleanup
        this.programs = [];
        this.textures = [];
        this.framebuffers = [];
        
        // PERFORMANCE: Cache framebuffers by texture to avoid recreation
        this.framebufferCache = new Map();
    }
    
    /**
     * Compile a compute kernel from GLSL source
     * @param {string} fragmentSource - Fragment shader source (compute logic)
     * @returns {Kernel} Compiled kernel (WebGLProgram)
     */
    compileKernel(fragmentSource) {
        const vertexShader = this.#createShader(this.gl.VERTEX_SHADER, this.vertexShaderSource);
        const fragmentShader = this.#createShader(this.gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(program);
            this.gl.deleteProgram(program);
            throw new Error(`Kernel linking error: ${error}`);
        }
        
        this.programs.push(program);
        return program;
    }
    
    /**
     * Create a GPU buffer (texture)
     * @param {number} width - Buffer width
     * @param {number} height - Buffer height
     * @param {Float32Array} [data] - Initial data (optional)
     * @returns {Buffer} GPU buffer (WebGLTexture)
     */
    createBuffer(width, height, data = null) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA,
            width,
            height,
            0,
            this.gl.RGBA,
            this.gl.FLOAT,
            data
        );
        
        // Nearest neighbor filtering (no interpolation for compute)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        
        this.textures.push(texture);
        return texture;
    }
    
    /**
     * Run a compute kernel
     * @param {Kernel} kernel - Compiled kernel (from compileKernel)
     * @param {Object} inputs - Input buffers and uniforms { name: buffer/value }
     * @param {Buffer} output - Output buffer
     * @param {number} width - Output width
     * @param {number} height - Output height
     */
    run(kernel, inputs, output, width, height) {
        // PERFORMANCE: Get cached framebuffer (avoids recreation)
        const framebuffer = this.#getOrCreateFramebuffer(output);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
        
        // Use program
        this.gl.useProgram(kernel);
        
        // Set up position attribute
        const positionLocation = this.gl.getAttribLocation(kernel, 'a_position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
        
        // Set up uniforms
        let textureUnit = 0;
        for (const [name, value] of Object.entries(inputs)) {
            const location = this.gl.getUniformLocation(kernel, name);
            
            if (value instanceof WebGLTexture) {
                // Bind texture uniform
                this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
                this.gl.bindTexture(this.gl.TEXTURE_2D, value);
                this.gl.uniform1i(location, textureUnit);
                textureUnit++;
            } else if (typeof value === 'number') {
                // Scalar uniform
                this.gl.uniform1f(location, value);
            } else if (Array.isArray(value) || value instanceof Float32Array) {
                // Vector uniform
                switch (value.length) {
                    case 2: this.gl.uniform2fv(location, value); break;
                    case 3: this.gl.uniform3fv(location, value); break;
                    case 4: this.gl.uniform4fv(location, value); break;
                    default: this.gl.uniform1fv(location, value); break;
                }
            }
        }
        
        // Set viewport
        this.gl.viewport(0, 0, width, height);
        
        // Run computation (draw call triggers fragment shader)
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        
        // Unbind framebuffer
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    
    /**
     * Download data from GPU buffer to CPU
     * @param {Buffer} buffer - GPU buffer to read from
     * @param {Float32Array} dest - Destination array
     * @param {number} width - Buffer width
     * @param {number} height - Buffer height
     */
    download(buffer, dest, width, height) {
        // Bind buffer to framebuffer for reading
        const framebuffer = this.#getOrCreateFramebuffer(buffer);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
        
        // Check if destination expects RGBA data or single-channel
        if (dest.length === width * height * 4) {
            // Destination expects full RGBA data, read directly
            this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.FLOAT, dest);
        } else {
            // Destination expects single-channel data, extract red channel
            const tempBuffer = new Float32Array(width * height * 4);
            this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.FLOAT, tempBuffer);
            
            // Extract red channel to destination
            for (let i = 0; i < width * height; i++) {
                dest[i] = tempBuffer[i * 4];
            }
        }
        
        // Unbind framebuffer
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    
    /**
     * Upload data from CPU to GPU buffer
     * @param {Buffer} buffer - GPU buffer to write to
     * @param {Float32Array} src - Source data
     * @param {number} width - Buffer width
     * @param {number} height - Buffer height
     */
    upload(buffer, src, width, height) {
        let packed;
        
        // Check if data is already in RGBA format (4 floats per cell)
        if (src.length === width * height * 4) {
            // Data is already RGBA-packed, use directly
            packed = src;
        } else {
            // Pack single-channel data into RGBA format (store in red channel)
            packed = new Float32Array(width * height * 4);
            for (let i = 0; i < src.length; i++) {
                packed[i * 4] = src[i];  // Red channel
                // Green, blue, alpha stay 0
            }
        }
        
        this.gl.bindTexture(this.gl.TEXTURE_2D, buffer);
        this.gl.texSubImage2D(
            this.gl.TEXTURE_2D,
            0,
            0,
            0,
            width,
            height,
            this.gl.RGBA,
            this.gl.FLOAT,
            packed
        );
    }
    
    /**
     * Upload data to a region of a GPU buffer
     * PERFORMANCE: Use this for small updates instead of full upload
     * @param {Buffer} buffer - GPU buffer
     * @param {Float32Array} src - Source data
     * @param {number} x - X offset
     * @param {number} y - Y offset
     * @param {number} width - Region width
     * @param {number} height - Region height
     */
    uploadRegion(buffer, src, x, y, width, height) {
        let packed;
        
        // Check if data is already in RGBA format (4 floats per cell)
        if (src.length === width * height * 4) {
            // Data is already RGBA-packed, use directly
            packed = src;
        } else {
            // Pack single-channel data into RGBA format
            packed = new Float32Array(width * height * 4);
            for (let i = 0; i < src.length; i++) {
                packed[i * 4] = src[i];
            }
        }
        
        this.gl.bindTexture(this.gl.TEXTURE_2D, buffer);
        this.gl.texSubImage2D(
            this.gl.TEXTURE_2D,
            0,
            x,
            y,
            width,
            height,
            this.gl.RGBA,
            this.gl.FLOAT,
            packed
        );
    }
    
    /**
     * Get WebGL rendering context
     * @returns {WebGLRenderingContext}
     */
    getContext() {
        return this.gl;
    }
    
    /**
     * Clean up all GPU resources
     */
    dispose() {
        this.programs.forEach(p => this.gl.deleteProgram(p));
        this.textures.forEach(t => this.gl.deleteTexture(t));
        this.framebuffers.forEach(fb => this.gl.deleteFramebuffer(fb));
        this.gl.deleteBuffer(this.positionBuffer);
        
        this.programs = [];
        this.textures = [];
        this.framebuffers = [];
        this.framebufferCache.clear();
    }
    
    // ============================================
    // Private Methods
    // ============================================
    
    #createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error(`Shader compilation error: ${error}`);
        }
        return shader;
    }
    
    #getOrCreateFramebuffer(texture) {
        if (this.framebufferCache.has(texture)) {
            return this.framebufferCache.get(texture);
        }
        
        const framebuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
        this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.COLOR_ATTACHMENT0,
            this.gl.TEXTURE_2D,
            texture,
            0
        );
        
        const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
        if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Framebuffer not complete: ${status.toString(16)}`);
        }
        
        this.framebuffers.push(framebuffer);
        this.framebufferCache.set(texture, framebuffer);
        return framebuffer;
    }
}

// Type aliases for documentation
/**
 * @typedef {WebGLProgram} Kernel - Compiled compute kernel
 * @typedef {WebGLTexture} Buffer - GPU memory buffer
 */

export { GPUCompute };

