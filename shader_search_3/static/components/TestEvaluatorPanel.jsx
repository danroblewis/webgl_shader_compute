import React from 'react'
import { GPUCompute } from '../gpu-compute.js'
import { TestEvaluator } from '../utils/testEvaluator.js'
import { ruleSetToGLSL } from '../utils/ruleSetToGLSL.js'

/**
 * Test Evaluator Panel
 * Runs simulations on test cases and evaluates results using GPU compute
 */
export default function TestEvaluatorPanel({ groups, selectedConfig }) {
  const [evaluationResults, setEvaluationResults] = React.useState(null)
  const [isEvaluating, setIsEvaluating] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [simulationSteps, setSimulationSteps] = React.useState(1)
  
  const gpuComputeRef = React.useRef(null)
  const evaluatorRef = React.useRef(null)
  const expectedTextureRef = React.useRef(null)
  const simulatedTextureRef = React.useRef(null)

  // Initialize GPU compute and evaluator
  React.useEffect(() => {
    if (!selectedConfig) {
      return
    }

    try {
      // Create GPU compute instance
      const canvas = document.createElement('canvas')
      gpuComputeRef.current = new GPUCompute(canvas)
      evaluatorRef.current = new TestEvaluator(gpuComputeRef.current)

      return () => {
        if (evaluatorRef.current) {
          evaluatorRef.current.dispose()
        }
        if (gpuComputeRef.current) {
          gpuComputeRef.current.dispose()
        }
      }
    } catch (err) {
      console.error('Failed to initialize GPU compute:', err)
      setError(err.message)
    }
  }, [selectedConfig])

  // Combine test cases into buffer (same logic as TestBufferViewer)
  const combineTestCases = React.useCallback((testGroups, frameIndex) => {
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
          for (let x = 0; x < spacing; x++) {
            const dstIndex = (y * totalWidth + (currentX + x)) * 4
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
      testCaseHeight: maxHeight,
      spacing: spacing
    }
  }, [])

  // Run evaluation
  const runEvaluation = React.useCallback(async () => {
    if (!selectedConfig || !groups || groups.length === 0 || !gpuComputeRef.current || !evaluatorRef.current) {
      setError('Missing configuration or test cases')
      return
    }

    setIsEvaluating(true)
    setError(null)
    setEvaluationResults(null)

    try {
      // Get test case buffer configuration (frame 0 = initial state)
      const initialBufferData = combineTestCases(groups, 0)
      if (!initialBufferData) {
        throw new Error('No test cases found')
      }

      const config = {
        totalWidth: initialBufferData.width,
        totalHeight: initialBufferData.height,
        numTestCases: initialBufferData.numTestCases,
        testCaseWidth: initialBufferData.testCaseWidth,
        testCaseHeight: initialBufferData.testCaseHeight,
        spacing: initialBufferData.spacing
      }

      // Create initial state texture
      const initialTexture = gpuComputeRef.current.createBuffer(
        config.totalWidth,
        config.totalHeight,
        initialBufferData.buffer
      )

      // Create simulation instance for the combined buffer
      // We need to create a custom simulation that works on the combined buffer
      // For now, let's create a GridSimulation with the combined dimensions
      // But we need to modify it to use our custom kernel that handles the combined layout
      
      // Actually, we need to run the simulation shader directly on the combined buffer
      // Let's compile the rule set shader
      const ruleSet = selectedConfig.rule_set
      const glslShader = ruleSetToGLSL(ruleSet)
      
      // Create a compute kernel for the simulation
      const simulationKernel = gpuComputeRef.current.compileKernel(glslShader)
      
      // Create output texture for simulation
      const simulatedTexture = gpuComputeRef.current.createBuffer(
        config.totalWidth,
        config.totalHeight
      )

      // Run simulation steps
      let currentTexture = initialTexture
      for (let step = 0; step < simulationSteps; step++) {
        const nextTexture = step === simulationSteps - 1 ? simulatedTexture : gpuComputeRef.current.createBuffer(
          config.totalWidth,
          config.totalHeight
        )

        // Run simulation kernel
        gpuComputeRef.current.run(
          simulationKernel,
          {
            u_state: currentTexture,
            u_width: config.totalWidth,
            u_height: config.totalHeight
          },
          nextTexture,
          config.totalWidth,
          config.totalHeight
        )

        if (currentTexture !== initialTexture) {
          // Clean up intermediate texture
          gpuComputeRef.current.gl.deleteTexture(currentTexture)
        }

        if (step < simulationSteps - 1) {
          currentTexture = nextTexture
        }
      }

      simulatedTextureRef.current = simulatedTexture

      // Get expected results (frame 1, or frame 0 if only 1 frame exists)
      // Check if any test case has at least 2 frames
      let hasMultipleFrames = false
      for (const group of groups || []) {
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
      const expectedBufferData = combineTestCases(groups, expectedFrameIndex)
      if (!expectedBufferData) {
        throw new Error('No expected results found')
      }

      const expectedTexture = gpuComputeRef.current.createBuffer(
        expectedBufferData.width,
        expectedBufferData.height,
        expectedBufferData.buffer
      )
      expectedTextureRef.current = expectedTexture

      // Initialize evaluator
      evaluatorRef.current.initialize(config, false)

      // Run evaluation
      const results = evaluatorRef.current.getPerTestCaseResults(
        simulatedTexture,
        expectedTexture,
        config
      )

      setEvaluationResults({
        perTestCase: results,
        config: config
      })

      // Clean up textures (except we'll keep them for potential re-use)
      // gpuComputeRef.current.gl.deleteTexture(initialTexture)
      // gpuComputeRef.current.gl.deleteTexture(expectedTexture)

    } catch (err) {
      console.error('Evaluation error:', err)
      setError(err.message)
    } finally {
      setIsEvaluating(false)
    }
  }, [selectedConfig, groups, combineTestCases, simulationSteps])

  if (!selectedConfig) {
    return (
      <div className="test-evaluator-panel">
        <p>Select an evolution configuration to run evaluations</p>
      </div>
    )
  }

  return (
    <div className="test-evaluator-panel">
      <div className="test-evaluator-header">
        <h3>Test Evaluation</h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label>
            Steps:
            <input
              type="number"
              min="1"
              max="100"
              value={simulationSteps}
              onChange={(e) => setSimulationSteps(parseInt(e.target.value) || 1)}
              style={{ marginLeft: '0.5rem', width: '60px' }}
            />
          </label>
          <button
            onClick={runEvaluation}
            disabled={isEvaluating || !groups || groups.length === 0}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: isEvaluating ? '#64748b' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isEvaluating ? 'not-allowed' : 'pointer'
            }}
          >
            {isEvaluating ? 'Evaluating...' : 'Run Evaluation'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderLeft: '3px solid #ef4444',
          marginBottom: '1rem',
          color: '#ef4444'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {evaluationResults && (
        <div className="evaluation-results">
          <h4>Results</h4>
          <div className="results-grid">
            {evaluationResults.perTestCase.map((result, index) => (
              <div key={index} className="result-card">
                <div className="result-header">
                  <strong>Test Case {index + 1}</strong>
                </div>
                <div className="result-stats">
                  <div>
                    <span className="stat-label">Match Ratio:</span>
                    <span className="stat-value">
                      {(result.matchRatio * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className="stat-label">Matches:</span>
                    <span className="stat-value">
                      {Math.round(result.matchCount)} / {result.totalPixels}
                    </span>
                  </div>
                </div>
                <div className="result-bar">
                  <div
                    className="result-bar-fill"
                    style={{
                      width: `${result.matchRatio * 100}%`,
                      backgroundColor: result.matchRatio > 0.9 ? '#10b981' :
                                      result.matchRatio > 0.7 ? '#f59e0b' :
                                      '#ef4444'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {evaluationResults.perTestCase.length > 0 && (
            <div className="aggregated-result">
              <strong>Average Match Ratio:</strong>{' '}
              {(
                evaluationResults.perTestCase.reduce((sum, r) => sum + r.matchRatio, 0) /
                evaluationResults.perTestCase.length * 100
              ).toFixed(2)}%
            </div>
          )}
        </div>
      )}
    </div>
  )
}

