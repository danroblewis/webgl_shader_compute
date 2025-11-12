const API_BASE = '/api'

const palette = ['#0f172a', '#38bdf8', '#f97316', '#22c55e', '#94a3b8']
const getCellColor = (value) => palette[value % palette.length]

const GridPreview = ({ test }) => {
  if (!test.frames?.length) return null
  const firstFrame = test.frames[0]
  const columns = firstFrame[0]?.length ?? 0
  return (
    <div>
      <div className="meta">
        {test.width}×{test.height} • {test.frames.length} frame(s)
      </div>
      <div
        className="grid-preview"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(8px, 1fr))` }}
      >
        {firstFrame.flat().map((value, idx) => (
          <div className="grid-cell" key={idx}>
            <div
              className="grid-cell-inner"
              style={{ backgroundColor: getCellColor(value) }}
              title={`Cell ${idx}: ${value}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

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

const EvolutionConfigs = () => {
  const [configs, setConfigs] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  const load = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE}/evolution-configs`)
      if (!res.ok) throw new Error('Failed to load configurations')
      const data = await res.json()
      setConfigs(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  return (
    <section>
      <SectionHeader title="Evolution Configurations" onRefresh={load} loading={loading} />
      {error && <div className="error">{error}</div>}
      <div className="list">
        {configs.length === 0 ? (
          <div className="meta">No configurations saved yet.</div>
        ) : (
          configs.map((cfg) => (
            <div className="card" key={cfg.id}>
              <h3>{cfg.name}</h3>
              {cfg.description && <p>{cfg.description}</p>}
              <div className="meta">Identifier: {cfg.id}</div>
              <details style={{ marginTop: '0.75rem' }}>
                <summary>GridSimulation Code</summary>
                <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                  {cfg.grid_simulation_code}
                </pre>
              </details>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

const TestCaseGroups = () => {
  const [groups, setGroups] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  const load = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE}/test-case-groups`)
      if (!res.ok) throw new Error('Failed to load test case groups')
      const data = await res.json()
      setGroups(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  return (
    <section>
      <SectionHeader title="Test Case Groups" onRefresh={load} loading={loading} />
      {error && <div className="error">{error}</div>}
      <div className="list">
        {groups.length === 0 ? (
          <div className="meta">No test case groups defined yet.</div>
        ) : (
          groups.map((group) => (
            <div className="card" key={group.id}>
              <h3>{group.name}</h3>
              {group.description && <p>{group.description}</p>}
              <div className="meta">{group.tests.length} test(s)</div>
              {group.tests.map((test) => (
                <div key={test.id} style={{ marginTop: '1rem' }}>
                  <strong style={{ color: '#38bdf8' }}>{test.name}</strong>
                  <GridPreview test={test} />
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

const App = () => (
  <>
    <EvolutionConfigs />
    <TestCaseGroups />
  </>
)

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
