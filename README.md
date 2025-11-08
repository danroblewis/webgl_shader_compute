# WebGL Compute Library

A simple, powerful library for performing general-purpose GPU computations using WebGL (GPGPU).

## Features

- 🚀 **Simple API** - Easy to use for both beginners and advanced users
- 🎯 **Zero Dependencies** - Pure JavaScript, no external libraries required
- 🔧 **Flexible** - Low-level control when needed, high-level convenience by default
- 📦 **Lightweight** - Small footprint, fast initialization
- 🧹 **Resource Management** - Automatic cleanup and resource tracking

## Quick Start

### Basic Usage

```javascript
// Initialize compute context
const compute = new WebGLCompute();

// Define your computation shader
const shader = `
    precision highp float;
    uniform sampler2D u_a;
    uniform sampler2D u_b;
    varying vec2 v_texCoord;
    
    void main() {
        float a = texture2D(u_a, v_texCoord).r;
        float b = texture2D(u_b, v_texCoord).r;
        gl_FragColor = vec4(a + b, 0.0, 0.0, 1.0);
    }
`;

// Run computation
const result = await compute.computeArrays({
    shader: shader,
    inputs: { 
        a: [1, 2, 3, 4], 
        b: [5, 6, 7, 8] 
    },
    size: 4
});

console.log(result); // [6, 8, 10, 12]

// Clean up
compute.dispose();
```

## API Reference

### Constructor

#### `new WebGLCompute(canvas?)`

Creates a new compute context.

- `canvas` (optional): HTMLCanvasElement - Existing canvas to use. If not provided, creates a new one.

**Throws:** Error if WebGL or required extensions are not supported.

### High-Level API (Recommended)

#### `computeArrays({ shader, inputs, size })`

Performs a computation on arrays and returns the result.

- `shader`: string - Fragment shader source code
- `inputs`: object - Input arrays (e.g., `{ a: [1,2,3], b: [4,5,6] }`)
- `size`: number - Number of elements to compute
- **Returns:** Float32Array - Result array

**Example:**

```javascript
const result = await compute.computeArrays({
    shader: `
        precision highp float;
        uniform sampler2D u_x;
        varying vec2 v_texCoord;
        
        void main() {
            float x = texture2D(u_x, v_texCoord).r;
            gl_FragColor = vec4(x * 2.0, 0.0, 0.0, 1.0);
        }
    `,
    inputs: { x: [1, 2, 3, 4, 5] },
    size: 5
});
```

### Low-Level API (Advanced)

#### `createProgram(fragmentShaderSource, vertexShaderSource?)`

Creates a WebGL program from shader sources.

- `fragmentShaderSource`: string - Fragment shader GLSL code
- `vertexShaderSource` (optional): string - Vertex shader GLSL code (uses default if not provided)
- **Returns:** WebGLProgram

#### `createTexture(data, width, height?)`

Creates a floating-point texture.

- `data`: Float32Array | null - Texture data in RGBA format (or null for empty texture)
- `width`: number - Texture width
- `height`: number - Texture height (default: 1)
- **Returns:** WebGLTexture

#### `compute({ program, uniforms, output, width, height })`

Runs a computation.

- `program`: WebGLProgram - Shader program to use
- `uniforms`: object - Uniform values (textures, scalars, vectors)
- `output`: WebGLTexture - Output texture
- `width`: number - Output width
- `height`: number - Output height (default: 1)
- **Returns:** WebGLFramebuffer - The framebuffer used

#### `readTexture(texture, width, height?)`

Reads data from a texture.

- `texture`: WebGLTexture - Texture to read from
- `width`: number - Texture width
- `height`: number - Texture height (default: 1)
- **Returns:** Float32Array - RGBA data

### Helper Methods

#### `arrayToTextureData(array)`

Converts a 1D array to RGBA texture data (stores in red channel).

#### `textureDataToArray(data)`

Extracts red channel from RGBA texture data to 1D array.

#### `dispose()`

Cleans up all GPU resources (programs, textures, framebuffers, buffers).

## Examples

### Example 1: Element-wise Addition

```javascript
const compute = new WebGLCompute();

const addShader = `
    precision highp float;
    uniform sampler2D u_a;
    uniform sampler2D u_b;
    varying vec2 v_texCoord;
    
    void main() {
        float a = texture2D(u_a, v_texCoord).r;
        float b = texture2D(u_b, v_texCoord).r;
        gl_FragColor = vec4(a + b, 0.0, 0.0, 1.0);
    }
