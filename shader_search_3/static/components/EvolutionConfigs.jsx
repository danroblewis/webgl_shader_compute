const EvolutionConfigs = () => {
  const API_BASE = window.API_BASE || '/api'
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
  }, [API_BASE])

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
