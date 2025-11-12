import { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { EvolutionConfigs } from './components/EvolutionConfigs.jsx'
import { TestEditor } from './components/TestEditor.jsx'

const API_BASE = '/api'

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
const convertGroup = (group) => ({ ...group, tests: (group.tests ?? []).map(convertTest) })

const serializeCell = (cell) => Array.from(cell)
const serializeFrame = (frame) => frame.map((row) => row.map(serializeCell))
const serializeTest = (test) => ({
  ...test,
  frames: test.frames.map(serializeFrame),
})
const serializeGroup = (group) => ({
  ...group,
  tests: (group.tests ?? []).map(serializeTest),
})

const createFloatCell = (value = 0) => {
  const cell = new Float32Array(4)
  cell[0] = value
  return cell
}

const createEmptyTest = (width = 4, height = 4, frameCount = 1, name = 'New Test') => {
  const frames = Array.from({ length: frameCount }, () =>
    Array.from({ length: height }, () => Array.from({ length: width }, () => createFloatCell(0))),
  )
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `test-${Date.now()}`
  return {
    id,
    name,
    description: '',
    width,
    height,
    frames,
  }
}

const App = () => {
  const [configs, setConfigs] = useState([])
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState(null)

  const [groups, setGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsError, setGroupsError] = useState(null)
  const [groupsSaving, setGroupsSaving] = useState(false)

  const loadConfigs = useCallback(async () => {
    try {
      setConfigLoading(true)
      setConfigError(null)
      const res = await fetch(`${API_BASE}/evolution-configs`)
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
      const res = await fetch(`${API_BASE}/test-case-groups`)
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

  const saveGroup = async (groupId, updatedGroup) => {
    setGroupsSaving(true)
    try {
      const res = await fetch(`${API_BASE}/test-case-groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeGroup(updatedGroup)),
      })
      if (!res.ok) throw new Error('Failed to save test case group')
      const savedGroup = convertGroup(await res.json())
      await loadGroups()
      return savedGroup
    } catch (err) {
      setGroupsError(err.message)
      throw err
    } finally {
      setGroupsSaving(false)
    }
  }

  const handleCreateGroup = async (name) => {
    setGroupsSaving(true)
    try {
      const payload = {
        name,
        description: '',
        tests: [],
      }
      const res = await fetch(`${API_BASE}/test-case-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to create group')
      await loadGroups()
    } catch (err) {
      setGroupsError(err.message)
      throw err
    } finally {
      setGroupsSaving(false)
    }
  }

  const handleDeleteGroup = async (groupId) => {
    setGroupsSaving(true)
    try {
      const res = await fetch(`${API_BASE}/test-case-groups/${groupId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete group')
      await loadGroups()
    } catch (err) {
      setGroupsError(err.message)
      throw err
    } finally {
      setGroupsSaving(false)
    }
  }

  const handleCreateTest = async (groupId) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return null
    const width = group.tests?.[0]?.width ?? 4
    const height = group.tests?.[0]?.height ?? 4
    const newTest = createEmptyTest(width, height)
    const updatedGroup = {
      ...group,
      tests: [...(group.tests ?? []), newTest],
    }
    const savedGroup = await saveGroup(groupId, updatedGroup)
    return savedGroup.tests.find((test) => test.id === newTest.id) ?? null
  }

  const handleSaveTest = async (groupId, test) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return null
    const tests = group.tests ?? []
    const existingIndex = tests.findIndex((t) => t.id === test.id)
    let updatedTests
    if (existingIndex >= 0) {
      updatedTests = tests.map((existing, idx) => (idx === existingIndex ? test : existing))
    } else {
      updatedTests = [...tests, test]
    }
    const updatedGroup = { ...group, tests: updatedTests }
    await saveGroup(groupId, updatedGroup)
  }

  const handleDeleteTest = async (groupId, testId) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    const updatedTests = (group.tests ?? []).filter((test) => test.id !== testId)
    const updatedGroup = { ...group, tests: updatedTests }
    await saveGroup(groupId, updatedGroup)
  }

  return (
    <>
      <EvolutionConfigs
        configs={configs}
        loading={configLoading}
        error={configError}
        onRefresh={loadConfigs}
      />
      <TestEditor
        groups={groups}
        loading={groupsLoading}
        saving={groupsSaving}
        error={groupsError}
        onRefresh={loadGroups}
        onCreateGroup={handleCreateGroup}
        onDeleteGroup={handleDeleteGroup}
        onCreateTest={handleCreateTest}
        onSaveTest={handleSaveTest}
        onDeleteTest={handleDeleteTest}
      />
    </>
  )
}

const root = createRoot(document.getElementById('root'))
root.render(<App />)
