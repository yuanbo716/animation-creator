const PRESETS = [
  { label: 'Squat', prompt: 'The person performs a deep squat, bending knees fully and standing back up slowly.' },
  { label: 'Push-up', prompt: 'The person performs a push-up, lowering their chest to the ground and pushing back up.' },
  { label: 'Bicep curl', prompt: 'The person performs a bicep curl, raising their forearm toward the shoulder and lowering it back.' },
  { label: 'Lunge', prompt: 'The person steps forward into a lunge, bending the front knee to 90 degrees and returning.' },
  { label: 'Jumping jack', prompt: 'The person performs a jumping jack, spreading arms and legs outward then returning.' },
]

export default function PromptInput({ value, onChange }) {
  return (
    <div className="prompt-input">
      <div className="presets-label">Quick presets</div>
      <div className="presets">
        {PRESETS.map(p => (
          <button key={p.label} className="preset-btn" onClick={() => onChange(p.prompt)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="prompt-label">Motion description</div>
      <textarea
        className="prompt-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Describe the motion..."
        rows={4}
      />
    </div>
  )
}
