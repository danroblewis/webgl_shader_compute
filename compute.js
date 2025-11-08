function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

function createTexture(gl, data, width, height) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Upload data to texture
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,                  // mip level
        gl.RGBA,           // internal format
        width,
        height,
        0,                  // border
        gl.RGBA,           // format
        gl.FLOAT,          // type
        data
    );
    
    // Set texture parameters (no filtering, no wrapping)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    return texture;
}

async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

async function main() {
    const canvas = document.getElementById('glCanvas');
    const gl = canvas.getContext('webgl');
    
    if (!gl) {
        alert('WebGL not supported');
        return;
    }

    // Enable float textures extension (required for computation)
    const floatTextureExt = gl.getExtension('OES_texture_float');
    if (!floatTextureExt) {
        alert('Float textures not supported');
        return;
    }

    // Enable float color buffer extension (required for reading back float data)
    const floatColorBufferExt = gl.getExtension('WEBGL_color_buffer_float') || 
                                 gl.getExtension('EXT_color_buffer_float');
    if (!floatColorBufferExt) {
        alert('Float color buffers not supported. This extension is required to read computation results.');
        return;
    }

    // Load shaders from external files
    const vertexShaderSource = await loadShader('vertex.glsl');
    const fragmentShaderSource = await loadShader('fragment.glsl');

    // Create shaders and program
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    // Set up vertex buffer (full-screen quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Prepare input data (two arrays to add)
    const size = 256; // We'll add 256 numbers
    const arrayA = new Float32Array(size * 4); // RGBA format, so 4 values per pixel
    const arrayB = new Float32Array(size * 4);
    
    // Fill with sample data (store in red channel for simplicity)
    for (let i = 0; i < size; i++) {
        arrayA[i * 4] = i;           // Red channel: 0, 1, 2, 3, ...
        arrayB[i * 4] = i * 2;       // Red channel: 0, 2, 4, 6, ...
    }

    // Create textures from input data
    const textureA = createTexture(gl, arrayA, size, 1);
    const textureB = createTexture(gl, arrayB, size, 1);

    // Create output texture and framebuffer for rendering
    const outputTexture = createTexture(gl, null, size, 1);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        outputTexture,
        0
    );

    // Check if framebuffer is complete
    const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
        alert('Framebuffer not complete: ' + fbStatus.toString(16));
        return;
    }

    // Use the program
    gl.useProgram(program);

    // Set up attribute
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set up uniforms (bind textures)
    const textureALocation = gl.getUniformLocation(program, 'u_textureA');
    const textureBLocation = gl.getUniformLocation(program, 'u_textureB');
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureA);
    gl.uniform1i(textureALocation, 0);
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textureB);
    gl.uniform1i(textureBLocation, 1);

    // Set viewport
    gl.viewport(0, 0, size, 1);

    // Draw (this triggers the computation)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Read back results from the framebuffer
    const results = new Float32Array(size * 4);
    gl.readPixels(0, 0, size, 1, gl.RGBA, gl.FLOAT, results);

    // Unbind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Display results
    let output = '<h3>Input Arrays and GPU Computation Results:</h3>';
    output += '<pre>';
    output += 'Index | Array A | Array B | GPU Result (A+B) | Expected\n';
    output += '------|---------|---------|------------------|----------\n';
    
    // Show first 20 results
    for (let i = 0; i < Math.min(20, size); i++) {
        const a = arrayA[i * 4];
        const b = arrayB[i * 4];
        const result = results[i * 4];
        const expected = a + b;
        const match = Math.abs(result - expected) < 0.001 ? '✓' : '✗';
        output += `${i.toString().padStart(5)} | ${a.toString().padStart(7)} | ${b.toString().padStart(7)} | ${result.toString().padStart(16)} | ${expected.toString().padStart(8)} ${match}\n`;
    }
    
    output += '...\n';
    output += '</pre>';
    
    // Verify all results
    let allCorrect = true;
    for (let i = 0; i < size; i++) {
        const expected = arrayA[i * 4] + arrayB[i * 4];
        const actual = results[i * 4];
        if (Math.abs(actual - expected) > 0.001) {
            allCorrect = false;
            break;
        }
    }
    
    output += `<p><strong>All ${size} computations ${allCorrect ? 'passed ✓' : 'failed ✗'}</strong></p>`;
    output += `<p>The GPU computed ${size} additions in a single draw call!</p>`;
    
    document.getElementById('results').innerHTML = output;
}

// Run when page loads
window.onload = main;

