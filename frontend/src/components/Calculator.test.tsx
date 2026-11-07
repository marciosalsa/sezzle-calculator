import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CalculatorApiError, type CalculatorClient, type Operation } from '../api/client'
import { Calculator } from './Calculator'

/** Fake backend that does the math locally so UI tests stay fast and deterministic. */
function fakeClient(): CalculatorClient & { calls: [Operation, number[]][] } {
  const calls: [Operation, number[]][] = []
  const calculate = vi.fn(async (op: Operation, a: number, b?: number) => {
    calls.push([op, b === undefined ? [a] : [a, b]])
    switch (op) {
      case 'add': return a + b!
      case 'subtract': return a - b!
      case 'multiply': return a * b!
      case 'divide':
        if (b === 0) throw new CalculatorApiError('DIVISION_BY_ZERO', 'division by zero', 422)
        return a / b!
      case 'power': return a ** b!
      case 'percentage': return (a * b!) / 100
      case 'sqrt':
        if (a < 0) throw new CalculatorApiError('NEGATIVE_SQUARE_ROOT', 'negative', 422)
        return Math.sqrt(a)
    }
  })
  return { calculate: calculate as unknown as CalculatorClient['calculate'], calls }
}

const display = () => screen.getByTestId('display')

async function press(...labels: string[]) {
  const user = userEvent.setup()
  for (const label of labels) {
    await user.click(screen.getByRole('button', { name: label }))
  }
}

