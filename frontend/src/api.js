export async function submitGenerate(imageFile, prompt) {
  const form = new FormData()
  if (imageFile) form.append('image', imageFile)
  form.append('prompt', prompt)
  const res = await fetch('/generate', { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export async function pollStatus(jobId) {
  const res = await fetch(`/status/${jobId}`)
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`)
  return res.json()
}

export function getResultUrl(jobId, format = 'gif') {
  if (format === 'mp4') return `/result/${jobId}?format=mp4`
  return `/result/${jobId}`
}
