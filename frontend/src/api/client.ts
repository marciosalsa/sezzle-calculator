/**
 * Thin typed client for the calculator REST API.
 *
 * The client never does arithmetic itself: every calculation is delegated to
 * the backend so there is a single source of truth for the math rules.
 */

export type BinaryOperation =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'power'
  | 'percentage'

export type UnaryOperation = 'sqrt'

export type Operation = BinaryOperation | UnaryOperation

export interface CalculationResult {
  operation: Operation
  operands: number[]
  result: number
}

interface ErrorBody {
  error: { code: string; message: string }
}

/** Error raised for any failed API call, carrying the backend error code. */
export class CalculatorApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'CalculatorApiError'
    this.code = code
    this.status = status
  }
}

/** User-friendly messages for the error codes the backend can return. */
const FRIENDLY_MESSAGES: Record<string, string> = {
  DIVISION_BY_ZERO: 'Cannot divide by zero',
  NEGATIVE_SQUARE_ROOT: 'Cannot take the square root of a negative number',
  RESULT_OUT_OF_RANGE: 'Result is too large to represent',
  INVALID_OPERAND: 'Invalid number',
  NETWORK_ERROR: 'Cannot reach the calculator service',
}

export function friendlyMessage(error: unknown): string {
  if (error instanceof CalculatorApiError) {
    return FRIENDLY_MESSAGES[error.code] ?? error.message
  }
  return 'Something went wrong'
}

const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL ?? ''

export interface CalculatorClient {
  calculate(op: BinaryOperation, a: number, b: number): Promise<number>
  calculate(op: UnaryOperation, a: number): Promise<number>
}

export function createClient(
  baseUrl: string = DEFAULT_BASE_URL,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): CalculatorClient {
  async function calculate(op: Operation, a: number, b?: number): Promise<number> {
    const body = b === undefined ? { a } : { a, b }

    let response: Response
    try {
      response = await fetchImpl(`${baseUrl}/api/v1/${op}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new CalculatorApiError('NETWORK_ERROR', 'Network request failed', 0)
    }

    const payload: unknown = await response.json().catch(() => null)

    if (!response.ok) {
      const err = (payload as ErrorBody | null)?.error
      throw new CalculatorApiError(
        err?.code ?? 'UNKNOWN_ERROR',
        err?.message ?? `Request failed with status ${response.status}`,
        response.status,
      )
    }

    const result = (payload as CalculationResult | null)?.result
    if (typeof result !== 'number') {
      throw new CalculatorApiError('INVALID_RESPONSE', 'Unexpected response from server', response.status)
    }
    return result
  }

  return { calculate } as CalculatorClient
}

export const apiClient = createClient()
