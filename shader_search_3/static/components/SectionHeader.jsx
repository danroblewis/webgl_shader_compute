const SectionHeader = ({ title, onRefresh, loading }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1rem',
    }}
  >
    <h2>{title}</h2>
    <button className="refresh" onClick={onRefresh} disabled={loading}>
      {loading ? 'Refreshing…' : 'Refresh'}
    </button>
  </div>
)
