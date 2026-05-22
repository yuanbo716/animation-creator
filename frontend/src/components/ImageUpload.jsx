import './ImageUpload.css'

export default function ImageUpload({ onFileSelect, file }) {
  if (file) {
    return (
      <div className="upload-preview">
        <span className="preview-name">{file.name}</span>
        <span className="preview-size">{(file.size / 1024).toFixed(0)} KB</span>
        <button className="remove-btn" aria-label="Remove file" onClick={() => onFileSelect(null)}>
          ✕ Remove
        </button>
      </div>
    )
  }
  return (
    <div
      className="upload-zone"
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileSelect(f) }}
      onDragOver={(e) => e.preventDefault()}
    >
      <span className="upload-icon">🖼</span>
      <p>Drop avatar image here</p>
      <p className="upload-hint">PNG, JPG, WEBP · max 10 MB</p>
      <label className="browse-btn">
        Browse file
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files[0]; if (f) onFileSelect(f) }}
        />
      </label>
    </div>
  )
}
