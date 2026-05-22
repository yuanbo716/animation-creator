import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the page title', () => {
    render(<App />)
    expect(screen.getByText(/animation creator/i)).toBeInTheDocument()
  })

  it('generate button is disabled initially (no file selected)', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled()
  })
})
