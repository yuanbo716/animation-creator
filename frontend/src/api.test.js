import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitGenerate, pollStatus, getResultUrl } from './api'

beforeEach(() => { vi.restoreAllMocks() })

describe('submitGenerate', () => {
  it('posts form data and returns job_id', async () => {
    const fakeFile = new File(['img'], 'avatar.png', { type: 'image/png' })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ job_id: 'abc-123', status: 'queued' }),
    })
    const result = await submitGenerate(fakeFile, 'do a squat')
    expect(result.job_id).toBe('abc-123')
    expect(global.fetch).toHaveBeenCalledWith('/generate', expect.objectContaining({ method: 'POST' }))
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 400,
      json: async () => ({ detail: 'Bad image' }),
    })
    const fakeFile = new File(['x'], 'avatar.png', { type: 'image/png' })
    await expect(submitGenerate(fakeFile, 'squat')).rejects.toThrow('Bad image')
  })
})

describe('pollStatus', () => {
  it('returns status object', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'running', step: 5, total_steps: 40, elapsed_sec: 30, result_url: null }),
    })
    const result = await pollStatus('abc-123')
    expect(result.status).toBe('running')
    expect(result.step).toBe(5)
  })
})

describe('getResultUrl', () => {
  it('returns gif url by default', () => {
    expect(getResultUrl('abc-123')).toBe('/result/abc-123')
  })
  it('returns mp4 url when format is mp4', () => {
    expect(getResultUrl('abc-123', 'mp4')).toBe('/result/abc-123?format=mp4')
  })
})
