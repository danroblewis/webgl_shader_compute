import React from 'react'
import { TestGroupSidebar } from './TestGroupSidebar.jsx'
import { TestCaseViewer } from './TestCaseViewer.jsx'
import { TestCaseEditor } from './TestCaseEditor.jsx'
import { TestToolbar } from './TestToolbar.jsx'

const cloneCell = (cell) => {
  const next = new Float32Array(4)
  next[0] = cell?.[0] ?? 0
  next[1] = cell?.[1] ?? 0
  next[2] = cell?.[2] ?? 0
  next[3] = cell?.[3] ?? 0
  return next
}

const cloneFrame = (frame) => frame.map((row) => row.map(cloneCell))
const cloneTest = (test) => ({
  ...test,
  frames: test.frames.map(cloneFrame),
})

export const TestEditor = ({
  groups = [],
  loading = false,
  error = null,
  saving = false,
  onRefresh,
  onCreateGroup,
  onDeleteGroup,
  onCreateTest,
  onSaveTest,
  onDeleteTest,
  channelIndex = 0,
}) => {
  const [selectedGroupId, setSelectedGroupId] = React.useState(null)
  const [selectedTestId, setSelectedTestId] = React.useState(null)
  const [mode, setMode] = React.useState('view')
  const [draftTest, setDraftTest] = React.useState(null)

  React.useEffect(() => {
    if (!groups.length) {
      setSelectedGroupId(null)
      setSelectedTestId(null)
      setDraftTest(null)
      setMode('view')
      return
    }
    const group = groups.find((g) => g.id === selectedGroupId) ?? groups[0]
    const test = group.tests?.find((t) => t.id === selectedTestId) ?? group.tests?.[0]
    setSelectedGroupId(group?.id ?? null)
    setSelectedTestId(test?.id ?? null)
    if (!test) {
      setDraftTest(null)
      setMode('view')
    }
  }, [groups])

  const selectedGroup = React.useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  )

  const selectedTest = React.useMemo(() => {
    if (!selectedGroup) return null
    return selectedGroup.tests?.find((test) => test.id === selectedTestId) ?? null
  }, [selectedGroup, selectedTestId])

  const handleSelectTest = (groupId, testId) => {
    setSelectedGroupId(groupId)
    setSelectedTestId(testId)
    setDraftTest(null)
    setMode('view')
  }

  const handleAddTest = async (groupId) => {
    const targetGroup = groups.find((group) => group.id === groupId)
    if (!targetGroup) return
    try {
      const created = await onCreateTest?.(groupId)
      if (created) {
        setSelectedGroupId(groupId)
        setSelectedTestId(created.id)
        setDraftTest(cloneTest(created))
        setMode('edit')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteGroup = async (groupId) => {
    await onDeleteGroup?.(groupId)
    setDraftTest(null)
    setMode('view')
  }

  const startEdit = () => {
    if (!selectedTest) return
    setDraftTest(cloneTest(selectedTest))
    setMode('edit')
  }

  const cancelEdit = () => {
    setDraftTest(null)
    setMode('view')
  }

  const saveEdit = async () => {
    if (!draftTest || !selectedGroupId) return
    await onSaveTest?.(selectedGroupId, draftTest)
    setDraftTest(null)
    setMode('view')
  }

  const deleteTest = async () => {
    if (!selectedGroupId || !selectedTestId) return
    const shouldDelete = window.confirm('Delete this test case?')
    if (!shouldDelete) return
    await onDeleteTest?.(selectedGroupId, selectedTestId)
    setDraftTest(null)
    setMode('view')
  }

  return (
    <div className="test-editor">
      <TestGroupSidebar
        groups={groups}
        selectedGroupId={selectedGroupId}
        selectedTestId={selectedTestId}
        onSelectTest={handleSelectTest}
        onCreateGroup={onCreateGroup}
        onCreateTest={handleAddTest}
        onDeleteGroup={handleDeleteGroup}
      />
      <div className="test-content">
        <TestToolbar
          hasSelection={Boolean(selectedTest)}
          mode={mode}
          saving={saving}
          onRefresh={onRefresh}
          onEdit={startEdit}
          onCancel={cancelEdit}
          onSave={saveEdit}
          onDelete={deleteTest}
        />
        {error && <div className="error">{error}</div>}
        {loading ? (
          <div className="test-viewer-empty">Loading test cases…</div>
        ) : mode === 'edit' ? (
          <TestCaseEditor test={draftTest} onChange={setDraftTest} channelIndex={channelIndex} />
        ) : (
          <TestCaseViewer test={selectedTest} channelIndex={channelIndex} />
        )}
      </div>
    </div>
  )
}

