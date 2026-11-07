import { useCallback, useReducer } from 'react'
import { apiClient, friendlyMessage, type BinaryOperation, type CalculatorClient } from '../api/client'
import { currentValue, initialState, needsCompute, reducer } from './state'

/**
 * Connects the pure reducer to the backend. Every arithmetic result comes
 * from the API; this hook only orchestrates requests and dispatches outcomes.
 */
export function useCalculator(client: CalculatorClient = apiClient) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const computePending = useCallback(
    async (nextOp: BinaryOperation | null) => {
      const op = state.pendingOp
      const a = state.accumulator
      if (op === null || a === null) return
      const b = currentValue(state)

      dispatch({ type: 'requestStarted' })
      try {
        const result = await client.calculate(op, a, b)
        dispatch({ type: 'binaryResolved', a, op, b, result, nextOp })
      } catch (error) {
        dispatch({ type: 'failed', message: friendlyMessage(error) })
      }
    },
    [client, state],
  )

  const chooseOperator = useCallback(
    (op: BinaryOperation) => {
      if (state.loading) return
      if (needsCompute(state)) {
        void computePending(op) // chaining: 2 + 3 × → computes 5, then waits for ×
      } else {
        dispatch({ type: 'operatorChosen', op })
      }
    },
    [computePending, state],
  )

  const equals = useCallback(() => {
    if (!state.loading && needsCompute(state)) void computePending(null)
  }, [computePending, state])

  const squareRoot = useCallback(async () => {
    if (state.loading || state.error) return
    const a = currentValue(state)
    dispatch({ type: 'requestStarted' })
    try {
      const result = await client.calculate('sqrt', a)
      dispatch({ type: 'unaryResolved', a, result })
    } catch (error) {
      dispatch({ type: 'failed', message: friendlyMessage(error) })
    }
  }, [client, state])

  return {
    state,
    inputDigit: (digit: string) => dispatch({ type: 'digit', digit }),
    inputDecimal: () => dispatch({ type: 'decimal' }),
    toggleSign: () => dispatch({ type: 'toggleSign' }),
    backspace: () => dispatch({ type: 'backspace' }),
    clear: () => dispatch({ type: 'clear' }),
    clearHistory: () => dispatch({ type: 'clearHistory' }),
    chooseOperator,
    equals,
    squareRoot,
  }
}
