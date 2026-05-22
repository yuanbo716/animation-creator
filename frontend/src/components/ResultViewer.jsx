import { getResultUrl } from '../api'

function fmt(sec) {
  return `${Math.floor(sec / 60)}m ${String(Math.floor(sec % 60)).padStart(2, '0')}s`
}

export default function ResultViewer({ jobId, status, elapsedSec }) {
  if (status !== 'done' || !jobId) return null
  return (
    <div className="result-viewer">
      <img className="result-gif" src={getResultUrl(jobId, 'gif')} alt="Generated animation" />
      <p className="done-label">✓ Done in {fmt(elapsedSec)}</p>
      <div className="download-buttons">
        <a className="dl-btn" href={getResultUrl(jobId, 'gif')} download={`animation-${jobId}.gif`}>
          ⬇ Download GIF
        </a>
        <a className="dl-btn" href={getResultUrl(jobId, 'mp4')} download={`animation-${jobId}.mp4`}>
          ⬇ Download MP4
        </a>
      </div>
    </div>
  )
}
