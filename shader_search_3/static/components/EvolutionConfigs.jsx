import { SectionHeader } from './SectionHeader.jsx'

export const EvolutionConfigs = ({ configs = [], loading = false, error = null, onRefresh }) => (
  <section>
    <SectionHeader title="Evolution Configurations" onRefresh={onRefresh} loading={loading} />
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
