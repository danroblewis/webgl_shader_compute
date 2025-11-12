import { CARun } from './CARun.jsx'

export const TestCaseCard = ({ test, channelIndex = 0 }) => {
  if (!test) return null

  return (
    <div className="test-case-card">
      <strong className="test-case-title" style={{ color: '#38bdf8' }}>{test.name}</strong>
      {test.description && <p className="test-case-description">{test.description}</p>}
      <div className="meta">
        {test.width}×{test.height} • {test.frames.length} frame(s)
      </div>
      <div className="test-case-preview">
        <CARun frames={test.frames} channelIndex={channelIndex} showLabels={false} />
      </div>
    </div>
  )
}
