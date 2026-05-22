# Animation Creator

Describe a motion, get a looping GIF. Runs entirely on Apple Silicon — no cloud, no API keys.

Uses **Wan2.1-T2V-1.3B** (text-to-video, ~6 GB download, cached after first run).

---

## Requirements

| | Minimum | Recommended |
|---|---|---|
| **Mac** | Apple Silicon (M1+), 16 GB | M4 Pro, 24 GB |
| **Python** | 3.11+ | 3.13 |
| **Node.js** | 18+ | 20+ |
| **Disk** | 8 GB free | — |

---

## Setup

### 1. Clone

```bash
git clone https://github.com/yuanbo716/animation-creator.git
cd animation-creator
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Frontend

```bash
cd ../frontend
npm install
```

---

## Running

Open **two terminals** from the project root.

**Terminal 1 — backend:**
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8001
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**.

The model (~6 GB) downloads automatically on first generation and is cached at `~/.cache/huggingface/hub/`. All subsequent runs load from cache instantly.

---

## Usage

1. Pick a preset exercise (Squat, Push-up, Bicep curl, Lunge, Jumping jack) or type a custom motion description
2. Click **Generate Animation**
3. Wait for the progress bar to complete (~10–30 min depending on hardware)
4. Download the result as GIF or MP4

---

## Configuration

### Higher resolution / more frames (24 GB+ RAM only)

Edit `backend/inference.py` and change:

```python
# 16 GB — default, safe
_NUM_FRAMES = 9
_HEIGHT = 320
_WIDTH = 512

# 24 GB — higher quality
_NUM_FRAMES = 17
_HEIGHT = 480
_WIDTH = 832
```

Valid frame values: 9, 17, 25, 33 … (must satisfy `k×8 + 1`)

### Port conflicts

If port 8001 is taken, change `--port 8001` in the backend command and update the proxy in `frontend/vite.config.js` to match.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `MPS out of memory` | Restart backend; reduce `_NUM_FRAMES` in `inference.py` |
| `Connection refused` on frontend | Make sure the backend is running on port 8001 |
| Model download fails | Check internet connection; run `huggingface-cli login` if you see a 401 |
| Port 8001 already in use | Use `lsof -ti:8001` to find the process, then `kill <PID>` |

---

## Project structure

```
animation-creator/
├── backend/
│   ├── main.py          # FastAPI routes
│   ├── worker.py        # Background job queue
│   ├── inference.py     # Wan2.1 model + video export
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx              # Main layout + state
    │   ├── api.js               # Fetch wrappers
    │   └── components/
    │       ├── PromptInput.jsx  # Presets + textarea
    │       ├── GenerateButton.jsx
    │       ├── ProgressPanel.jsx
    │       └── ResultViewer.jsx # GIF preview + downloads
    └── vite.config.js   # Proxy → backend port 8001
```
