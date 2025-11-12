import { TestCaseCard } from './TestCaseCard.jsx'

export const TestCaseGroupCard = ({ group, channelIndex = 0 }) => {
  if (!group) return null

  return (
    <div className="card test-case-group">
      <div className="test-case-group-header">
        <h3>{group.name}</h3>
        {group.description && <p>{group.description}</p>}
        <div className="meta">{group.tests?.length ?? 0} test(s)</div>
      </div>
      <div className="test-case-group-body">
        {(group.tests ?? []).map((test) => (
          <TestCaseCard key={test.id || test.name} test={test} channelIndex={channelIndex} />
        ))}
      </div>
    </div>
  )
}
