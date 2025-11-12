import React from 'react'
import { TextureRenderer } from '../utils/textureRenderer.js'
import { getCellTypesFromConfig } from '../utils/getCellTypesFromConfig.js'

export const SimulationPanel = ({ simulation, config, selectedCellType = 0, onCellTypeChange }) => {
  const [isPlaying, setIsPlaying] = React.useState(true)
  const [error, setError] = React.useState(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const displayCanvasRef = React.useRef(null)
  const rendererRef = React.useRef(null)
  const animationFrameRef = React.useRef(null)

  // Generate fragment shader for rendering based on available cell types
  const getFragmentShader = React.useCallback(() => {
    if (!config) return null
    
    const availableTypes = getCellTypesFromConfig(config)
    const colorPalette = availableTypes.map(ct => {
      // Convert hex color to RGB
      const hex = ct.color.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16) / 255.0
      const g = parseInt(hex.substr(2, 2), 16) / 255.0
      const b = parseInt(hex.substr(4, 2), 16) / 255.0
      return { id: ct.id, r, g, b, name: ct.name }
    })
    
    // Generate GLSL color mapping code
    const elseIfBlocks = colorPalette
      .filter(({ id }) => id !== 0) // Skip EMPTY (handled separately)
      .map(({ id, r, g, b, name }) => {
        const lower = id - 0.5
        const upper = id + 0.5
        return `  } else if (cellType >= ${lower.toFixed(1)} && cellType < ${upper.toFixed(1)}) {
    color = vec3(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}); // ${name}`
      })
    
    // Build the conditional block
    let conditionalBlock = `if (cellType < 0.5) {
    color = vec3(0.133, 0.133, 0.133); // EMPTY - #222222`
    if (elseIfBlocks.length > 0) {
      conditionalBlock += '\n' + elseIfBlocks.join('\n')
    }
    conditionalBlock += '\n  }'
    
    return `#version 300 es
precision highp float;

uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec4 texel = texture(u_texture, v_texCoord);
  float cellType = texel.r;
  
  // Map cell type to color
  vec3 color = vec3(0.133, 0.133, 0.133); // Default: EMPTY
${conditionalBlock}
  
  fragColor = vec4(color, 1.0);
}
`
  }, [config])

  // Render function
  const render = React.useCallback(() => {
    if (!simulation || !rendererRef.current) return
    
    try {
      const texture = simulation.getTexture()
      const fragmentShader = getFragmentShader()
      if (fragmentShader) {
        rendererRef.current.render(texture, fragmentShader)
      }
    } catch (err) {
      console.error('Render error:', err)
      setError(err.message)
    }
  }, [simulation, getFragmentShader])

  // Place a cell at the given screen coordinates
  const placeCellAtScreenCoords = React.useCallback((screenX, screenY) => {
    if (!simulation || !displayCanvasRef.current) return
    
    const canvas = displayCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = screenX - rect.left
    const y = screenY - rect.top
    
    // Convert screen coordinates to grid coordinates
    // Use rect dimensions to account for CSS scaling
    const gridX = Math.floor((x / rect.width) * simulation.width)
    const gridY = Math.floor((y / rect.height) * simulation.height)
    
    // Clamp to grid bounds
    const clampedX = Math.max(0, Math.min(simulation.width - 1, gridX))
    const clampedY = Math.max(0, Math.min(simulation.height - 1, gridY))
    
    // Create a Float32Array with the selected cell type ID in the first channel
    // Format: [typeId, 0, 0, 0] for RGBA
    const cellValue = new Float32Array([selectedCellType, 0, 0, 0])
    
    try {
      simulation.setCell(clampedX, clampedY, cellValue)
      // Mark buffer as dirty so next render will show the change
      simulation.bufferDirty = true
      render()
    } catch (err) {
      console.error('Failed to set cell:', err)
    }
  }, [simulation, selectedCellType, render])

  // Handle canvas mouse down (start painting)
  const handleCanvasMouseDown = React.useCallback((event) => {
    if (!simulation || !displayCanvasRef.current) return
    setIsDragging(true)
    placeCellAtScreenCoords(event.clientX, event.clientY)
  }, [simulation, placeCellAtScreenCoords])

  // Handle canvas mouse move (continue painting while dragging)
  const handleCanvasMouseMove = React.useCallback((event) => {
    if (!isDragging || !simulation || !displayCanvasRef.current) return
    placeCellAtScreenCoords(event.clientX, event.clientY)
  }, [isDragging, simulation, placeCellAtScreenCoords])

  // Handle canvas mouse up (stop painting)
  const handleCanvasMouseUp = React.useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle canvas mouse leave (stop painting if mouse leaves canvas)
  const handleCanvasMouseLeave = React.useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle window mouse up (stop painting if mouse is released anywhere)
  const handleWindowMouseUp = React.useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add window-level mouseup listener to handle dragging outside canvas
  React.useEffect(() => {
    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [handleWindowMouseUp])

  // Initialize renderer when canvas is ready
  React.useEffect(() => {
    if (!displayCanvasRef.current || !simulation) return

    try {
      // Use the simulation's canvas instead of creating a new one
      // This ensures we use the same WebGL context as the texture
      const simCanvas = simulation.compute.canvas
      if (!simCanvas) {
        throw new Error('Simulation canvas not found')
      }
      
      // Set canvas size for display
      simCanvas.width = 500
      simCanvas.height = 500
      
      // Replace the display canvas ref with the simulation canvas
      // and append it to the DOM if not already there
      const container = displayCanvasRef.current.parentElement
      if (container && !container.contains(simCanvas)) {
        // Remove the placeholder canvas
        if (displayCanvasRef.current.parentElement) {
          displayCanvasRef.current.parentElement.removeChild(displayCanvasRef.current)
        }
        // Add the simulation canvas
        container.appendChild(simCanvas)
        simCanvas.style.cssText = displayCanvasRef.current.style.cssText
        // Attach mouse handlers to the simulation canvas for click and drag
        simCanvas.addEventListener('mousedown', handleCanvasMouseDown)
        simCanvas.addEventListener('mousemove', handleCanvasMouseMove)
        simCanvas.addEventListener('mouseup', handleCanvasMouseUp)
        simCanvas.addEventListener('mouseleave', handleCanvasMouseLeave)
        displayCanvasRef.current = simCanvas
      } else if (container && container.contains(simCanvas)) {
        // Canvas already in DOM, just update ref and ensure handlers are attached
        // Remove old handlers if they exist, then add new ones
        simCanvas.removeEventListener('mousedown', handleCanvasMouseDown)
        simCanvas.removeEventListener('mousemove', handleCanvasMouseMove)
        simCanvas.removeEventListener('mouseup', handleCanvasMouseUp)
        simCanvas.removeEventListener('mouseleave', handleCanvasMouseLeave)
        simCanvas.addEventListener('mousedown', handleCanvasMouseDown)
        simCanvas.addEventListener('mousemove', handleCanvasMouseMove)
        simCanvas.addEventListener('mouseup', handleCanvasMouseUp)
        simCanvas.addEventListener('mouseleave', handleCanvasMouseLeave)
        displayCanvasRef.current = simCanvas
      }
      
      // Get WebGL context from simulation (same context as texture)
      const gl = simulation.compute.getContext()
      if (!gl) {
        throw new Error('Simulation does not have a WebGL context')
      }
      
      // Create renderer with the simulation's WebGL context and canvas
      rendererRef.current = new TextureRenderer(simCanvas, gl)
      
      // Render immediately
      const texture = simulation.getTexture()
      const fragmentShader = getFragmentShader()
      if (fragmentShader && texture) {
        rendererRef.current.render(texture, fragmentShader)
      }
    } catch (err) {
      console.error('Failed to initialize renderer:', err)
      setError(err.message)
    }
    
    return () => {
      // Remove mouse handlers on cleanup
      if (displayCanvasRef.current && displayCanvasRef.current.removeEventListener) {
        displayCanvasRef.current.removeEventListener('mousedown', handleCanvasMouseDown)
        displayCanvasRef.current.removeEventListener('mousemove', handleCanvasMouseMove)
        displayCanvasRef.current.removeEventListener('mouseup', handleCanvasMouseUp)
        displayCanvasRef.current.removeEventListener('mouseleave', handleCanvasMouseLeave)
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current = null
      }
    }
  }, [simulation, getFragmentShader, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasMouseLeave])

  // Animation loop
  React.useEffect(() => {
    if (!simulation || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const animate = () => {
      try {
        simulation.step(1)
        render()
        animationFrameRef.current = requestAnimationFrame(animate)
      } catch (err) {
        console.error('Simulation error:', err)
        setError(err.message)
        setIsPlaying(false)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [simulation, isPlaying, render])
  
  // Initial render when simulation is ready
  React.useEffect(() => {
    if (simulation && rendererRef.current) {
      render()
    }
  }, [simulation, render])

  if (error) {
    return (
      <div className="simulation-panel error">
        <h3>Simulation Error</h3>
        <pre>{error}</pre>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="simulation-panel empty">
        <p>Select an evolution configuration to run a simulation</p>
      </div>
    )
  }

  if (!simulation) {
    return (
      <div className="simulation-panel empty">
        <p>Initializing simulation...</p>
      </div>
    )
  }

  return (
    <div className="simulation-panel">
      <div className="simulation-header">
        <h3>{config.name}</h3>
        <div className="simulation-controls">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="play-pause-button"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (simulation) {
                simulation.reset()
                render()
              }
            }}
            className="reset-button"
          >
            Reset
          </button>
        </div>
      </div>
      <div className="simulation-content">
        {/* Canvas will be replaced by simulation canvas in useEffect */}
        <canvas
          ref={displayCanvasRef}
          width={500}
          height={500}
          style={{ 
            cursor: 'pointer',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '8px',
            display: 'block',
          }}
        />
      </div>
    </div>
  )
}
