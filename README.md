# Animation Creator

Upload an avatar image, describe a motion, get a looping GIF. Runs locally on Apple Silicon using Wan Video 2.1 (1.3B).

## Requirements
- macOS Apple Silicon (M1–M4), 16 GB unified memory
- Python 3.11+, Node.js 20+
- ~3 GB free disk space (model download, one-time)

## Setup

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. First Generate click downloads the model (~3 GB, cached to ~/.cache/huggingface).
