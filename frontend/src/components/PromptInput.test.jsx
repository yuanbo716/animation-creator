import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PromptInput from './PromptInput'

describe('PromptInput', () => {
  it('renders all preset buttons', () => {
    render(<PromptInput value="" onChange={vi.fn()} />)
    ;['Squat', 'Push-up', 'Bicep curl', 'Lunge', 'Jumping jack'].forEach(p =>
      expect(screen.getByText(p)).toBeInTheDocument()
    )
  })

  it('calls onChange with preset text when preset is clicked', () => {
    const onChange = vi.fn()
    render(<PromptInput value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('Squat'))
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('squat'))
  })

  it('calls onChange when textarea is edited', () => {
    const onChange = vi.fn()
    render(<PromptInput value="hello" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello world' } })
    expect(onChange).toHaveBeenCalledWith('hello world')
  })
})
