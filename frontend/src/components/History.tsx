import type { HistoryEntry } from '../calculator/state'

interface Props {
  entries: HistoryEntry[]
  onClear: () => void
}

/**
 * Rendered as two siblings (the list box and the clear button) so the button
 * can sit outside the box: right below it on desktop, pinned to the bottom of
 * the history panel on phones.
 */
export function History({ entries, onClear }: Props) {
  return (
    <>
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
      {entries.length > 0 && (
        <button type="button" className="history-clear" onClick={onClear}>
          Clear history
        </button>
      )}
    </>
  )
}
