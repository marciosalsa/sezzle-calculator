import { useEffect, useRef, useState } from 'react'
import type { BinaryOperation, CalculatorClient } from '../api/client'
import { expressionLabel } from '../calculator/state'
import { useCalculator } from '../calculator/useCalculator'
import { History } from './History'

const KEY_TO_OPERATOR: Record<string, BinaryOperation> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  x: 'multiply',
  '/': 'divide',
  '^': 'power',
  '%': 'percentage',
}

interface Props {
  client?: CalculatorClient
}

type Panel = 0 | 1 // 0 = calculator, 1 = history (only relevant on small screens)

export function Calculator({ client }: Props) {
  const calc = useCalculator(client)
  const { state } = calc

  // Keep the latest handlers in a ref so the keyboard listener is attached once.
  const calcRef = useRef(calc)
  useEffect(() => {
    calcRef.current = calc
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const c = calcRef.current
      const { key } = event

      if (/^[0-9]$/.test(key)) c.inputDigit(key)
      else if (key === '.' || key === ',') c.inputDecimal()
      else if (key in KEY_TO_OPERATOR) c.chooseOperator(KEY_TO_OPERATOR[key])
      else if (key === 'Enter' || key === '=') c.equals()
      else if (key === 'Backspace') c.backspace()
      else if (key === 'Escape' || key === 'Delete') c.clear()
      else if (key === 'r') void c.squareRoot()
      else return

      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const op = (operation: BinaryOperation, label: string, aria: string) => (
    <Key
      label={label}
      aria={aria}
      variant={state.pendingOp === operation && state.waitingForOperand ? 'operator active' : 'operator'}
      onPress={() => calc.chooseOperator(operation)}
    />
  )

  // On small screens the two panels sit side by side in a horizontal scroll
  // container with CSS scroll-snap, so swiping is native. The tabs mirror the
  // scroll position and let users jump between panels without swiping.
  const panelsRef = useRef<HTMLDivElement>(null)
  const [activePanel, setActivePanel] = useState<Panel>(0)

  const showPanel = (panel: Panel) => {
    const el = panelsRef.current
    el?.scrollTo?.({ left: panel * el.clientWidth })
    setActivePanel(panel)
  }

  const onPanelsScroll = () => {
    const el = panelsRef.current
    if (!el || el.clientWidth === 0) return
    setActivePanel(el.scrollLeft > el.clientWidth / 2 ? 1 : 0)
  }

  const digit = (d: string, extra = '') => (
    <Key label={d} variant={`digit ${extra}`} onPress={() => calc.inputDigit(d)} />
  )

  return (
    <>
      <div className="panel-tabs" role="group" aria-label="Choose panel">
        <button
          type="button"
          className={`panel-tab ${activePanel === 0 ? 'active' : ''}`}
          aria-pressed={activePanel === 0}
          onClick={() => showPanel(0)}
        >
          Calculator
        </button>
        <button
          type="button"
          className={`panel-tab ${activePanel === 1 ? 'active' : ''}`}
          aria-pressed={activePanel === 1}
          aria-label={state.history.length > 0 ? `History (${state.history.length})` : 'History'}
          onClick={() => showPanel(1)}
        >
          History
          {state.history.length > 0 && <span className="badge" aria-hidden="true">{state.history.length}</span>}
        </button>
      </div>

      <div className="layout" ref={panelsRef} onScroll={onPanelsScroll} data-testid="panels">
        <div className="panel">
          <section className="calculator" aria-label="Calculator">
            <div className="screen" aria-busy={state.loading}>
              <div className="expression" data-testid="expression">
                {expressionLabel(state) || ' '}
              </div>
              <output className="display" data-testid="display" aria-live="polite" aria-label="Result">
                {state.display}
              </output>
              <div className={`status ${state.error ? 'is-error' : ''}`} role={state.error ? 'alert' : undefined}>
                {state.error ?? (state.loading ? 'Calculating…' : ' ')}
              </div>
            </div>

            <div className="keypad">
              <Key label="C" aria="Clear" variant="fn" onPress={calc.clear} />
              <Key label="⌫" aria="Backspace" variant="fn" onPress={calc.backspace} />
              <Key label="±" aria="Toggle sign" variant="fn" onPress={calc.toggleSign} />
              {op('divide', '÷', 'Divide')}

              {op('power', 'xʸ', 'Power')}
              <Key label="√x" aria="Square root" variant="operator" onPress={() => void calc.squareRoot()} />
              {op('percentage', '% of', 'Percent of')}
              {op('multiply', '×', 'Multiply')}

              {digit('7')}
              {digit('8')}
              {digit('9')}
              {op('subtract', '−', 'Subtract')}

              {digit('4')}
              {digit('5')}
              {digit('6')}
              {op('add', '+', 'Add')}

              {digit('1')}
              {digit('2')}
              {digit('3')}
              <Key label="=" aria="Equals" variant="equals" onPress={calc.equals} />

              {digit('0', 'wide')}
              <Key label="." aria="Decimal point" variant="digit" onPress={calc.inputDecimal} />
            </div>
          </section>
        </div>

        <div className="panel">
          <History entries={state.history} onClear={calc.clearHistory} />
        </div>
      </div>
    </>
  )
}

interface KeyProps {
  label: string
  aria?: string
  variant: string
  onPress: () => void
}

function Key({ label, aria, variant, onPress }: KeyProps) {
  return (
    <button type="button" className={`key ${variant}`} aria-label={aria ?? label} onClick={onPress}>
      {label}
    </button>
  )
}
