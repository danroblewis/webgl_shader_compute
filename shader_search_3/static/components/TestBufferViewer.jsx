import React from 'react'
import { TextureRenderer } from '../utils/textureRenderer.js'

const API_BASE = '/api'

/**
 * Component to combine all test cases into a single wide texture buffer
 * and render it to a canvas for review
 */
export const TestBufferViewer = ({ groups = [] }) => {
  const canvasRef = React.useRef(null)
  const rendererRef = React.useRef(null)
  const textureRef = React.useRef(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [bufferInfo, setBufferInfo] = React.useState(null)

  // Combine all test cases into a single buffer
  const combineTestCases = React.useCallback((testGroups) => {
    if (!testGroups || testGroups.length === 0) {
      return null
    }

    // Collect all test cases from all groups
    const allTestCases = []
    for (const group of testGroups) {
      if (group.tests && Array.isArray(group.tests)) {
        for (const test of group.tests) {
          if (test.frames && test.frames.length > 0) {
            allTestCases.push(test)
          }
        }
      }
    }

    if (allTestCases.length === 0) {
      return null
    }

    // Validate all test cases have the same dimensions
    const firstTest = allTestCases[0]
    const width = firstTest.width
    const height = firstTest.height
    const numFrames = firstTest.frames.length

    for (const test of allTestCases) {
      if (test.width !== width || test.height !== height) {
        throw new Error(`Test case dimensions mismatch: expected ${width}x${height}, got ${test.width}x${test.height}`)
      }
      if (test.frames.length !== numFrames) {
        throw new Error(`Test case frame count mismatch: expected ${numFrames}, got ${test.frames.length}`)
      }
    }

    // Calculate total width: sum of all test case widths + 5 empty cells between each
    const spacing = 5
    const totalWidth = allTestCases.length * width + (allTestCases.length - 1) * spacing

    // Create combined buffer (RGBA: 4 floats per cell)
    const combinedBuffer = new Float32Array(totalWidth * height * 4)

    // Fill buffer with test case data
    let currentX = 0
    for (const test of allTestCases) {
      // For now, use the first frame of each test case
      // TODO: might want to support selecting which frame or combining all frames
      const frame = test.frames[0]
      
      // Copy frame data into combined buffer
      // Frame is stored as 2D array: frame[y][x] = [r, g, b, a]
      // But frame might be Float32Array or regular array, convert to array
      for (let y = 0; y < height; y++) {
        const row = frame[y]
        for (let x = 0; x < width; x++) {
          const dstIndex = (y * totalWidth + (currentX + x)) * 4
          
          // Get cell value - handle both Float32Array and regular arrays
          const cell = row[x]
          let r, g, b, a
          if (cell instanceof Float32Array) {
            r = cell[0] || 0
            g = cell[1] || 0
            b = cell[2] || 0
            a = cell[3] || 0
          } else if (Array.isArray(cell)) {
            r = cell[0] || 0
            g = cell[1] || 0
            b = cell[2] || 0
            a = cell[3] || 0
          } else {
            // Single value
            r = Number(cell) || 0
            g = 0
            b = 0
            a = 0
          }
          
          combinedBuffer[dstIndex] = r
          combinedBuffer[dstIndex + 1] = g
          combinedBuffer[dstIndex + 2] = b
          combinedBuffer[dstIndex + 3] = a
        }
      }

      // Add spacing (5 empty cells) after each test case (except the last)
      currentX += width
      if (currentX < totalWidth) {
        // Fill spacing with empty cells (0, 0, 0, 0)
        for (let y = 0; y < height; y++) {
          for (let s = 0; s < spacing; s++) {
            const dstIndex = (y * totalWidth + (currentX + s)) * 4
            combinedBuffer[dstIndex] = 0
            combinedBuffer[dstIndex + 1] = 0
            combinedBuffer[dstIndex + 2] = 0
            combinedBuffer[dstIndex + 3] = 0
          }
        }
        currentX += spacing
      }
    }

    return {
      buffer: combinedBuffer,
      width: totalWidth,
      height: height,
      numTestCases: allTestCases.length,
      testCaseWidth: width,
      testCaseHeight: height
    }
  }, [])

  // Create texture from combined buffer
  const createTexture = React.useCallback((bufferData, gl) => {
    if (!bufferData || !gl) return null

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)

    // Use RGBA32F format for float textures
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      bufferData.width,
      bufferData.height,
      0,
      gl.RGBA,
      gl.FLOAT,
      bufferData.buffer
    )

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    return texture
  }, [])

  // Generate fragment shader for rendering (same as SimulationPanel)
  const getFragmentShader = React.useCallback(() => {
    // For now, use a simple shader that maps cell type values to colors
    // We can enhance this later to match the simulation panel's color mapping
    return `#version 300 es
precision highp float;

uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec4 texel = texture(u_texture, v_texCoord);
  float cellType = texel.r;
  
  // Simple color mapping (can be enhanced later)
  vec3 color = vec3(0.133, 0.133, 0.133); // Default: EMPTY - #222222
  if (cellType >= 0.5 && cellType < 1.5) {
    color = vec3(0.961, 0.518, 0.227); // SAND - orange
  } else if (cellType >= 1.5 && cellType < 2.5) {
    color = vec3(0.298, 0.686, 0.922); // WATER - blue
  } else if (cellType >= 2.5 && cellType < 3.5) {
    color = vec3(0.741, 0.741, 0.741); // STONE - gray
  }
  
  fragColor = vec4(color, 1.0);
}
`
  }, [])

  // Initialize and render buffer
  React.useEffect(() => {
    if (!canvasRef.current || !groups || groups.length === 0) return

    setLoading(true)
    setError(null)

    try {
      const canvas = canvasRef.current
      const gl = canvas.getContext('webgl2')
      if (!gl) {
        throw new Error('WebGL 2 not supported')
      }

      // Combine test cases
      const bufferData = combineTestCases(groups)
      if (!bufferData) {
        setError('No test cases found')
        setLoading(false)
        return
      }

      setBufferInfo({
        totalWidth: bufferData.width,
        height: bufferData.height,
        numTestCases: bufferData.numTestCases,
        testCaseWidth: bufferData.testCaseWidth
      })

      // Set canvas size
      const displayHeight = 500 // Fixed display height
      const displayWidth = (bufferData.width / bufferData.height) * displayHeight
      canvas.width = displayWidth
      canvas.height = displayHeight

      // Create texture from buffer
      const texture = createTexture(bufferData, gl)
      if (!texture) {
        throw new Error('Failed to create texture')
      }
      textureRef.current = texture

      // Create renderer
      const renderer = new TextureRenderer(canvas, gl)
      rendererRef.current = renderer

      // Render texture
      const fragmentShader = getFragmentShader()
      renderer.render(texture, fragmentShader)

      setLoading(false)
    } catch (err) {
      console.error('Failed to render test buffer:', err)
      setError(err.message)
      setLoading(false)
    }

    return () => {
      if (textureRef.current && rendererRef.current) {
        const gl = rendererRef.current.gl
        gl.deleteTexture(textureRef.current)
        textureRef.current = null
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current = null
      }
    }
  }, [groups, combineTestCases, createTexture, getFragmentShader])

  if (loading) {
    return (
      <div className="test-buffer-viewer">
        <p>Loading test buffer...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="test-buffer-viewer error">
        <h3>Error</h3>
        <pre>{error}</pre>
      </div>
    )
  }

  return (
    <div className="test-buffer-viewer">
      <div className="test-buffer-header">
        <h3>Test Cases Buffer</h3>
        {bufferInfo && (
          <div className="buffer-info">
            <span>Width: {bufferInfo.totalWidth}</span>
            <span>Height: {bufferInfo.height}</span>
            <span>Test Cases: {bufferInfo.numTestCases}</span>
          </div>
        )}
      </div>
      <div className="test-buffer-content">
        <canvas
          ref={canvasRef}
          style={{
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '8px',
            display: 'block',
            maxWidth: '100%',
            height: 'auto'
          }}
        />
      </div>
    </div>
  )
}

