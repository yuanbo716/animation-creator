import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ImageUpload from './ImageUpload'

describe('ImageUpload', () => {
  it('renders upload prompt when no file selected', () => {
    render(<ImageUpload onFileSelect={vi.fn()} />)
    expect(screen.getByText(/drop avatar image/i)).toBeInTheDocument()
  })

  it('calls onFileSelect when a file is chosen', () => {
    const onFileSelect = vi.fn()
    render(<ImageUpload onFileSelect={onFileSelect} />)
    const input = document.querySelector('input[type="file"]')
    const fakeFile = new File(['img'], 'avatar.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [fakeFile] } })
    expect(onFileSelect).toHaveBeenCalledWith(fakeFile)
  })

  it('shows filename and remove button when file is provided', () => {
    const fakeFile = new File(['img'], 'avatar.png', { type: 'image/png' })
    render(<ImageUpload onFileSelect={vi.fn()} file={fakeFile} />)
    expect(screen.getByText('avatar.png')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })

  it('calls onFileSelect with null when remove is clicked', () => {
    const onFileSelect = vi.fn()
    const fakeFile = new File(['img'], 'avatar.png', { type: 'image/png' })
    render(<ImageUpload onFileSelect={onFileSelect} file={fakeFile} />)
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    expect(onFileSelect).toHaveBeenCalledWith(null)
  })
})
