import { describe, expect, it, vi } from 'vitest'
import { CalculatorApiError, createClient, friendlyMessage } from './client'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createClient', () => {
  it('POSTs a binary operation and returns the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { operation: 'add', operands: [2, 3], result: 5 }))
    const client = createClient('http://api.test', fetchMock)

    await expect(client.calculate('add', 2, 3)).resolves.toBe(5)
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/v1/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 2, b: 3 }),
    })
  })

  it('sends only "a" for unary operations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { result: 3 }))
    const client = createClient('', fetchMock)

    await client.calculate('sqrt', 9)
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ a: 9 }))
  })

  it('throws a CalculatorApiError with the backend error code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(422, { error: { code: 'DIVISION_BY_ZERO', message: 'division by zero' } }))
    const client = createClient('', fetchMock)

    const error = await client.calculate('divide', 1, 0).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CalculatorApiError)
    expect(error).toMatchObject({ code: 'DIVISION_BY_ZERO', status: 422 })
  })

  it('handles non-JSON error responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 }))
    const client = createClient('', fetchMock)

    await expect(client.calculate('add', 1, 1)).rejects.toMatchObject({ code: 'UNKNOWN_ERROR', status: 502 })
  })

  it('maps network failures to NETWORK_ERROR', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createClient('', fetchMock)

    await expect(client.calculate('add', 1, 1)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })

  it('rejects a success response without a numeric result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { result: 'oops' }))
    const client = createClient('', fetchMock)

    await expect(client.calculate('add', 1, 1)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})

describe('friendlyMessage', () => {
  it('translates known codes', () => {
    expect(friendlyMessage(new CalculatorApiError('DIVISION_BY_ZERO', 'x', 422))).toBe('Cannot divide by zero')
  })

  it('falls back to the server message for unknown codes', () => {
    expect(friendlyMessage(new CalculatorApiError('SOMETHING_NEW', 'server says hi', 400))).toBe('server says hi')
  })

  it('has a generic message for unexpected errors', () => {
    expect(friendlyMessage(new Error('boom'))).toBe('Something went wrong')
  })
})
