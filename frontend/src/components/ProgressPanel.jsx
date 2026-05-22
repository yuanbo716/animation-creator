function fmt(sec) {
  return `${Math.floor(sec / 60)}m ${String(Math.floor(sec % 60)).padStart(2, '0')}s`
}

export default function ProgressPanel({ status, step, totalSteps, elapsedSec, error }) {
  if (!status) {
    return <div className="panel-idle"><p>Result will appear here after generation.</p></div>
  }
  if (status === 'failed') {
    return (
      <div className="panel-error">
        <p className="error-title">Generation failed</p>
        <p className="error-msg">{error || 'Unknown error'}</p>
        <p className="error-hint">Try restarting the backend or reducing duration.</p>
      </div>
    )
  }
  if (status === 'queued' || status === 'running') {
    const pct = totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0
    return (
      <div className="panel-running">
        <div className="running-header">
          <span className="pulse-dot" />
          <span>Generating…</span>
          <span className="elapsed">{fmt(elapsedSec)}</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="step-label">Step {step} / {totalSteps}</p>
      </div>
    )
  }
  return null
}
