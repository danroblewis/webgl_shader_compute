const GridPreview = ({ test }) => {
  if (!test?.frames?.length) return null

  return (
    <div className="ca-preview">
      <div className="meta">
        {test.width}×{test.height} • {test.frames.length} frame(s)
      </div>
      <CARun frames={test.frames} />
    </div>
  )
}
