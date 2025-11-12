const TestCaseGroups = () => {
  const API_BASE = window.API_BASE || '/api'
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
  }, [API_BASE])

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
