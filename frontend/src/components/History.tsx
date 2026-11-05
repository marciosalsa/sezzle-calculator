import type { HistoryEntry } from '../calculator/state'

export function History({ entries }: { entries: HistoryEntry[] }) {
  return (
    <aside className="history" aria-label="History">
      <h2>History</h2>
      {entries.length === 0 ? (
        <p className="history-empty">Your last calculations will show up here.</p>
      ) : (
        <ol>
          {entries.map((entry) => (
            <li key={entry.id}>
              <span className="history-expr">{entry.expression} =</span>
              <span className="history-result">{entry.result}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
