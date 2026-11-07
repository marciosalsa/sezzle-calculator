import { describe, expect, it } from 'vitest'
import {
  MAX_INPUT_DIGITS,
  expressionLabel,
  formatNumber,
  initialState,
  needsCompute,
  reducer,
  type Action,
  type CalculatorState,
} from './state'

const run = (actions: Action[], from: CalculatorState = initialState) => actions.reduce(reducer, from)
const digits = (s: string): Action[] => [...s].map((d) => ({ type: 'digit', digit: d }))

describe('number entry', () => {
  it('replaces the leading zero', () => {
    expect(run(digits('42')).display).toBe('42')
  })

  it('does not allow multiple leading zeros', () => {
    expect(run(digits('000')).display).toBe('0')
  })

  it('ignores non-digit input', () => {
    expect(run([{ type: 'digit', digit: 'a' }]).display).toBe('0')
  })

  it('accepts a single decimal point', () => {
    expect(run([...digits('1'), { type: 'decimal' }, { type: 'decimal' }, ...digits('5')]).display).toBe('1.5')
  })

  it('starts with "0." when decimal is pressed first', () => {
    expect(run([{ type: 'decimal' }]).display).toBe('0.')
  })

  it(`limits input to ${MAX_INPUT_DIGITS} digits`, () => {
    expect(run(digits('1234567890123456789')).display).toHaveLength(MAX_INPUT_DIGITS)
  })

  it('toggles the sign', () => {
    const negative = run([...digits('7'), { type: 'toggleSign' }])
    expect(negative.display).toBe('-7')
    expect(reducer(negative, { type: 'toggleSign' }).display).toBe('7')
  })

  it('keeps typing after toggling sign on zero', () => {
    expect(run([{ type: 'toggleSign' }, ...digits('5')]).display).toBe('-5')
  })

  it('backspace removes the last character and falls back to 0', () => {
    expect(run([...digits('12'), { type: 'backspace' }]).display).toBe('1')
    expect(run([...digits('1'), { type: 'backspace' }]).display).toBe('0')
    expect(run([...digits('5'), { type: 'toggleSign' }, { type: 'backspace' }]).display).toBe('0')
  })

  it('clearHistory empties the history and keeps the current calculation', () => {
    const state: CalculatorState = {
      ...initialState,
      display: '7',
      accumulator: 3,
      pendingOp: 'add',
      history: [{ id: 1, expression: '1 + 1', result: '2' }],
    }
    const cleared = reducer(state, { type: 'clearHistory' })
    expect(cleared.history).toEqual([])
    expect(cleared).toMatchObject({ display: '7', accumulator: 3, pendingOp: 'add' })
    expect(reducer(cleared, { type: 'clearHistory' })).toBe(cleared)
  })

  it('clear resets everything but keeps history', () => {
    const withHistory: CalculatorState = { ...initialState, display: '9', history: [{ id: 1, expression: '1 + 1', result: '2' }] }
    const cleared = reducer(withHistory, { type: 'clear' })
    expect(cleared.display).toBe('0')
    expect(cleared.history).toHaveLength(1)
  })
})

describe('operators', () => {
  it('stores the accumulator and waits for the second operand', () => {
    const state = run([...digits('12'), { type: 'operatorChosen', op: 'multiply' }])
    expect(state.accumulator).toBe(12)
    expect(state.pendingOp).toBe('multiply')
    expect(expressionLabel(state)).toBe('12 ×')
    expect(needsCompute(state)).toBe(false)
  })

  it('next digit after an operator starts a new number', () => {
    const state = run([...digits('12'), { type: 'operatorChosen', op: 'add' }, ...digits('3')])
    expect(state.display).toBe('3')
    expect(needsCompute(state)).toBe(true)
  })

  it('backspace does nothing right after an operator', () => {
    const state = run([...digits('12'), { type: 'operatorChosen', op: 'add' }, { type: 'backspace' }])
    expect(state.display).toBe('12')
  })

  it('changing the operator before typing replaces it', () => {
    const state = run([...digits('5'), { type: 'operatorChosen', op: 'add' }, { type: 'operatorChosen', op: 'divide' }])
    expect(state.pendingOp).toBe('divide')
    expect(state.accumulator).toBe(5)
  })
})

describe('results', () => {
  const afterAdd = run([...digits('2'), { type: 'operatorChosen', op: 'add' }, ...digits('3'), { type: 'requestStarted' }])

  it('marks loading and ignores input while a request is in flight', () => {
    expect(afterAdd.loading).toBe(true)
    expect(reducer(afterAdd, { type: 'digit', digit: '9' })).toBe(afterAdd)
  })

  it('shows the result and records history on "="', () => {
    const state = reducer(afterAdd, { type: 'binaryResolved', a: 2, op: 'add', b: 3, result: 5, nextOp: null })
    expect(state.display).toBe('5')
    expect(state.pendingOp).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.history[0]).toMatchObject({ expression: '2 + 3', result: '5' })
  })

  it('chains into the next operator', () => {
    const state = reducer(afterAdd, { type: 'binaryResolved', a: 2, op: 'add', b: 3, result: 5, nextOp: 'multiply' })
    expect(state.accumulator).toBe(5)
    expect(state.pendingOp).toBe('multiply')
    expect(state.waitingForOperand).toBe(true)
  })

  it('a digit after a result starts a new number', () => {
    const done = reducer(afterAdd, { type: 'binaryResolved', a: 2, op: 'add', b: 3, result: 5, nextOp: null })
    expect(reducer(done, { type: 'digit', digit: '8' }).display).toBe('8')
  })

  it('a square root becomes the right-hand operand', () => {
    const pending = run([...digits('9'), { type: 'operatorChosen', op: 'add' }, ...digits('16'), { type: 'requestStarted' }])
    const state = reducer(pending, { type: 'unaryResolved', a: 16, result: 4 })
    expect(state.display).toBe('4')
    expect(needsCompute(state)).toBe(true)
    expect(state.history[0]).toMatchObject({ expression: '√16', result: '4' })
  })

  it('keeps at most 10 history entries', () => {
    let state = initialState
    for (let i = 0; i < 15; i++) {
      state = reducer({ ...state, loading: true }, { type: 'binaryResolved', a: i, op: 'add', b: 1, result: i + 1, nextOp: null })
    }
    expect(state.history).toHaveLength(10)
    expect(state.history[0].result).toBe('15')
  })

  it('an error resets the calculation and blocks operators until new input', () => {
    const failed = reducer(afterAdd, { type: 'failed', message: 'Cannot divide by zero' })
    expect(failed.error).toBe('Cannot divide by zero')
    expect(failed.display).toBe('0')
    expect(reducer(failed, { type: 'operatorChosen', op: 'add' })).toBe(failed)
    expect(reducer(failed, { type: 'toggleSign' })).toBe(failed)

    const typed = reducer(failed, { type: 'digit', digit: '4' })
    expect(typed.error).toBeNull()
    expect(typed.display).toBe('4')
  })
})

describe('formatNumber', () => {
  it.each([
    [0.1 + 0.2, '0.3'],
    [5, '5'],
    [-0, '0'],
    [1 / 3, '0.333333333333'],
    [1e21, '1e+21'],
    [-2.5, '-2.5'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatNumber(input)).toBe(expected)
  })
})
