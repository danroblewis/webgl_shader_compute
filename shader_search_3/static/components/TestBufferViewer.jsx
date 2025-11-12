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
  const texturesRef = React.useRef([]) // Array of textures, one per frame index
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [bufferInfo, setBufferInfo] = React.useState(null)

  // Combine all test cases into buffers for each frame index
  const combineTestCases = React.useCallback((testGroups, frameIndex) => {
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

    // Find maximum dimensions across all test cases
    let maxWidth = 0
    let maxHeight = 0
    for (const test of allTestCases) {
      if (test.width > maxWidth) {
        maxWidth = test.width
      }
      if (test.height > maxHeight) {
        maxHeight = test.height
      }
    }

    if (maxWidth === 0 || maxHeight === 0) {
      return null
    }

    // Calculate total width: sum of all test case max widths + 5 empty cells between each
    const spacing = 5
    const totalWidth = allTestCases.length * maxWidth + (allTestCases.length - 1) * spacing

    // Create combined buffer (RGBA: 4 floats per cell)
    const combinedBuffer = new Float32Array(totalWidth * maxHeight * 4)

    // Fill buffer with test case data
    // Use the frame at the specified frameIndex, or empty cells if that frame doesn't exist
    let currentX = 0
    for (const test of allTestCases) {
      // Use the frame at frameIndex, or create empty frame if it doesn't exist
      const frame = test.frames[frameIndex] || null
      
      // Copy frame data into combined buffer, padding with empty cells if needed
      // Frame is stored as 2D array: frame[y][x] = [r, g, b, a]
      // But frame might be Float32Array or regular array, convert to array
      // If frame doesn't exist, fill with empty cells
      for (let y = 0; y < maxHeight; y++) {
        const row = frame && y < test.height ? frame[y] : null
        for (let x = 0; x < maxWidth; x++) {
          const dstIndex = (y * totalWidth + (currentX + x)) * 4
          
          // Check if this position is within the test case bounds
          if (x < test.width && y < test.height && row) {
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
            } else if (cell !== null && cell !== undefined) {
              // Single value
              r = Number(cell) || 0
              g = 0
              b = 0
              a = 0
            } else {
              // Empty cell
              r = 0
              g = 0
              b = 0
              a = 0
            }
            
            combinedBuffer[dstIndex] = r
            combinedBuffer[dstIndex + 1] = g
            combinedBuffer[dstIndex + 2] = b
            combinedBuffer[dstIndex + 3] = a
          } else {
            // Outside test case bounds - fill with empty cell
            combinedBuffer[dstIndex] = 0
            combinedBuffer[dstIndex + 1] = 0
            combinedBuffer[dstIndex + 2] = 0
            combinedBuffer[dstIndex + 3] = 0
          }
        }
      }
      
      // Add spacing (5 empty cells) between test cases
      currentX += maxWidth
      if (currentX < totalWidth) {
        for (let y = 0; y < maxHeight; y++) {
          for (let x = 0; x < spacing; x++) {
            const dstIndex = (y * totalWidth + (currentX + x)) * 4
            combinedBuffer[dstIndex] = 0 // Empty cell
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
      height: maxHeight,
      numTestCases: allTestCases.length,
      testCaseWidth: maxWidth,
      testCaseHeight: maxHeight,
      skippedTestCases: [],
      totalTestCases: allTestCases.length,
      frameIndex: frameIndex
    }
  }, [])

  // Get maximum frame count across all test cases
  const getMaxFrameCount = React.useCallback((testGroups) => {
    let maxFrames = 0
    for (const group of testGroups || []) {
      if (group.tests && Array.isArray(group.tests)) {
        for (const test of group.tests) {
          if (test.frames && test.frames.length > maxFrames) {
            maxFrames = test.frames.length
          }
        }
      }
    }
    return maxFrames
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
  const getFragmentShader = React.useCallback((totalWidth, totalHeight) => {
    return `#version 300 es
precision highp float;

uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec4 texel = texture(u_texture, v_texCoord);
  float cellType = texel.r;
  
  float width = ${totalWidth}.0;
  float height = ${totalHeight}.0;
  
  // Convert texture coordinates to pixel coordinates
  float pixelX = v_texCoord.x * width;
  float pixelY = v_texCoord.y * height;
  
  // Calculate which cell we're in (each cell is 1x1 pixel in the texture)
  float cellX = floor(pixelX);
  float cellY = floor(pixelY);
  
  // Calculate position within the cell (0.0 to 1.0)
  float xInCell = pixelX - cellX;
  float yInCell = pixelY - cellY;
  
  // Border width: 1 pixel = 1.0 in pixel space, so 1.0/width in texture space
  // But we want a visible border, so use a small fraction like 0.1 of a cell
  float borderWidth = 0.1;
  
  // Check if we're at the edge of a cell
  bool isBorder = (xInCell < borderWidth || xInCell > 1.0 - borderWidth) ||
                  (yInCell < borderWidth || yInCell > 1.0 - borderWidth);
  
  if (isBorder) {
    // Draw black border
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    // Simple color mapping
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
}
`
  }, [])

  // Initialize and create buffers for all frame indices
  React.useEffect(() => {
    if (!canvasRef.current || !groups || groups.length === 0) return

    setLoading(true)
    setError(null)

    try {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      // Get maximum frame count
      const maxFrames = getMaxFrameCount(groups)
      if (maxFrames === 0) {
        setError('No test cases found')
        setLoading(false)
        return
      }


      // Create buffers for each frame index
      const allBufferData = []
      for (let frameIdx = 0; frameIdx < maxFrames; frameIdx++) {
        const bufferData = combineTestCases(groups, frameIdx)
        if (bufferData) {
          allBufferData.push(bufferData)
        }
      }

      if (allBufferData.length === 0) {
        setError('No test cases found')
        setLoading(false)
        return
      }

      // Use first buffer for initial info
      const firstBuffer = allBufferData[0]
      setBufferInfo({
        totalWidth: firstBuffer.width,
        height: firstBuffer.height,
        numTestCases: firstBuffer.numTestCases,
        testCaseWidth: firstBuffer.testCaseWidth,
        skippedTestCases: [],
        totalTestCases: firstBuffer.totalTestCases || firstBuffer.numTestCases,
        maxFrames: maxFrames
      })

      // Set canvas size to fit all frames stacked vertically
      // IMPORTANT: Set canvas size BEFORE creating renderer, as changing canvas size resets WebGL context
      const frameDisplayHeight = 500 // Height per frame
      const frameDisplayWidth = (firstBuffer.width / firstBuffer.height) * frameDisplayHeight
      const totalDisplayHeight = maxFrames * frameDisplayHeight
      canvas.width = frameDisplayWidth
      canvas.height = totalDisplayHeight
      
      // Recreate renderer after canvas size change (canvas size change resets WebGL context)
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current = null
      }
      rendererRef.current = new TextureRenderer(canvas)
      const gl = rendererRef.current.gl

      // Create textures for all frame buffers
      const textures = []
      for (const bufferData of allBufferData) {
        const texture = createTexture(bufferData, gl)
        if (texture) {
          textures.push(texture)
        } else {
          console.warn('Failed to create texture for buffer:', bufferData)
        }
      }
      
      if (textures.length === 0) {
        throw new Error('No textures were created')
      }
      
      console.log(`Created ${textures.length} textures for ${maxFrames} frames`)

      // Clean up old textures
      if (texturesRef.current.length > 0) {
        for (const oldTexture of texturesRef.current) {
          gl.deleteTexture(oldTexture)
        }
      }
      texturesRef.current = textures

      // Renderer already created above

      // Render all frames stacked vertically
      const fragmentShader = getFragmentShader(firstBuffer.width, firstBuffer.height)
      // Reuse frameDisplayHeight and frameDisplayWidth from above
      
      // Clear canvas
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      
      // Get the program (we'll use it directly to control viewport)
      let program = rendererRef.current.programCache.get(fragmentShader)
      if (!program) {
        program = rendererRef.current.createProgram(rendererRef.current.vertexShaderSource, fragmentShader)
        rendererRef.current.programCache.set(fragmentShader, program)
      }
      
      gl.useProgram(program)
      
      // Set up position attribute
      const positionLocation = gl.getAttribLocation(program, 'a_position')
      if (positionLocation < 0) {
        throw new Error('Position attribute not found in shader')
      }
      gl.enableVertexAttribArray(positionLocation)
      gl.bindBuffer(gl.ARRAY_BUFFER, rendererRef.current.positionBuffer)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
      
      // Bind texture uniform
      const textureLocation = gl.getUniformLocation(program, 'u_texture')
      if (!textureLocation) {
        throw new Error('Texture uniform not found in shader')
      }
      
      // Render each texture at its vertical position
      // Frame 0 should be at top, frame N-1 at bottom
      // WebGL viewport y=0 is at bottom, so we render from bottom to top
      for (let i = 0; i < textures.length; i++) {
        // Calculate viewport Y from bottom (frame 0 = top = highest Y)
        // For frame i, we want it at position: (maxFrames - 1 - i) * frameDisplayHeight from bottom
        const frameFromBottom = textures.length - 1 - i
        const viewportY = frameFromBottom * frameDisplayHeight
        gl.viewport(0, viewportY, frameDisplayWidth, frameDisplayHeight)
        
        // Bind texture
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, textures[i])
        if (textureLocation) {
          gl.uniform1i(textureLocation, 0)
        }
        
        // Check for WebGL errors before drawing
        let glError = gl.getError()
        if (glError !== gl.NO_ERROR) {
          console.warn(`WebGL error before drawing frame ${i}:`, glError)
        }
        
        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        
        // Check for WebGL errors after drawing
        glError = gl.getError()
        if (glError !== gl.NO_ERROR) {
          console.warn(`WebGL error after drawing frame ${i}:`, glError)
        }
      }
      
      console.log(`Rendered ${textures.length} frames stacked vertically`)
      
      // Reset viewport to full canvas
      gl.viewport(0, 0, canvas.width, canvas.height)

      setLoading(false)
    } catch (err) {
      console.error('Failed to render test buffer:', err)
      setError(err.message)
      setLoading(false)
    }

    return () => {
      if (texturesRef.current.length > 0 && rendererRef.current) {
        const gl = rendererRef.current.gl
        for (const texture of texturesRef.current) {
          gl.deleteTexture(texture)
        }
        texturesRef.current = []
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current = null
      }
    }
  }, [groups, combineTestCases, createTexture, getFragmentShader, getMaxFrameCount])


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
            {bufferInfo.maxFrames > 1 && (
              <span style={{ marginLeft: '0.5rem' }}>
                ({bufferInfo.maxFrames} frames stacked vertically)
              </span>
            )}
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


