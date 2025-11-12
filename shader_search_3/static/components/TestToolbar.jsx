export const TestToolbar = ({
  hasSelection,
  mode,
  saving = false,
  onRefresh,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}) => (
  <div className="test-toolbar">
    <div className="toolbar-left">
      <button type="button" onClick={onRefresh}>
        Refresh
      </button>
      {mode === 'view' && (
        <button type="button" disabled={!hasSelection} onClick={onEdit}>
          Edit
        </button>
      )}
      {mode === 'edit' && (
        <>
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </>
      )}
    </div>
    <div className="toolbar-right">
      <button type="button" className="danger" onClick={onDelete} disabled={!hasSelection || saving}>
        Delete Test
      </button>
    </div>
  </div>
)
