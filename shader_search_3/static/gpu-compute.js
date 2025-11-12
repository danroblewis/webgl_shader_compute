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
        this.gl = this.canvas.getContext('webgl2', {
            premultipliedAlpha: false,
            preserveDrawingBuffer: true
        });
        
        if (!this.gl) {
            throw new Error('WebGL 2 not supported');
        }
        
        // Enable color buffer float extension (needed for RGBA32F framebuffers)
        this.extensions = {
            colorBufferFloat: this.gl.getExtension('EXT_color_buffer_float')
        };
        
        if (!this.extensions.colorBufferFloat) {
            throw new Error('EXT_color_buffer_float extension not supported (required for float framebuffers)');
        }
        
        // Standard vertex shader for full-screen quad (WebGL 2 syntax)
        this.vertexShaderSource = `#version 300 es
            in vec2 a_position;
            out vec2 v_texCoord;
            
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
        // Convert WebGL 1 shader syntax to WebGL 2 if needed
        const convertedSource = this.#convertToWebGL2(fragmentSource);
        
        const vertexShader = this.#createShader(this.gl.VERTEX_SHADER, this.vertexShaderSource);
        const fragmentShader = this.#createShader(this.gl.FRAGMENT_SHADER, convertedSource);
        
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
        
        // WebGL 2 with EXT_color_buffer_float: use RGBA32F for maximum precision
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA32F,  // Sized internal format (requires EXT_color_buffer_float)
            width,
            height,
            0,
            this.gl.RGBA,     // Format
            this.gl.FLOAT,    // Type
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
        
        // Build a map of uniform types by querying all active uniforms
        const uniformTypeMap = new Map();
        const uniformCount = this.gl.getProgramParameter(kernel, this.gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
            const uniformInfo = this.gl.getActiveUniform(kernel, i);
            if (uniformInfo) {
                uniformTypeMap.set(uniformInfo.name, uniformInfo.type);
            }
        }
        
        for (const [name, value] of Object.entries(inputs)) {
            const location = this.gl.getUniformLocation(kernel, name);
            if (!location) continue;  // Uniform doesn't exist in shader
            
            if (value instanceof WebGLTexture) {
                // Bind texture uniform
                this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
                this.gl.bindTexture(this.gl.TEXTURE_2D, value);
                this.gl.uniform1i(location, textureUnit);
                textureUnit++;
            } else if (typeof value === 'number') {
                // Check uniform type from the map we built
                const uniformType = uniformTypeMap.get(name);
                if (uniformType) {
                    // Check if it's an integer type
                    const isIntType = uniformType === this.gl.INT || 
                                     uniformType === this.gl.SAMPLER_2D ||
                                     uniformType === this.gl.UNSIGNED_INT;
                    if (isIntType && Number.isInteger(value)) {
                        this.gl.uniform1i(location, value);
                    } else {
                        this.gl.uniform1f(location, value);
                    }
                } else {
                    // Fallback: use known integer uniforms or assume float
                    const knownIntUniforms = ['u_numCellTypes', 'u_totalRules'];
                    if (knownIntUniforms.includes(name) && Number.isInteger(value)) {
                        this.gl.uniform1i(location, value);
                    } else {
                        this.gl.uniform1f(location, value);
                    }
                }
            } else if (Array.isArray(value) || value instanceof Float32Array) {
                // Vector uniform - check type from map
                const uniformType = uniformTypeMap.get(name);
                if (uniformType) {
                    const isIntType = uniformType === this.gl.INT_VEC2 || 
                                     uniformType === this.gl.INT_VEC3 ||
                                     uniformType === this.gl.INT_VEC4;
                    if (isIntType && value instanceof Int32Array) {
                        switch (value.length) {
                            case 2: this.gl.uniform2iv(location, value); break;
                            case 3: this.gl.uniform3iv(location, value); break;
                            case 4: this.gl.uniform4iv(location, value); break;
                            default: this.gl.uniform1iv(location, value); break;
                        }
                    } else {
                        switch (value.length) {
                            case 2: this.gl.uniform2fv(location, value); break;
                            case 3: this.gl.uniform3fv(location, value); break;
                            case 4: this.gl.uniform4fv(location, value); break;
                            default: this.gl.uniform1fv(location, value); break;
                        }
                    }
                } else {
                    // Fallback: assume float
                    switch (value.length) {
                        case 2: this.gl.uniform2fv(location, value); break;
                        case 3: this.gl.uniform3fv(location, value); break;
                        case 4: this.gl.uniform4fv(location, value); break;
                        default: this.gl.uniform1fv(location, value); break;
                    }
                }
            } else if (value instanceof Int32Array) {
                // Integer array uniform
                this.gl.uniform1iv(location, value);
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
    
    #convertToWebGL2(source) {
        // If already has version directive, return as-is
        if (source.trim().startsWith('#version')) {
            return source;
        }
        
        // Convert WebGL 1 syntax to WebGL 2
        let converted = source;
        
        // Add version directive
        converted = `#version 300 es\n${converted}`;
        
        // Replace varying with in (for fragment shader)
        converted = converted.replace(/varying\s+/g, 'in ');
        
        // Replace texture2D with texture
        converted = converted.replace(/texture2D\s*\(/g, 'texture(');
        
        // Replace gl_FragColor with out variable
        if (converted.includes('gl_FragColor')) {
            // Add out declaration after precision
            const precisionMatch = converted.match(/(precision\s+\w+\s+float\s*;)/);
            if (precisionMatch) {
                const precisionLine = precisionMatch[1];
                converted = converted.replace(
                    precisionLine,
                    `${precisionLine}\nout vec4 fragColor;`
                );
            } else {
                // Add after version directive
                converted = converted.replace(
                    '#version 300 es\n',
                    '#version 300 es\nout vec4 fragColor;\n'
                );
            }
            
            // Replace gl_FragColor with fragColor
            converted = converted.replace(/gl_FragColor/g, 'fragColor');
        }
        
        return converted;
    }
    
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
        // Check if we have a cached framebuffer for this texture
        if (this.framebufferCache.has(texture)) {
            const cachedFramebuffer = this.framebufferCache.get(texture);
            
            // Verify the framebuffer is still valid by checking its status
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, cachedFramebuffer);
            const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
            
            if (status === this.gl.FRAMEBUFFER_COMPLETE) {
                // Framebuffer is valid, return it (it's already bound)
                return cachedFramebuffer;
            } else {
                // Framebuffer is invalid (texture was deleted), remove from cache and clean up
                this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); // Unbind before cleanup
                this.framebufferCache.delete(texture);
                const fbIndex = this.framebuffers.indexOf(cachedFramebuffer);
                if (fbIndex >= 0) {
                    this.framebuffers.splice(fbIndex, 1);
                }
                try {
                    this.gl.deleteFramebuffer(cachedFramebuffer);
                } catch (e) {
                    // Framebuffer already deleted or invalid
                }
            }
        }
        
        // Create new framebuffer
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
            // Clean up the framebuffer we just created
            this.gl.deleteFramebuffer(framebuffer);
            const statusNames = {
                0x8cd6: 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
                0x8cd7: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
                0x8cd9: 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS',
                0x8cdd: 'FRAMEBUFFER_UNSUPPORTED',
                0x8cdb: 'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE'
            };
            const statusName = statusNames[status] || 'UNKNOWN';
            throw new Error(`Framebuffer not complete: ${statusName} (0x${status.toString(16)})`);
        }
        
        this.framebuffers.push(framebuffer);
        this.framebufferCache.set(texture, framebuffer);
        return framebuffer;
    }
    
    /**
     * Delete a buffer and clean up its associated framebuffer
     * Use this instead of directly calling gl.deleteTexture() to ensure proper cleanup
     * @param {Buffer} texture - Texture buffer to delete
     */
    deleteBuffer(texture) {
        if (!texture) return
        
        // Clean up framebuffer if cached
        if (this.framebufferCache.has(texture)) {
            const framebuffer = this.framebufferCache.get(texture)
            this.framebufferCache.delete(texture)
            
            // Remove from framebuffers array
            const fbIndex = this.framebuffers.indexOf(framebuffer)
            if (fbIndex >= 0) {
                this.framebuffers.splice(fbIndex, 1)
            }
            
            // Unbind framebuffer if it's currently bound
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
            
            // Delete framebuffer
            try {
                this.gl.deleteFramebuffer(framebuffer)
            } catch (e) {
                // Already deleted or invalid
            }
        }
        
        // Remove from textures array
        const texIndex = this.textures.indexOf(texture)
        if (texIndex >= 0) {
            this.textures.splice(texIndex, 1)
        }
        
        // Delete texture
        try {
            this.gl.deleteTexture(texture)
        } catch (e) {
            // Already deleted or invalid
        }
    }
}

// Type aliases for documentation
/**
 * @typedef {WebGLProgram} Kernel - Compiled compute kernel
 * @typedef {WebGLTexture} Buffer - GPU memory buffer
 */

export { GPUCompute };

