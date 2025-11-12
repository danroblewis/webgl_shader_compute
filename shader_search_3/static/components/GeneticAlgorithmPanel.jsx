import React from 'react'
import { GPUCompute } from '../gpu-compute.js'
import { TestEvaluator } from '../utils/testEvaluator.js'
import { GeneticAlgorithm } from '../utils/geneticAlgorithm.js'
import { createFitnessEvaluator } from '../utils/fitnessEvaluator.js'
import { getCellTypesFromConfig } from '../utils/getCellTypesFromConfig.js'
import RuleSetVisualizer from './RuleSetVisualizer.jsx'

/**
 * Genetic Algorithm Panel
 * Runs genetic algorithm to evolve rule sets
 */
export default function GeneticAlgorithmPanel({ groups, selectedConfig, onConfigUpdate }) {
  const [isRunning, setIsRunning] = React.useState(false)
  const [stats, setStats] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [bestRuleSet, setBestRuleSet] = React.useState(null)
  const [populationSize, setPopulationSize] = React.useState(20)
  const [elitismCount, setElitismCount] = React.useState(2)
  const [maxIterations, setMaxIterations] = React.useState(50)
  
  const gaRef = React.useRef(null)
  const gpuComputeRef = React.useRef(null)
  const evaluatorRef = React.useRef(null)
  const fitnessEvaluatorRef = React.useRef(null)
  const animationFrameRef = React.useRef(null)
  
  // Initialize GPU compute and evaluator
  React.useEffect(() => {
    if (!selectedConfig) {
      return
    }

    try {
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
  
  // Initialize fitness evaluator when config or groups change
  React.useEffect(() => {
    if (!selectedConfig || !groups || !gpuComputeRef.current || !evaluatorRef.current) {
      return
    }
    
    try {
      // Get cell types from config
      const availableCellTypes = getCellTypesFromConfig(selectedConfig)
      const cellTypeNames = availableCellTypes.map(ct => ct.name)
      
      // Create fitness evaluator
      fitnessEvaluatorRef.current = createFitnessEvaluator({
        testGroups: groups,
        gpuCompute: gpuComputeRef.current,
        testEvaluator: evaluatorRef.current,
        baseConfig: selectedConfig,
        simulationSteps: 1
      })
    } catch (err) {
      console.error('Failed to initialize fitness evaluator:', err)
      setError(err.message)
    }
  }, [selectedConfig, groups])
  
  // Evolution loop
  React.useEffect(() => {
    if (!isRunning || !gaRef.current || !fitnessEvaluatorRef.current) {
      return
    }
    
    let cancelled = false
    
    const evolveGeneration = async () => {
      if (cancelled) return
      
      try {
        // Check if we've reached max iterations
        const currentStats = gaRef.current.getStats()
        if (currentStats.generation >= maxIterations) {
          // Evolution complete - save best rule set
          const best = gaRef.current.getBestRuleSet()
          if (best && selectedConfig) {
            try {
              await saveBestRuleSet(best)
              setBestRuleSet(best)
              setStats(currentStats)
              setIsRunning(false)
              if (onConfigUpdate) {
                onConfigUpdate()
              }
            } catch (err) {
              console.error('Failed to save best rule set:', err)
              setError(`Evolution complete but failed to save: ${err.message}`)
            }
          } else {
            setIsRunning(false)
          }
          return
        }
        
        // Evaluate fitness for current generation
        await gaRef.current.evaluateFitness(fitnessEvaluatorRef.current)
        
        // Update stats
        const updatedStats = gaRef.current.getStats()
        setStats(updatedStats)
        setBestRuleSet(gaRef.current.getBestRuleSet())
        
        if (cancelled) return
        
        // Check again after evaluation (in case we hit max during evaluation)
        if (updatedStats.generation >= maxIterations) {
          // Evolution complete - save best rule set
          const best = gaRef.current.getBestRuleSet()
          if (best && selectedConfig) {
            try {
              await saveBestRuleSet(best)
              setBestRuleSet(best)
              setIsRunning(false)
              if (onConfigUpdate) {
                onConfigUpdate()
              }
            } catch (err) {
              console.error('Failed to save best rule set:', err)
              setError(`Evolution complete but failed to save: ${err.message}`)
            }
          } else {
            setIsRunning(false)
          }
          return
        }
        
        // Create next generation
        gaRef.current.evolve()
        
        // Continue evolution
        animationFrameRef.current = requestAnimationFrame(evolveGeneration)
      } catch (err) {
        console.error('Evolution error:', err)
        setError(err.message)
        setIsRunning(false)
      }
    }
    
    evolveGeneration()
    
    return () => {
      cancelled = true
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRunning, maxIterations, selectedConfig, onConfigUpdate])
  
  // Save best rule set to EvolutionConfig
  const saveBestRuleSet = async (ruleSet) => {
    if (!selectedConfig) {
      throw new Error('No configuration selected')
    }
    
    const response = await fetch(`/api/evolution-configs/${selectedConfig.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: selectedConfig.name,
        description: selectedConfig.description,
        grid_simulation_code: selectedConfig.grid_simulation_code,
        rule_set: ruleSet
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to save rule set: ${errorText}`)
    }
    
    return await response.json()
  }
  
  const handleStart = () => {
    if (!selectedConfig || !fitnessEvaluatorRef.current) {
      setError('Please select a configuration first')
      return
    }
    
    try {
      // Get available cell types
      const availableCellTypes = getCellTypesFromConfig(selectedConfig)
      const cellTypeNames = availableCellTypes.map(ct => ct.name)
      
      // Initialize genetic algorithm
      gaRef.current = new GeneticAlgorithm({
        populationSize: populationSize,
        mutationRate: 0.1,
        crossoverRate: 0.7,
        elitismCount: elitismCount,
        tournamentSize: 3,
        availableCellTypes: cellTypeNames
      })
      
      // Initialize with seed rule set from EvolutionConfig
      gaRef.current.initialize(selectedConfig.rule_set || {})
      
      setError(null)
      setIsRunning(true)
    } catch (err) {
      console.error('Failed to start genetic algorithm:', err)
      setError(err.message)
    }
  }
  
  const handleStop = () => {
    setIsRunning(false)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }
  
  const handleReset = () => {
    handleStop()
    gaRef.current = null
    setStats(null)
    setBestRuleSet(null)
    setError(null)
  }
  
  if (!selectedConfig) {
    return (
      <div className="test-evaluator-panel">
        <div className="test-evaluator-header">
          <h3>Genetic Algorithm</h3>
        </div>
        <p>Select an evolution configuration to start evolving rule sets</p>
      </div>
    )
  }
  
  return (
    <div className="test-evaluator-panel">
      <div className="test-evaluator-header">
        <h3>Genetic Algorithm</h3>
        <div>
          {!isRunning ? (
            <button onClick={handleStart} className="button-primary">
              Start Evolution
            </button>
          ) : (
            <button onClick={handleStop} className="button-secondary">
              Stop
            </button>
          )}
          {stats && (
            <button onClick={handleReset} className="button-secondary" style={{ marginLeft: '0.5rem' }}>
              Reset
            </button>
          )}
        </div>
      </div>
      
      {!isRunning && (
        <div style={{ 
          marginBottom: '1rem', 
          padding: '1.25rem', 
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '10px',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.4)'
        }}>
          <h4 style={{ 
            marginTop: 0, 
            marginBottom: '1rem',
            fontSize: '1.1rem',
            color: '#38bdf8',
            fontWeight: 600
          }}>
            Evolution Parameters
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontSize: '0.9rem',
                color: '#cbd5e1',
                fontWeight: 500
              }}>
                Population Size:
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={populationSize}
                onChange={(e) => setPopulationSize(Math.max(5, Math.min(100, parseInt(e.target.value) || 20)))}
                style={{ 
                  width: '100%', 
                  padding: '0.625rem 0.75rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '0.9rem',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#38bdf8'
                  e.target.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(148, 163, 184, 0.2)'
                  e.target.style.boxShadow = 'none'
                }}
                disabled={isRunning}
              />
            </div>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontSize: '0.9rem',
                color: '#cbd5e1',
                fontWeight: 500
              }}>
                Elite Set Size:
              </label>
              <input
                type="number"
                min="1"
                max={populationSize}
                value={elitismCount}
                onChange={(e) => setElitismCount(Math.max(1, Math.min(populationSize, parseInt(e.target.value) || 2)))}
                style={{ 
                  width: '100%', 
                  padding: '0.625rem 0.75rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '0.9rem',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#38bdf8'
                  e.target.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(148, 163, 184, 0.2)'
                  e.target.style.boxShadow = 'none'
                }}
                disabled={isRunning}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontSize: '0.9rem',
                color: '#cbd5e1',
                fontWeight: 500
              }}>
                Max Iterations:
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={maxIterations}
                onChange={(e) => setMaxIterations(Math.max(1, Math.min(1000, parseInt(e.target.value) || 50)))}
                style={{ 
                  width: '100%', 
                  padding: '0.625rem 0.75rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '0.9rem',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#38bdf8'
                  e.target.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(148, 163, 184, 0.2)'
                  e.target.style.boxShadow = 'none'
                }}
                disabled={isRunning}
              />
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div style={{ 
          padding: '0.5rem 1rem', 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          borderLeft: '3px solid #ef4444',
          marginBottom: '1rem',
          color: '#ef4444'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {stats && (
        <div className="evaluation-results">
          <h4>Evolution Statistics</h4>
          
          {/* Progress Bar */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '0.5rem',
              fontSize: '0.9rem'
            }}>
              <span>Progress: Generation {stats.generation} / {maxIterations}</span>
              <span>{Math.round((stats.generation / maxIterations) * 100)}%</span>
            </div>
            <div style={{
              width: '100%',
              height: '24px',
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, (stats.generation / maxIterations) * 100)}%`,
                height: '100%',
                backgroundColor: '#3b82f6',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
          
          <div className="results-grid">
            <div className="result-card">
              <div className="result-label">Generation</div>
              <div className="result-value">{stats.generation}</div>
            </div>
            <div className="result-card">
              <div className="result-label">Best Fitness (Current)</div>
              <div className="result-value">{(stats.bestFitness * 100).toFixed(2)}%</div>
            </div>
            <div className="result-card">
              <div className="result-label">Best Fitness (Overall)</div>
              <div className="result-value">{(stats.bestOverallFitness * 100).toFixed(2)}%</div>
            </div>
            <div className="result-card">
              <div className="result-label">Average Fitness</div>
              <div className="result-value">{(stats.averageFitness * 100).toFixed(2)}%</div>
            </div>
            <div className="result-card">
              <div className="result-label">Worst Fitness</div>
              <div className="result-value">{(stats.worstFitness * 100).toFixed(2)}%</div>
            </div>
          </div>
          
          {bestRuleSet && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4>Best Rule Set Found</h4>
              <RuleSetVisualizer ruleSet={bestRuleSet} />
            </div>
          )}
        </div>
      )}
      
      {!stats && !isRunning && (
        <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>
          Click "Start Evolution" to begin evolving rule sets. The algorithm will mutate and evolve
          the rules to maximize the match ratio with your test cases.
        </p>
      )}
      
      {isRunning && !stats && (
        <p style={{ color: '#94a3b8' }}>
          Initializing population and evaluating first generation...
        </p>
      )}
    </div>
  )
}

