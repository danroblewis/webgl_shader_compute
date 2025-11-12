export const FramePlaybackControls = ({
  frameIndex,
  frameCount,
  isPlaying,
  onTogglePlay,
  onPrev,
  onNext,
}) => (
  <div className="playback-controls">
    <button type="button" onClick={onPrev} disabled={frameCount <= 1}>
      ◀ Prev
    </button>
    <button type="button" onClick={onTogglePlay} disabled={frameCount <= 1}>
      {isPlaying ? 'Pause' : 'Play'}
    </button>
    <button type="button" onClick={onNext} disabled={frameCount <= 1}>
      Next ▶
    </button>
    <span className="playback-status">
      Frame {frameIndex + 1} / {frameCount}
    </span>
  </div>
)
