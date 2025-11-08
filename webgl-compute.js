/**
 * WebGL Compute Library
 * A library for performing general-purpose GPU computations using WebGL
 */

class WebGLCompute {
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
    }
    
    /**
     * Create a shader from source
     */
    createShader(type, source) {
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
    
    /**
     * Create a program from vertex and fragment shader sources
     */
    createProgram(fragmentShaderSource, vertexShaderSource = null) {
        const vertexShader = this.createShader(
            this.gl.VERTEX_SHADER, 
            vertexShaderSource || this.vertexShaderSource
        );
        const fragmentShader = this.createShader(
            this.gl.FRAGMENT_SHADER, 
            fragmentShaderSource
        );
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(program);
            this.gl.deleteProgram(program);
            throw new Error(`Program linking error: ${error}`);
        }
        
        this.programs.push(program);
        return program;
    }
    
    /**
     * Create a float texture from data
     * @param {Float32Array} data - The data (or null for empty texture)
     * @param {number} width - Texture width
     * @param {number} height - Texture height (default 1)
     */
    createTexture(data, width, height = 1) {
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
        
        // Nearest neighbor filtering (no interpolation)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        
        this.textures.push(texture);
        return texture;
    }
    
    /**
     * Create a framebuffer with a texture attachment
     */
    createFramebuffer(texture) {
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
        return framebuffer;
    }
    
    /**
     * Run a computation
     * @param {Object} options - Computation options
     * @param {WebGLProgram} options.program - The shader program to use
     * @param {Object} options.uniforms - Uniform values (e.g., { u_texture: texture })
     * @param {WebGLTexture} options.output - Output texture
     * @param {number} options.width - Output width
     * @param {number} options.height - Output height (default 1)
     */
    compute({ program, uniforms = {}, output, width, height = 1 }) {
        // Create framebuffer for output
        const framebuffer = this.createFramebuffer(output);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
        
        // Use program
        this.gl.useProgram(program);
        
        // Set up position attribute
        const positionLocation = this.gl.getAttribLocation(program, 'a_position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
        
        // Set up uniforms
        let textureUnit = 0;
        for (const [name, value] of Object.entries(uniforms)) {
            const location = this.gl.getUniformLocation(program, name);
            
            if (value instanceof WebGLTexture) {
                // Bind texture uniform
                this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
                this.gl.bindTexture(this.gl.TEXTURE_2D, value);
                this.gl.uniform1i(location, textureUnit);
                textureUnit++;
            } else if (typeof value === 'number') {
                // Scalar uniform
                this.gl.uniform1f(location, value);
            } else if (Array.isArray(value)) {
                // Vector uniform
                switch (value.length) {
                    case 2: this.gl.uniform2fv(location, value); break;
                    case 3: this.gl.uniform3fv(location, value); break;
                    case 4: this.gl.uniform4fv(location, value); break;
                    default: throw new Error(`Unsupported vector length: ${value.length}`);
                }
            }
        }
        
        // Set viewport
        this.gl.viewport(0, 0, width, height);
        
        // Draw (triggers computation)
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        
        // Unbind framebuffer
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        
        return framebuffer;
    }
    
    /**
     * Read data from a texture
     * @param {WebGLTexture} texture - The texture to read from
     * @param {number} width - Texture width
     * @param {number} height - Texture height (default 1)
     * @returns {Float32Array} The data
     */
    readTexture(texture, width, height = 1) {
        // Create framebuffer for reading
        const framebuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
        this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.COLOR_ATTACHMENT0,
            this.gl.TEXTURE_2D,
            texture,
            0
        );
        
        // Read pixels
        const data = new Float32Array(width * height * 4);
        this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.FLOAT, data);
        
        // Cleanup
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.deleteFramebuffer(framebuffer);
        
        return data;
    }
    
    /**
     * Helper: Convert a 1D array to texture data (stores in red channel)
     */
    arrayToTextureData(array) {
        const data = new Float32Array(array.length * 4);
        for (let i = 0; i < array.length; i++) {
            data[i * 4] = array[i]; // Red channel
        }
        return data;
    }
    
    /**
     * Helper: Extract red channel from texture data to 1D array
     */
    textureDataToArray(data) {
        const array = new Float32Array(data.length / 4);
        for (let i = 0; i < array.length; i++) {
            array[i] = data[i * 4]; // Red channel
        }
        return array;
    }
    
    /**
     * High-level API: Run a computation on arrays
     * @param {Object} options
     * @param {string} options.shader - Fragment shader source
     * @param {Object} options.inputs - Input arrays (e.g., { a: [1,2,3], b: [4,5,6] })
     * @param {number} options.size - Number of elements to compute
     * @returns {Float32Array} Result array
     */
    async computeArrays({ shader, inputs, size }) {
        // Create program
        const program = this.createProgram(shader);
        
        // Create input textures
        const textureUniforms = {};
        for (const [name, array] of Object.entries(inputs)) {
            const textureData = this.arrayToTextureData(array);
            const texture = this.createTexture(textureData, size, 1);
            textureUniforms[`u_${name}`] = texture;
        }
        
        // Create output texture
        const outputTexture = this.createTexture(null, size, 1);
        
        // Run computation
        this.compute({
            program,
            uniforms: textureUniforms,
            output: outputTexture,
            width: size,
            height: 1
        });
        
        // Read result
        const resultData = this.readTexture(outputTexture, size, 1);
        return this.textureDataToArray(resultData);
    }
    
    /**
     * Compile a reusable shader program
     * @param {string} fragmentShaderSource - Fragment shader GLSL code
     * @returns {WebGLComputeShader} - Shader object with run() method
     */
    compile(fragmentShaderSource) {
        const program = this.createProgram(fragmentShaderSource);
        return new WebGLComputeShader(this, program);
    }
    
    /**
     * Clean up all resources
     */
    dispose() {
        // Delete programs
        this.programs.forEach(program => this.gl.deleteProgram(program));
        
        // Delete textures
        this.textures.forEach(texture => this.gl.deleteTexture(texture));
        
        // Delete framebuffers
        this.framebuffers.forEach(fb => this.gl.deleteFramebuffer(fb));
        
        // Delete position buffer
        this.gl.deleteBuffer(this.positionBuffer);
        
        // Clear arrays
        this.programs = [];
        this.textures = [];
        this.framebuffers = [];
    }
}

/**
 * WebGL Compute Shader
 * Represents a compiled shader program that can be executed multiple times
 */
class WebGLComputeShader {
    constructor(compute, program) {
        this.compute = compute;
        this.program = program;
    }
    
    /**
     * Run the shader with given inputs
     * @param {Object} inputs - Input arrays (e.g., { a: [1,2,3], b: [4,5,6] })
     * @param {number} size - Number of elements to compute
     * @returns {Float32Array} Result array
     */
    async run(inputs, size) {
        // Create input textures
        const textureUniforms = {};
        for (const [name, array] of Object.entries(inputs)) {
            const textureData = this.compute.arrayToTextureData(array);
            const texture = this.compute.createTexture(textureData, size, 1);
            textureUniforms[`u_${name}`] = texture;
        }
        
        // Create output texture
        const outputTexture = this.compute.createTexture(null, size, 1);
        
        // Run computation
        this.compute.compute({
            program: this.program,
            uniforms: textureUniforms,
            output: outputTexture,
            width: size,
            height: 1
        });
        
        // Read result
        const resultData = this.compute.readTexture(outputTexture, size, 1);
        return this.compute.textureDataToArray(resultData);
    }
}

// Export for use in modules or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WebGLCompute, WebGLComputeShader };
}

