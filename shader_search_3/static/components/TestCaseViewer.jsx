import React from 'react'
import { CAFrame } from './CAFrame.jsx'
import { FramePlaybackControls } from './FramePlaybackControls.jsx'

const createSampleBufferFromFrames = (frames) => {
  if (!frames?.length) {
    return { buffer: new Float32Array(0), width: 0, height: 0, frameCount: 0 }
  }
  const height = frames[0].length
  const width = frames[0][0]?.length ?? 0
  const frameCount = frames.length
  const buffer = new Float32Array(frameCount * width * height * 4)

  frames.forEach((frame, frameIdx) => {
    frame.forEach((row, y) => {
      row.forEach((cell, x) => {
        const baseIndex = (frameIdx * width * height + y * width + x) * 4
        buffer[baseIndex] = cell?.[0] ?? 0
        buffer[baseIndex + 1] = cell?.[1] ?? 0
        buffer[baseIndex + 2] = cell?.[2] ?? 0
        buffer[baseIndex + 3] = cell?.[3] ?? 0
      })
    })
  })

  return { buffer, width, height, frameCount }
}

const extractFramesFromBuffer = ({ buffer, width, height, frameCount }) => {
  if (!buffer?.length || !width || !height || !frameCount) return []
  const frames = []
  for (let frameIdx = 0; frameIdx < frameCount; frameIdx += 1) {
    const frame = []
    for (let y = 0; y < height; y += 1) {
      const row = []
      for (let x = 0; x < width; x += 1) {
        const baseIndex = (frameIdx * width * height + y * width + x) * 4
        const cell = new Float32Array(4)
        cell[0] = buffer[baseIndex]
        cell[1] = buffer[baseIndex + 1]
        cell[2] = buffer[baseIndex + 2]
        cell[3] = buffer[baseIndex + 3]
        row.push(cell)
      }
      frame.push(row)
    }
    frames.push(frame)
  }
  return frames
}

export const TestCaseViewer = ({ test, channelIndex = 0 }) => {
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [frameIndex, setFrameIndex] = React.useState(0)

  const frameCount = test?.frames?.length ?? 0

  React.useEffect(() => {
    setFrameIndex(0)
    // Auto-play when a new test is selected (if it has more than 1 frame)
    if (test?.frames?.length > 1) {
      setIsPlaying(true)
    } else {
      setIsPlaying(false)
    }
  }, [test?.id])

  React.useEffect(() => {
    if (!isPlaying || frameCount <= 1) return undefined
    const interval = setInterval(() => {
      setFrameIndex((prev) => ((prev + 1) % frameCount + frameCount) % frameCount)
    }, 600)
    return () => clearInterval(interval)
  }, [isPlaying, frameCount])

  const sampleRun = React.useMemo(() => {
    if (!test?.frames) return { frames: [] }
    const descriptor = createSampleBufferFromFrames(test.frames)
    return {
      ...descriptor,
      frames: extractFramesFromBuffer(descriptor),
    }
  }, [test])

  if (!test) {
    return <div className="test-viewer-empty">Select a test case to view.</div>
  }

  if (frameCount === 0) {
    return <div className="test-viewer-empty">This test has no frames yet.</div>
  }

  const expectedFrames = test.frames
  const actualFrames = sampleRun.frames.length ? sampleRun.frames : expectedFrames
  const currentExpected = expectedFrames[frameIndex] ?? expectedFrames[0]
  const currentActual = actualFrames[frameIndex] ?? actualFrames[0]

  return (
    <div className="test-viewer">
      <FramePlaybackControls
        frameIndex={frameIndex}
        frameCount={frameCount}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((prev) => !prev)}
        onPrev={() => setFrameIndex((prev) => (prev - 1 + frameCount) % frameCount)}
        onNext={() => setFrameIndex((prev) => (prev + 1) % frameCount)}
      />
      <div className="test-viewer-grids">
        <div className="viewer-panel">
          <h4>Actual (Sample)</h4>
          <CAFrame frame={currentActual} channelIndex={channelIndex} />
        </div>
        <div className="viewer-panel">
          <h4>Expected</h4>
          <CAFrame frame={currentExpected} channelIndex={channelIndex} />
        </div>
      </div>
    </div>
  )
}
