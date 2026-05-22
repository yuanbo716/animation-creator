import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import GenerateButton from './GenerateButton'

describe('GenerateButton', () => {
  it('calls onClick when enabled', () => {
    const onClick = vi.fn()
    render(<GenerateButton onClick={onClick} disabled={false} loading={false} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and shows loading text when loading=true', () => {
    render(<GenerateButton onClick={vi.fn()} disabled={false} loading={true} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.textContent).toMatch(/generating/i)
  })

  it('is disabled when disabled=true', () => {
    render(<GenerateButton onClick={vi.fn()} disabled={true} loading={false} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
