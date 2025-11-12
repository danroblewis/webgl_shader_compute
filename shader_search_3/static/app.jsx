window.API_BASE = window.API_BASE || '/api'

const App = () => (
  <>
    <EvolutionConfigs />
    <TestCaseGroups />
  </>
)

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
