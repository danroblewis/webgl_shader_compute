import React from 'react'
import { CARun } from './CARun.jsx'

export const TestAnimationView = ({ groups = [], channelIndex = 0 }) => {
  const [isPlaying, setIsPlaying] = React.useState(true)
  const [currentFrameIndex, setCurrentFrameIndex] = React.useState(0)
  const frameIntervalRef = React.useRef(null)

  // Collect all test cases from all groups
  const allTestCases = React.useMemo(() => {
    const tests = []
    for (const group of groups) {
      if (group.tests && Array.isArray(group.tests)) {
        for (const test of group.tests) {
          if (test.frames && test.frames.length > 0) {
            tests.push({
              ...test,
              groupName: group.name,
            })
          }
        }
      }
    }
    return tests
  }, [groups])

  // Find the maximum number of frames across all test cases
  const maxFrames = React.useMemo(() => {
    return Math.max(...allTestCases.map(test => test.frames?.length || 0), 0)
  }, [allTestCases])

  // Auto-advance frames when playing
  React.useEffect(() => {
    if (isPlaying && maxFrames > 0) {
      frameIntervalRef.current = setInterval(() => {
        setCurrentFrameIndex(prev => (prev + 1) % maxFrames)
      }, 500) // 500ms per frame
    } else {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
        frameIntervalRef.current = null
      }
    }
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
      }
    }
  }, [isPlaying, maxFrames])

  const handlePrev = () => {
    setCurrentFrameIndex(prev => (prev - 1 + maxFrames) % maxFrames)
    setIsPlaying(false)
  }

  const handleNext = () => {
    setCurrentFrameIndex(prev => (prev + 1) % maxFrames)
    setIsPlaying(false)
  }

  const handleTogglePlay = () => {
    setIsPlaying(prev => !prev)
  }

  if (allTestCases.length === 0) {
    return (
      <div className="test-animation-view">
        <div className="test-viewer-empty">No test cases available</div>
      </div>
    )
  }

  return (
    <div className="test-animation-view">
      <div className="test-animation-controls">
        <button type="button" onClick={handlePrev} disabled={maxFrames === 0}>
          ◀ Prev
        </button>
        <button type="button" onClick={handleTogglePlay}>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button type="button" onClick={handleNext} disabled={maxFrames === 0}>
          Next ▶
        </button>
        <span className="frame-counter">
          Frame {currentFrameIndex + 1} / {maxFrames}
        </span>
      </div>
      <div className="test-animation-grid">
        {allTestCases.map((test) => {
          const frame = test.frames?.[currentFrameIndex] || null
          return (
            <div key={`${test.groupName}-${test.id}`} className="test-animation-item">
              <div className="test-animation-header">
                <span className="test-animation-group">{test.groupName}</span>
                <span className="test-animation-name">{test.name}</span>
              </div>
              {frame ? (
                <CARun frames={[frame]} showLabels={false} channelIndex={channelIndex} />
              ) : (
                <div className="test-animation-empty">No frame {currentFrameIndex + 1}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

