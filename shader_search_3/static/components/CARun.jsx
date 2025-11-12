const CARun = ({ frames = [], showLabels = true }) => {
  if (!frames.length) return null

  return (
    <div className="ca-run">
      {frames.map((frame, index) => (
        <div className="ca-run-frame" key={`frame-${index}`}>
          {showLabels && <div className="ca-run-frame-label">Frame {index + 1}</div>}
          <CAFrame frame={frame} />
        </div>
      ))}
    </div>
  )
}
