/**
 * Simple utility to render a WebGL texture to a canvas
 * Uses the same vertex shader pattern as GPUCompute
 */

export class TextureRenderer {
  constructor(canvas, gl = null) {
    this.canvas = canvas
    // Use provided WebGL context or create a new one
    this.gl = gl || canvas.getContext('webgl2')
    if (!this.gl) {
      throw new Error('WebGL 2 not supported')
    }
    
    // Standard vertex shader (flip y-axis for texture coordinates)
    // WebGL textures have y=0 at bottom, but we want y=0 at top (like screen coordinates)
    this.vertexShaderSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        vec2 tex = a_position * 0.5 + 0.5;
        v_texCoord = vec2(tex.x, 1.0 - tex.y); // Flip y-axis
      }
    `
    
    // Create position buffer (full-screen quad)
    this.positionBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ])
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW)
    
    // Cache programs by fragment shader source
    this.programCache = new Map()
  }
  
  createProgram(vertexSource, fragmentSource) {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource)
    
    const program = this.gl.createProgram()
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program)
      this.gl.deleteProgram(program)
      throw new Error(`Program linking error: ${error}`)
    }
    
    return program
  }
  
  createShader(type, source) {
    const shader = this.gl.createShader(type)
    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader)
      this.gl.deleteShader(shader)
      throw new Error(`Shader compilation error: ${error}`)
    }
    return shader
  }
  
  render(texture, fragmentShaderSource) {
    if (!fragmentShaderSource) {
      throw new Error('Fragment shader source required')
    }
    
    // Get or create program from cache
    let program = this.programCache.get(fragmentShaderSource)
    if (!program) {
      program = this.createProgram(this.vertexShaderSource, fragmentShaderSource)
      this.programCache.set(fragmentShaderSource, program)
    }
    
    this.gl.useProgram(program)
    
    // Set up position attribute
    const positionLocation = this.gl.getAttribLocation(program, 'a_position')
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)
    
    // Bind texture
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    const textureLocation = this.gl.getUniformLocation(program, 'u_texture')
    if (textureLocation) {
      this.gl.uniform1i(textureLocation, 0)
    }
    
    // Set viewport
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    
    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }
  
  dispose() {
    // Clean up cached programs
    this.programCache.forEach(program => {
      this.gl.deleteProgram(program)
    })
    this.programCache.clear()
    
    this.gl.deleteBuffer(this.positionBuffer)
  }
}

