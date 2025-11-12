/**
 * Fitness Evaluator
 * Evaluates rule sets by running simulations and comparing with expected results
 */

import { ruleSetToGLSL } from './ruleSetToGLSL.js'

/**
 * Create a fitness evaluation function
 * @param {Object} options
 * @param {Array} options.testGroups - Test case groups
 * @param {GPUCompute} options.gpuCompute - GPU compute instance (shared, reused)
 * @param {TestEvaluator} options.testEvaluator - Test evaluator instance
 * @param {Object} options.baseConfig - Base evolution config (for grid_simulation_code)
 * @param {number} options.simulationSteps - Number of simulation steps to run
 * @returns {Function} Async function that takes a ruleSet and returns fitness score (0-1)
 */
export function createFitnessEvaluator({ testGroups, gpuCompute, testEvaluator, baseConfig, simulationSteps = 1 }) {
  // Cache for compiled kernels (keyed by shader source)
  const kernelCache = new Map()
  
  return async (ruleSet) => {
    try {
      // Generate GLSL shader from rule set
      const glslShader = ruleSetToGLSL(ruleSet)
      
      // Combine test cases to get initial state (frame 0)
      const initialBufferData = combineTestCases(testGroups, 0)
      if (!initialBufferData) {
        return 0.0 // No test cases
      }
      
      // Get or compile kernel (cache by shader source to avoid recompiling)
      let kernel = kernelCache.get(glslShader)
      if (!kernel) {
        kernel = gpuCompute.compileKernel(glslShader)
        kernelCache.set(glslShader, kernel)
      }
      
      // Create input and output buffers using the shared GPUCompute instance
      const inputTexture = gpuCompute.createBuffer(
        initialBufferData.width,
        initialBufferData.height,
        initialBufferData.buffer
      )
      
      // Create ping-pong buffers for simulation steps
      let currentTexture = inputTexture
      let nextTexture = null
      const texturesToCleanup = [inputTexture]
      
      if (simulationSteps > 0) {
        nextTexture = gpuCompute.createBuffer(
          initialBufferData.width,
          initialBufferData.height
        )
        texturesToCleanup.push(nextTexture)
      }
      
      // Run simulation for specified number of steps
      if (simulationSteps > 0) {
        for (let step = 0; step < simulationSteps; step++) {
          // Run kernel
          gpuCompute.run(
            kernel,
            {
              u_state: currentTexture,
              u_width: initialBufferData.width,
              u_height: initialBufferData.height
            },
            nextTexture,
            initialBufferData.width,
            initialBufferData.height
          )
          
          // Swap buffers (ping-pong)
          if (step < simulationSteps - 1) {
            // For intermediate steps, swap
            const temp = currentTexture
            currentTexture = nextTexture
            nextTexture = temp
          }
        }
      }
      
      // Final result is in nextTexture (or currentTexture if no steps)
      const simulatedTexture = simulationSteps > 0 ? nextTexture : currentTexture
      
      // Get expected result (frame 1, or frame 0 if only 1 frame)
      let hasMultipleFrames = false
      for (const group of testGroups || []) {
        if (group.tests && Array.isArray(group.tests)) {
          for (const test of group.tests) {
            if (test.frames && test.frames.length > 1) {
              hasMultipleFrames = true
              break
            }
          }
          if (hasMultipleFrames) break
        }
      }
      const expectedFrameIndex = hasMultipleFrames ? 1 : 0
      const expectedBufferData = combineTestCases(testGroups, expectedFrameIndex)
      
      if (!expectedBufferData) {
        // Cleanup all textures
        texturesToCleanup.forEach(tex => {
          gpuCompute.gl.deleteTexture(tex)
        })
        return 0.0
      }
      
      // Upload expected results to texture
      const expectedTexture = gpuCompute.createBuffer(
        expectedBufferData.width,
        expectedBufferData.height,
        expectedBufferData.buffer
      )
      
      // Evaluate using aggregated shader (returns single score)
      const config = {
        totalWidth: initialBufferData.width,
        totalHeight: initialBufferData.height,
        numTestCases: initialBufferData.numTestCases,
        testCaseWidth: initialBufferData.testCaseWidth,
        testCaseHeight: initialBufferData.testCaseHeight,
        spacing: 5
      }
      
      const results = testEvaluator.evaluate(simulatedTexture, expectedTexture, config, true)
      
      // Fitness is the match ratio (first element of results)
      const fitness = results[0] || 0.0
      
      // Cleanup all textures (but keep kernels cached)
      texturesToCleanup.forEach(tex => {
        gpuCompute.gl.deleteTexture(tex)
      })
      gpuCompute.gl.deleteTexture(expectedTexture)
      
      return fitness
    } catch (error) {
      console.error('Fitness evaluation error:', error)
      return 0.0 // Return 0 fitness on error
    }
  }
}

/**
 * Combine test cases into a single buffer (same logic as TestBufferViewer)
 */
function combineTestCases(testGroups, frameIndex) {
  if (!testGroups || testGroups.length === 0) {
    return null
  }

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

  // Find maximum dimensions
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

  const spacing = 5
  const totalWidth = allTestCases.length * maxWidth + (allTestCases.length - 1) * spacing
  const combinedBuffer = new Float32Array(totalWidth * maxHeight * 4)

  let currentX = 0
  for (const test of allTestCases) {
    const frame = test.frames[frameIndex] || null
    
    for (let y = 0; y < maxHeight; y++) {
      const row = frame && y < test.height ? frame[y] : null
      for (let x = 0; x < maxWidth; x++) {
        const dstIndex = (y * totalWidth + (currentX + x)) * 4
        
        if (x < test.width && y < test.height && row) {
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
            r = Number(cell) || 0
            g = 0
            b = 0
            a = 0
          }
          
          combinedBuffer[dstIndex] = r
          combinedBuffer[dstIndex + 1] = g
          combinedBuffer[dstIndex + 2] = b
          combinedBuffer[dstIndex + 3] = a
        } else {
          // Empty cell
          combinedBuffer[dstIndex] = 0
          combinedBuffer[dstIndex + 1] = 0
          combinedBuffer[dstIndex + 2] = 0
          combinedBuffer[dstIndex + 3] = 0
        }
      }
    }

    currentX += maxWidth
    if (currentX < totalWidth) {
      for (let y = 0; y < maxHeight; y++) {
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
    height: maxHeight,
    numTestCases: allTestCases.length,
    testCaseWidth: maxWidth,
    testCaseHeight: maxHeight
  }
}

/**
 * Get default cell types (fallback if not in config)
 */
function getDefaultCellTypes() {
  return {
    EMPTY: new Float32Array([0, 0, 0, 0]),
    SAND: new Float32Array([1, 0, 0, 0]),
    WATER: new Float32Array([2, 0, 0, 0]),
    STONE: new Float32Array([3, 0, 0, 0])
  }
}

