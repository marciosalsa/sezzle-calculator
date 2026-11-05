/**
 * Pure calculator state machine.
 *
 * Keeping all UI state transitions in a reducer (no I/O, no React) makes the
 * behaviour easy to reason about and to unit test exhaustively. Side effects
 * (API calls) live in `useCalculator`, which dispatches the outcome here.
 */
import type { BinaryOperation } from '../api/client'

export const MAX_INPUT_DIGITS = 15

export const OPERATOR_SYMBOLS: Record<BinaryOperation, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  power: '^',
  percentage: '% of',
}

export interface HistoryEntry {
  id: number
  expression: string
  result: string
}

export interface CalculatorState {
  /** What the main display shows: the number being typed or the last result. */
  display: string
  /** Left operand of the pending operation. */
  accumulator: number | null
  pendingOp: BinaryOperation | null
  /** True right after choosing an operator: no right-hand operand typed yet. */
  waitingForOperand: boolean
  /** True when the display holds a finished value: the next digit replaces it. */
  overwrite: boolean
  loading: boolean
  error: string | null
  history: HistoryEntry[]
}

export const initialState: CalculatorState = {
  display: '0',
  accumulator: null,
  pendingOp: null,
  waitingForOperand: false,
  overwrite: false,
  loading: false,
  error: null,
  history: [],
}

export type Action =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'toggleSign' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'operatorChosen'; op: BinaryOperation }
  | { type: 'requestStarted' }
  | { type: 'binaryResolved'; a: number; op: BinaryOperation; b: number; result: number; nextOp: BinaryOperation | null }
  | { type: 'unaryResolved'; a: number; result: number }
  | { type: 'failed'; message: string }

/** Formats a result for display, hiding floating point noise (0.1 + 0.2). */
export function formatNumber(value: number): string {
  if (Object.is(value, -0)) return '0'
  return String(Number(value.toPrecision(12)))
}

export function currentValue(state: CalculatorState): number {
  return Number(state.display)
}

/** Whether pressing "=" or another operator must first call the backend. */
export function needsCompute(state: CalculatorState): boolean {
  return state.pendingOp !== null && state.accumulator !== null && !state.waitingForOperand
}

/** Text shown above the display, e.g. "12 ×". */
export function expressionLabel(state: CalculatorState): string {
  if (state.pendingOp === null || state.accumulator === null) return ''
  return `${formatNumber(state.accumulator)} ${OPERATOR_SYMBOLS[state.pendingOp]}`
}

function digitCount(display: string): number {
  return display.replace(/[-.]/g, '').length
}

let nextHistoryId = 1

function addHistory(state: CalculatorState, expression: string, result: string): HistoryEntry[] {
  return [{ id: nextHistoryId++, expression, result }, ...state.history].slice(0, 10)
}

/** Starts a fresh number when the previous one is "done" (after operator/result/error). */
function startingFresh(state: CalculatorState): boolean {
  return state.overwrite || state.error !== null
}

export function reducer(state: CalculatorState, action: Action): CalculatorState {
  // Ignore input while a request is in flight to avoid racing results.
  if (state.loading && action.type !== 'binaryResolved' && action.type !== 'unaryResolved' && action.type !== 'failed') {
    return state
  }

  switch (action.type) {
    case 'digit': {
      if (!/^[0-9]$/.test(action.digit)) return state
      if (startingFresh(state)) {
        return { ...state, display: action.digit, waitingForOperand: false, overwrite: false, error: null }
      }
      if (digitCount(state.display) >= MAX_INPUT_DIGITS) return state
      const display =
        state.display === '0' ? action.digit : state.display === '-0' ? `-${action.digit}` : state.display + action.digit
      return { ...state, display }
    }

    case 'decimal': {
      if (startingFresh(state)) {
        return { ...state, display: '0.', waitingForOperand: false, overwrite: false, error: null }
      }
      if (state.display.includes('.')) return state
      return { ...state, display: `${state.display}.` }
    }

    case 'toggleSign': {
      if (state.error) return state
      const display = state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}`
      // Toggling a finished result edits it in place, so it is no longer "waiting".
      return { ...state, display, waitingForOperand: false, overwrite: false }
    }

    case 'backspace': {
      if (startingFresh(state)) return state
      const trimmed = state.display.slice(0, -1)
      const display = trimmed === '' || trimmed === '-' ? '0' : trimmed
      return { ...state, display }
    }

    case 'clear':
      return { ...initialState, history: state.history }

    case 'operatorChosen':
      if (state.error) return state
      return {
        ...state,
        accumulator: currentValue(state),
        pendingOp: action.op,
        waitingForOperand: true,
        overwrite: true,
      }

    case 'requestStarted':
      return { ...state, loading: true, error: null }

    case 'binaryResolved': {
      const result = formatNumber(action.result)
      const expression = `${formatNumber(action.a)} ${OPERATOR_SYMBOLS[action.op]} ${formatNumber(action.b)}`
      return {
        ...state,
        display: result,
        accumulator: action.nextOp ? action.result : null,
        pendingOp: action.nextOp,
        waitingForOperand: action.nextOp !== null,
        overwrite: true,
        loading: false,
        history: addHistory(state, expression, result),
      }
    }

    case 'unaryResolved': {
      const result = formatNumber(action.result)
      return {
        ...state,
        display: result,
        // The root becomes the current operand, e.g. "9 + √16 =" gives 13.
        waitingForOperand: false,
        overwrite: true,
        loading: false,
        history: addHistory(state, `√${formatNumber(action.a)}`, result),
      }
    }

    case 'failed':
      return {
        ...initialState,
        history: state.history,
        error: action.message,
      }
  }
}
