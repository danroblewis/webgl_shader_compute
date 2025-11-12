const TestCaseGroups = ({ groups = [], loading = false, error = null, onRefresh, channelIndex = 0 }) => (
  <section>
    <SectionHeader title="Test Case Groups" onRefresh={onRefresh} loading={loading} />
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
                <GridPreview test={test} channelIndex={channelIndex} />
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  </section>
)
