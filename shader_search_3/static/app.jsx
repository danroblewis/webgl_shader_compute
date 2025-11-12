window.API_BASE = window.API_BASE || '/api'

const { useState, useEffect, useCallback } = React

const toFloatVec = (cell) => {
  if (cell instanceof Float32Array) {
    return cell
  }
  if (ArrayBuffer.isView(cell)) {
    return new Float32Array(cell.buffer, cell.byteOffset, cell.length)
  }
  if (Array.isArray(cell)) {
    const vec = new Float32Array(4)
    for (let i = 0; i < Math.min(4, cell.length); i += 1) {
      vec[i] = Number(cell[i]) || 0
    }
    return vec
  }
  const vec = new Float32Array(4)
  vec[0] = Number(cell) || 0
  return vec
}

const convertFrame = (frame) => frame.map((row) => row.map(toFloatVec))
const convertTest = (test) => ({ ...test, frames: test.frames.map(convertFrame) })
const convertGroup = (group) => ({ ...group, tests: group.tests.map(convertTest) })

const App = () => {
  const [configs, setConfigs] = useState([])
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState(null)

  const [groups, setGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsError, setGroupsError] = useState(null)

  const loadConfigs = useCallback(async () => {
    try {
      setConfigLoading(true)
      setConfigError(null)
      const res = await fetch(`${window.API_BASE}/evolution-configs`)
      if (!res.ok) throw new Error('Failed to load configurations')
      const data = await res.json()
      setConfigs(data)
    } catch (err) {
      setConfigError(err.message)
    } finally {
      setConfigLoading(false)
    }
  }, [])

  const loadGroups = useCallback(async () => {
    try {
      setGroupsLoading(true)
      setGroupsError(null)
      const res = await fetch(`${window.API_BASE}/test-case-groups`)
      if (!res.ok) throw new Error('Failed to load test case groups')
      const data = await res.json()
      setGroups(data.map(convertGroup))
    } catch (err) {
      setGroupsError(err.message)
    } finally {
      setGroupsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfigs()
    loadGroups()
  }, [loadConfigs, loadGroups])

  return (
    <>
      <EvolutionConfigs
        configs={configs}
        loading={configLoading}
        error={configError}
        onRefresh={loadConfigs}
      />
      <TestCaseGroups
        groups={groups}
        loading={groupsLoading}
        error={groupsError}
        onRefresh={loadGroups}
      />
    </>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