`;

const a = [1, 2, 3, 4, 5];
const b = [10, 20, 30, 40, 50];

const result = await compute.computeArrays({
    shader: addShader,
    inputs: { a, b },
    size: 5
});

console.log(result); // [11, 22, 33, 44, 55]
```

### Example 2: Mathematical Expression

```javascript
const expressionShader = `
    precision highp float;
    uniform sampler2D u_x;
    varying vec2 v_texCoord;
    
    void main() {
        float x = texture2D(u_x, v_texCoord).r;
        float result = sin(x) * cos(x * 2.0) + 0.5;
        gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
    }
`;

const x = Array.from({ length: 100 }, (_, i) => i * 0.1);
const result = await compute.computeArrays({
    shader: expressionShader,
    inputs: { x },
    size: 100
});
```

### Example 3: Cellular Automata

```javascript
const caShader = `
    precision highp float;
    uniform sampler2D u_state;
    varying vec2 v_texCoord;
    
    void main() {
        float size = 256.0;
        float cellWidth = 1.0 / size;
        
        float left = texture2D(u_state, v_texCoord - vec2(cellWidth, 0.0)).r;
        float center = texture2D(u_state, v_texCoord).r;
        float right = texture2D(u_state, v_texCoord + vec2(cellWidth, 0.0)).r;
        
        float sum = left + center + right;
        float alive = (center > 0.5 && sum >= 2.0 && sum <= 3.0) ? 1.0 : 
                      (center < 0.5 && sum == 3.0) ? 1.0 : 0.0;
        
        gl_FragColor = vec4(alive, 0.0, 0.0, 1.0);
    }
`;

// Initialize state
const state = new Array(256).fill(0);
state[128] = 1; // Single cell

// Compute next generation
const nextState = await compute.computeArrays({
    shader: caShader,
    inputs: { state },
    size: 256
});
```

### Example 4: Advanced - Manual Control

```javascript
const compute = new WebGLCompute();

// Create program
const program = compute.createProgram(`
    precision highp float;
    uniform sampler2D u_input;
    uniform float u_scale;
    varying vec2 v_texCoord;
    
    void main() {
        float value = texture2D(u_input, v_texCoord).r;
        gl_FragColor = vec4(value * u_scale, 0.0, 0.0, 1.0);
    }
`);

// Create textures
const inputData = compute.arrayToTextureData([1, 2, 3, 4, 5]);
const inputTexture = compute.createTexture(inputData, 5, 1);
const outputTexture = compute.createTexture(null, 5, 1);

// Run computation
compute.compute({
    program: program,
    uniforms: {
        u_input: inputTexture,
        u_scale: 2.5
    },
    output: outputTexture,
    width: 5,
    height: 1
});

// Read results
const resultData = compute.readTexture(outputTexture, 5, 1);
const result = compute.textureDataToArray(resultData);

console.log(result); // [2.5, 5, 7.5, 10, 12.5]
```

## Requirements

- WebGL 1.0 support
- `OES_texture_float` extension
- `WEBGL_color_buffer_float` or `EXT_color_buffer_float` extension

These are supported by most modern browsers. The library will throw helpful errors if requirements are not met.

## Browser Support

- ✅ Chrome 56+
- ✅ Firefox 51+
- ✅ Safari 15+
- ✅ Edge 79+

## Performance Tips

1. **Reuse compute contexts** - Creating a new `WebGLCompute` instance has overhead
2. **Batch operations** - Process larger arrays when possible rather than many small ones
3. **Dispose properly** - Call `dispose()` when done to free GPU memory
4. **Use appropriate data types** - Consider precision requirements (highp vs mediump)

## Architecture

The library works by:

1. Converting input arrays to GPU textures (RGBA float format)
2. Running a fragment shader on a full-screen quad
3. Each pixel/fragment processes one element of your array
4. Reading the resulting texture back to CPU memory

This parallel execution can provide significant speedups for computational tasks, especially for large datasets (1000+ elements).

## Use Cases

- Numerical simulations
- Image processing
- Physics computations
- Machine learning inference
- Cellular automata
- Signal processing
- Mathematical operations on large datasets

## License

MIT

## Contributing

Contributions welcome! Feel free to submit issues and pull requests.

