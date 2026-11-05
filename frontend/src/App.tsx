import { Calculator } from './components/Calculator'

export default function App() {
  return (
    <main className="app">
      <header className="app-header">
        <h1>Calculator</h1>
        <p>React + TypeScript frontend · Go REST backend</p>
      </header>
      <Calculator />
      <footer className="app-footer">
        Keyboard: digits, <kbd>+</kbd> <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd> <kbd>^</kbd> <kbd>%</kbd>,{' '}
        <kbd>r</kbd> for √, <kbd>Enter</kbd>, <kbd>Backspace</kbd>, <kbd>Esc</kbd>
      </footer>
    </main>
  )
}
