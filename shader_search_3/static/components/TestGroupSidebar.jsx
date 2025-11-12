import React from 'react'

export const TestGroupSidebar = ({
  groups = [],
  selectedGroupId,
  selectedTestId,
  onSelectTest,
  onCreateGroup,
  onCreateTest,
  onDeleteGroup,
}) => {
  const [expandedGroups, setExpandedGroups] = React.useState(new Set())

  React.useEffect(() => {
    // Expand all groups by default
    const allGroupIds = new Set(groups.map(g => g.id))
    setExpandedGroups(allGroupIds)
  }, [groups])

  const handleCreateGroup = () => {
    const name = window.prompt('Enter new group name:', 'New Test Group')
    if (name) {
      onCreateGroup?.(name.trim())
    }
  }

  const confirmDeleteGroup = (groupId, groupName) => {
    const shouldDelete = window.confirm(`Delete test group "${groupName}" and all its tests?`)
    if (shouldDelete) {
      onDeleteGroup?.(groupId)
    }
  }

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  return (
    <div className="test-sidebar">
      <div className="test-sidebar-header">
        <h2>Test Cases</h2>
        <button type="button" className="sidebar-action" onClick={handleCreateGroup}>
          + Group
        </button>
      </div>
      <div className="test-sidebar-groups">
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.id)
          return (
            <div className="sidebar-group" key={group.id}>
              <div className="sidebar-group-header">
                <button
                  type="button"
                  className="sidebar-group-toggle"
                  onClick={() => toggleGroup(group.id)}
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
                <span className="sidebar-group-name">{group.name}</span>
                <div className="sidebar-group-actions">
                  <button
                    type="button"
                    className="sidebar-action"
                    onClick={() => onCreateTest?.(group.id)}
                    title="Add Test"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="sidebar-action danger"
                    onClick={() => confirmDeleteGroup(group.id, group.name)}
                    title="Delete Group"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              {isExpanded && (
                <ul className="sidebar-test-list">
                  {(group.tests ?? []).map((test) => {
                    const isSelected = group.id === selectedGroupId && test.id === selectedTestId
                    return (
                      <li key={test.id || test.name}>
                        <button
                          type="button"
                          className={`sidebar-test ${isSelected ? 'selected' : ''}`}
                          onClick={() => onSelectTest?.(group.id, test.id)}
                        >
                          {test.name}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
