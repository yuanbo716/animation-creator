import { useState, useEffect, useRef } from 'react'
import './App.css'
import ImageUpload from './components/ImageUpload'
import PromptInput from './components/PromptInput'
import GenerateButton from './components/GenerateButton'
import ProgressPanel from './components/ProgressPanel'
import ResultViewer from './components/ResultViewer'
import { submitGenerate, pollStatus } from './api'

export default function App() {
  const [file, setFile] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [jobId, setJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)
  const [step, setStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(40)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  const isLoading = jobStatus === 'queued' || jobStatus === 'running'
  const canGenerate = file !== null && prompt.trim().length > 0 && !isLoading

  useEffect(() => {
    if (!jobId || jobStatus === 'done' || jobStatus === 'failed') {
      clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(async () => {
      try {
        const data = await pollStatus(jobId)
        setJobStatus(data.status)
        setStep(data.step)
        setTotalSteps(data.total_steps)
        setElapsedSec(data.elapsed_sec)
        if (data.status === 'failed') setError(data.error)
      } catch (_err) { /* network blip — keep polling */ }
    }, 5000)
    return () => clearInterval(pollRef.current)
  }, [jobId, jobStatus])

  async function handleGenerate() {
    setError(null)
    setJobStatus('queued')
    setStep(0)
    setElapsedSec(0)
    try {
      const data = await submitGenerate(file, prompt)
      setJobId(data.job_id)
      setJobStatus(data.status)
    } catch (err) {
      setJobStatus('failed')
      setError(err.message)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Animation Creator</h1>
        <p className="app-subtitle">Upload an avatar · describe the motion · get a looping GIF</p>
      </header>
      <main className="app-main">
        <section className="controls-panel">
          <ImageUpload file={file} onFileSelect={setFile} />
          <PromptInput value={prompt} onChange={setPrompt} />
          <GenerateButton onClick={handleGenerate} disabled={!canGenerate} loading={isLoading} />
        </section>
        <section className="result-panel">
          <ProgressPanel status={jobStatus} step={step} totalSteps={totalSteps} elapsedSec={elapsedSec} error={error} />
          <ResultViewer jobId={jobId} status={jobStatus} elapsedSec={elapsedSec} />
        </section>
      </main>
    </div>
  )
}
