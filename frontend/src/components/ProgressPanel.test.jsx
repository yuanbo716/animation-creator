import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ProgressPanel from './ProgressPanel'

describe('ProgressPanel', () => {
  it('shows idle message when status is null', () => {
    render(<ProgressPanel status={null} step={0} totalSteps={40} elapsedSec={0} />)
    expect(screen.getByText(/result will appear here/i)).toBeInTheDocument()
  })

  it('shows generating state with step info', () => {
    render(<ProgressPanel status="running" step={15} totalSteps={40} elapsedSec={120} />)
    expect(screen.getByText(/generating/i)).toBeInTheDocument()
    expect(screen.getByText(/15.*40/)).toBeInTheDocument()
  })

  it('shows error message on failed status', () => {
    render(<ProgressPanel status="failed" step={0} totalSteps={40} elapsedSec={0} error="Out of memory" />)
    expect(screen.getByText(/out of memory/i)).toBeInTheDocument()
  })
})
