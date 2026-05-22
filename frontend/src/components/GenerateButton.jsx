export default function GenerateButton({ onClick, disabled, loading }) {
  return (
    <button className="generate-btn" onClick={onClick} disabled={disabled || loading}>
      {loading ? '⏳ Generating…' : '✦ Generate Animation'}
    </button>
  )
}