describe('<Calculator />', () => {
  it('starts at zero with empty history', () => {
    render(<Calculator client={fakeClient()} />)
    expect(display()).toHaveTextContent('0')
    expect(screen.getByText(/last calculations will show up here/i)).toBeInTheDocument()
  })

  it('adds two numbers through the API', async () => {
    const client = fakeClient()
    render(<Calculator client={client} />)

    await press('1', '2', 'Add', '3', 'Equals')

    await waitFor(() => expect(display()).toHaveTextContent('15'))
    expect(client.calls).toEqual([['add', [12, 3]]])
    expect(screen.getByText('12 + 3 =')).toBeInTheDocument()
  })

  it('chains operations left to right', async () => {
    const client = fakeClient()
    render(<Calculator client={client} />)

    await press('2', 'Add', '3', 'Multiply')
    await waitFor(() => expect(display()).toHaveTextContent('5'))
    expect(screen.getByTestId('expression')).toHaveTextContent('5 ×')

    await press('4', 'Equals')
    await waitFor(() => expect(display()).toHaveTextContent('20'))
  })

  it('shows a friendly error on division by zero and recovers on next input', async () => {
    render(<Calculator client={fakeClient()} />)

    await press('8', 'Divide', '0', 'Equals')

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot divide by zero')
    await press('7')
    expect(display()).toHaveTextContent('7')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('computes square roots and uses them as operands', async () => {
    const client = fakeClient()
    render(<Calculator client={client} />)

    await press('9', 'Add', '1', '6', 'Square root')
    await waitFor(() => expect(display()).toHaveTextContent('4'))
    await press('Equals')
    await waitFor(() => expect(display()).toHaveTextContent('13'))
    expect(client.calls).toEqual([
      ['sqrt', [16]],
      ['add', [9, 4]],
    ])
  })

  it('rejects the square root of a negative number', async () => {
    render(<Calculator client={fakeClient()} />)
    await press('4', 'Toggle sign', 'Square root')
    expect(await screen.findByRole('alert')).toHaveTextContent(/negative/i)
  })

  it('supports power and percentage', async () => {
    render(<Calculator client={fakeClient()} />)

    await press('2', 'Power', '1', '0', 'Equals')
    await waitFor(() => expect(display()).toHaveTextContent('1024'))

    await press('Clear', '1', '5', 'Percent of', '2', '0', '0', 'Equals')
    await waitFor(() => expect(display()).toHaveTextContent('30'))
  })

  it('edits input with decimal, backspace and clear', async () => {
    render(<Calculator client={fakeClient()} />)

    await press('Decimal point', '5', 'Decimal point', '2')
    expect(display()).toHaveTextContent('0.52')
    await press('Backspace')
    expect(display()).toHaveTextContent('0.5')
    await press('Clear')
    expect(display()).toHaveTextContent('0')
  })

  it('clears the history without touching the current result', async () => {
    render(<Calculator client={fakeClient()} />)
    expect(screen.queryByRole('button', { name: 'Clear history' })).not.toBeInTheDocument()

    await press('2', 'Multiply', '4', 'Equals')
    await waitFor(() => expect(screen.getByText('2 × 4 =')).toBeInTheDocument())

    await press('Clear history')
    expect(screen.queryByText('2 × 4 =')).not.toBeInTheDocument()
    expect(screen.getByText(/last calculations will show up here/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear history' })).not.toBeInTheDocument()
    expect(display()).toHaveTextContent('8')
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument() // badge gone
  })

  it('highlights the pending operator', async () => {
    render(<Calculator client={fakeClient()} />)
    await press('3', 'Subtract')
    expect(screen.getByRole('button', { name: 'Subtract' })).toHaveClass('active')
  })

  it('supports keyboard input', async () => {
    const client = fakeClient()
    render(<Calculator client={client} />)

    for (const key of ['6', '*', '7']) fireEvent.keyDown(window, { key })
    fireEvent.keyDown(window, { key: 'Enter' })
    await waitFor(() => expect(display()).toHaveTextContent('42'))

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(display()).toHaveTextContent('0')

    for (const key of ['8', '1', 'Backspace', ',', '5']) fireEvent.keyDown(window, { key })
    expect(display()).toHaveTextContent('8.5')

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: '4' })
    fireEvent.keyDown(window, { key: 'r' })
    await waitFor(() => expect(display()).toHaveTextContent('2'))

    // Unmapped keys and shortcuts are ignored.
    fireEvent.keyDown(window, { key: 'q' })
    fireEvent.keyDown(window, { key: '9', ctrlKey: true })
    expect(display()).toHaveTextContent('2')
  })

  describe('mobile panels', () => {
    function mockPanelWidth(width: number) {
      const panels = screen.getByTestId('panels')
      Object.defineProperty(panels, 'clientWidth', { configurable: true, value: width })
      const scrollTo = vi.fn(({ left }: ScrollToOptions) => {
        panels.scrollLeft = left ?? 0
      })
      Object.defineProperty(panels, 'scrollTo', { configurable: true, value: scrollTo })
      return { panels, scrollTo }
    }

    it('starts on the calculator tab', () => {
      render(<Calculator client={fakeClient()} />)
      expect(screen.getByRole('button', { name: 'Calculator' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('scrolls to the history panel when its tab is tapped', async () => {
      render(<Calculator client={fakeClient()} />)
      const { scrollTo } = mockPanelWidth(375)

      await press('History')

      expect(scrollTo).toHaveBeenCalledWith({ left: 375 })
      expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-pressed', 'true')

      await press('Calculator')
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 0 })
    })

    it('updates the active tab when the user swipes', () => {
      render(<Calculator client={fakeClient()} />)
      const { panels } = mockPanelWidth(375)

      panels.scrollLeft = 300 // past the midpoint
      fireEvent.scroll(panels)
      expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-pressed', 'true')

      panels.scrollLeft = 50
      fireEvent.scroll(panels)
      expect(screen.getByRole('button', { name: 'Calculator' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('ignores scroll events before layout (zero width)', () => {
      render(<Calculator client={fakeClient()} />)
      const { panels } = mockPanelWidth(0)
      panels.scrollLeft = 300
      fireEvent.scroll(panels)
      expect(screen.getByRole('button', { name: 'Calculator' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('shows how many results are in the history', async () => {
      render(<Calculator client={fakeClient()} />)
      await press('1', 'Add', '1', 'Equals')
      await waitFor(() => expect(screen.getByRole('button', { name: 'History (1)' })).toBeInTheDocument())
    })
  })
})
