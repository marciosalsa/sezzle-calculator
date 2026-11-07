import { Calculator } from './components/Calculator'
import { ThemeToggle } from './theme/ThemeToggle'
import { useTheme } from './theme/useTheme'

export default function App() {
  const { theme, toggle } = useTheme()

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>Calculator</h1>
          <p>React + TypeScript frontend · Go REST backend</p>
        </div>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </header>
      <Calculator />
      <footer className="app-footer">
        Keyboard: digits, <kbd>+</kbd> <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd> <kbd>^</kbd> <kbd>%</kbd>,{' '}
        <kbd>r</kbd> for √, <kbd>Enter</kbd>, <kbd>Backspace</kbd>, <kbd>Esc</kbd>
      </footer>
    </main>
  )
}
