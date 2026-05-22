import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ResultViewer from './ResultViewer'

describe('ResultViewer', () => {
  it('renders gif and download buttons when done', () => {
    render(<ResultViewer jobId="abc-123" status="done" elapsedSec={582} />)
    const img = document.querySelector('img')
    expect(img).not.toBeNull()
    expect(img.src).toContain('/result/abc-123')
    expect(screen.getByText(/download gif/i)).toBeInTheDocument()
    expect(screen.getByText(/download mp4/i)).toBeInTheDocument()
  })

  it('renders nothing when status is not done', () => {
    const { container } = render(<ResultViewer jobId={null} status={null} elapsedSec={0} />)
    expect(container.firstChild).toBeNull()
  })
})
