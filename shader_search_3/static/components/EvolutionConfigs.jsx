import { SectionHeader } from './SectionHeader.jsx'
import RuleSetVisualizer from './RuleSetVisualizer.jsx'

export const EvolutionConfigs = ({ 
  configs = [], 
  loading = false, 
  error = null, 
  onRefresh,
  selectedConfig = null,
  onSelectConfig = () => {},
}) => (
  <section>
    <SectionHeader title="Evolution Configurations" onRefresh={onRefresh} loading={loading} />
    {error && <div className="error">{error}</div>}
    <div className="list">
      {configs.length === 0 ? (
        <div className="meta">No configurations saved yet.</div>
      ) : (
        configs.map((cfg) => (
          <div 
            className={`card ${selectedConfig?.id === cfg.id ? 'selected' : ''}`}
            key={cfg.id}
            onClick={() => onSelectConfig(cfg)}
            style={{ cursor: 'pointer' }}
          >
            <h3>{cfg.name}</h3>
            {cfg.description && <p>{cfg.description}</p>}
            <div className="meta">Identifier: {cfg.id}</div>
            
            {cfg.rule_set && (
              <details open style={{ marginTop: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                <summary>Rule Set</summary>
                <RuleSetVisualizer ruleSet={cfg.rule_set} />
              </details>
            )}
            
            <details style={{ marginTop: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
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
