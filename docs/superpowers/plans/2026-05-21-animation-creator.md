# Animation Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app where a user uploads an avatar image and a text prompt to generate a short looping GIF animation using Wan Video 2.1 (1.3B) on Apple Silicon MPS.

**Architecture:** React frontend (Vite, port 5173) talks to a FastAPI backend (port 8000) via REST + 5-second polling. The backend maintains an in-memory job queue processed by a single background worker thread that runs Wan Video inference on MPS. Generated GIFs and MP4s are stored in `backend/outputs/`.

**Tech Stack:** React 18, Vite 5, FastAPI, Uvicorn, PyTorch (MPS), `diffusers` (`WanImageToVideoPipeline`), Pillow, imageio[ffmpeg], pytest, httpx, vitest, @testing-library/react

---

## File Map

```
Animation Creator/
├── backend/
│   ├── main.py              # FastAPI app + all route definitions
│   ├── worker.py            # In-memory job queue + background worker thread
│   ├── inference.py         # Wan Video model loading + generation + GIF/MP4 export
│   ├── requirements.txt
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_main.py
│   │   ├── test_worker.py
│   │   └── test_inference.py
│   ├── uploads/             # Runtime only, gitignored
│   └── outputs/             # Runtime only, gitignored
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── vitest.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── App.css
│       ├── App.test.jsx
│       ├── setupTests.js
│       ├── api.js
│       ├── api.test.js
│       └── components/
│           ├── ImageUpload.jsx
│           ├── ImageUpload.css
│           ├── ImageUpload.test.jsx
│           ├── PromptInput.jsx
│           ├── PromptInput.test.jsx
│           ├── GenerateButton.jsx
│           ├── GenerateButton.test.jsx
│           ├── ProgressPanel.jsx
│           ├── ProgressPanel.test.jsx
│           ├── ResultViewer.jsx
│           └── ResultViewer.test.jsx
├── .gitignore
└── README.md
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Initialize git repo**

```bash
cd "/Users/boyuan/Animation Creator"
git init
```

Expected: `Initialized empty Git repository`

- [ ] **Step 2: Create .gitignore**

```
__pycache__/
*.pyc
.venv/
backend/uploads/
backend/outputs/
frontend/node_modules/
frontend/dist/
.superpowers/
.DS_Store
```

- [ ] **Step 3: Create README.md**

```markdown
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
```

- [ ] **Step 4: Create runtime directories and test init**

```bash
mkdir -p backend/uploads backend/outputs backend/tests frontend/src/components
touch backend/tests/__init__.py
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore README.md docs/ backend/tests/__init__.py
git commit -m "chore: project scaffold"
```

---

## Task 2: Backend Skeleton

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/tests/test_main.py`

- [ ] **Step 1: Write failing test**

Create `backend/tests/test_main.py`:

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd backend
python -m pytest tests/test_main.py::test_health -v
```

Expected: `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: Create requirements.txt**

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
python-multipart>=0.0.12
diffusers>=0.31.0
transformers>=4.44.0
accelerate>=0.34.0
torch>=2.4.0
Pillow>=10.4.0
imageio>=2.35.0
imageio[ffmpeg]
pytest>=8.3.0
```

Install:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 4: Create backend/main.py**

```python
import os
import shutil
import uuid as _uuid
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(title="Animation Creator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("outputs", exist_ok=True)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Run test — verify it passes**

```bash
python -m pytest tests/test_main.py::test_health -v
```

Expected: `PASSED`

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: fastapi skeleton with health endpoint"
```

---

## Task 3: Job Queue

**Files:**
- Create: `backend/worker.py`
- Create: `backend/tests/test_worker.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_worker.py`:

```python
from unittest.mock import patch
from worker import create_job, get_job


def test_create_job_returns_queued_job():
    with patch("worker._queue") as mock_q:
        job = create_job(image_path="uploads/test.png", prompt="do a squat")
    assert len(job.id) == 36  # UUID4
    assert job.status == "queued"
    assert job.image_path == "uploads/test.png"
    assert job.prompt == "do a squat"
    mock_q.put.assert_called_once_with(job)


def test_get_job_returns_none_for_unknown_id():
    assert get_job("nonexistent-id") is None


def test_get_job_returns_created_job():
    with patch("worker._queue"):
        job = create_job(image_path="uploads/test.png", prompt="squat")
    assert get_job(job.id).id == job.id
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
python -m pytest tests/test_worker.py -v
```

Expected: `ModuleNotFoundError: No module named 'worker'`

- [ ] **Step 3: Create backend/worker.py**

```python
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass
class Job:
    id: str
    image_path: str
    prompt: str
    status: str = "queued"  # queued | running | done | failed
    step: int = 0
    total_steps: int = 40
    elapsed_sec: float = 0.0
    result_gif_path: Optional[str] = None
    result_mp4_path: Optional[str] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)


_jobs: Dict[str, Job] = {}
_queue: queue.Queue = queue.Queue()


def create_job(image_path: str, prompt: str) -> Job:
    job = Job(id=str(uuid.uuid4()), image_path=image_path, prompt=prompt)
    _jobs[job.id] = job
    _queue.put(job)
    return job


def get_job(job_id: str) -> Optional[Job]:
    return _jobs.get(job_id)


def _worker_loop():
    while True:
        job = _queue.get()
        job.status = "running"
        start = time.time()
        try:
            from inference import generate_animation

            def on_progress(step: int, total: int):
                job.step = step
                job.total_steps = total
                job.elapsed_sec = time.time() - start

            gif_path, mp4_path = generate_animation(
                job.image_path, job.prompt, on_progress
            )
            job.result_gif_path = gif_path
            job.result_mp4_path = mp4_path
            job.status = "done"
            job.elapsed_sec = time.time() - start
        except Exception as exc:
            job.status = "failed"
            job.error = str(exc)
            import traceback
            traceback.print_exc()
        finally:
            _queue.task_done()


threading.Thread(target=_worker_loop, daemon=True).start()
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
python -m pytest tests/test_worker.py -v
```

Expected: all 3 `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/worker.py backend/tests/test_worker.py
git commit -m "feat: in-memory job queue with background worker thread"
```

---

## Task 4: API Endpoints (/generate, /status, /result)

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_main.py`

- [ ] **Step 1: Write failing tests**

Append to `backend/tests/test_main.py`:

```python
import io
from PIL import Image


def _png_bytes() -> bytes:
    img = Image.new("RGB", (64, 64), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_generate_returns_job_id():
    resp = client.post(
        "/generate",
        files={"image": ("avatar.png", _png_bytes(), "image/png")},
        data={"prompt": "person doing a squat"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "job_id" in body
    assert body["status"] == "queued"


def test_generate_rejects_missing_prompt():
    resp = client.post(
        "/generate",
        files={"image": ("avatar.png", _png_bytes(), "image/png")},
    )
    assert resp.status_code == 422


def test_generate_rejects_missing_image():
    resp = client.post("/generate", data={"prompt": "squat"})
    assert resp.status_code == 422


def test_status_returns_queued_for_new_job():
    resp = client.post(
        "/generate",
        files={"image": ("avatar.png", _png_bytes(), "image/png")},
        data={"prompt": "squat"},
    )
    job_id = resp.json()["job_id"]
    status_resp = client.get(f"/status/{job_id}")
    assert status_resp.status_code == 200
    body = status_resp.json()
    assert body["status"] in ("queued", "running", "failed")
    assert "step" in body
    assert "total_steps" in body
    assert "elapsed_sec" in body


def test_status_404_for_unknown_job():
    assert client.get("/status/unknown-id").status_code == 404


def test_result_404_for_unknown_job():
    assert client.get("/result/unknown-id").status_code == 404
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
python -m pytest tests/test_main.py -k "generate or status or result" -v
```

Expected: `FAILED` — 404/405 (routes not yet defined)

- [ ] **Step 3: Add routes to backend/main.py**

Append to `backend/main.py`:

```python
@app.post("/generate")
async def generate(
    image: UploadFile = File(...),
    prompt: str = Form(...),
):
    allowed = {"image/png", "image/jpeg", "image/webp"}
    if image.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Image must be PNG, JPEG, or WEBP")

    ext = image.filename.rsplit(".", 1)[-1] if "." in image.filename else "png"
    temp_id = str(_uuid.uuid4())
    image_path = os.path.join(UPLOAD_DIR, f"{temp_id}.{ext}")
    with open(image_path, "wb") as f:
        shutil.copyfileobj(image.file, f)

    from worker import create_job
    job = create_job(image_path=image_path, prompt=prompt)
    return {"job_id": job.id, "status": job.status}


@app.get("/status/{job_id}")
def status(job_id: str):
    from worker import get_job
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "status": job.status,
        "step": job.step,
        "total_steps": job.total_steps,
        "elapsed_sec": round(job.elapsed_sec, 1),
        "result_url": f"/result/{job_id}" if job.status == "done" else None,
        "error": job.error,
    }


@app.get("/result/{job_id}")
def result(job_id: str, format: str = "gif"):
    from worker import get_job
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "done":
        raise HTTPException(status_code=400, detail="Job not complete")
    path = job.result_mp4_path if format == "mp4" else job.result_gif_path
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Result file not found")
    media_type = "video/mp4" if format == "mp4" else "image/gif"
    return FileResponse(path, media_type=media_type)
```

- [ ] **Step 4: Run all backend tests — verify they pass**

```bash
python -m pytest tests/ -v
```

Expected: all tests `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_main.py
git commit -m "feat: /generate, /status, /result endpoints"
```

---

## Task 5: Inference Module

**Files:**
- Create: `backend/inference.py`
- Create: `backend/tests/test_inference.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_inference.py`:

```python
import os
from unittest.mock import MagicMock, patch
import pytest
from PIL import Image


@pytest.fixture
def avatar_path(tmp_path):
    img = Image.new("RGB", (480, 480), color=(100, 150, 200))
    p = tmp_path / "avatar.png"
    img.save(p)
    return str(p)


@pytest.fixture
def fake_frames():
    return [Image.new("RGB", (480, 480), color=(i * 15, 100, 150)) for i in range(14)]


def test_generate_animation_returns_gif_and_mp4(avatar_path, fake_frames, tmp_path):
    mock_output = MagicMock()
    mock_output.frames = [fake_frames]
    mock_pipe = MagicMock(return_value=mock_output)

    with patch("inference._get_pipeline", return_value=mock_pipe):
        from inference import generate_animation
        gif_path, mp4_path = generate_animation(
            avatar_path, "person squatting", output_dir=str(tmp_path)
        )

    assert gif_path.endswith(".gif")
    assert mp4_path.endswith(".mp4")
    assert os.path.exists(gif_path)


def test_generate_animation_fires_progress_callback(avatar_path, fake_frames, tmp_path):
    mock_output = MagicMock()
    mock_output.frames = [fake_frames]
    mock_pipe = MagicMock(return_value=mock_output)

    calls = []
    with patch("inference._get_pipeline", return_value=mock_pipe):
        from inference import generate_animation
        generate_animation(
            avatar_path, "squat",
            on_progress=lambda s, t: calls.append((s, t)),
            output_dir=str(tmp_path),
        )

    assert len(calls) > 0
    assert calls[-1] == (40, 40)
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
python -m pytest tests/test_inference.py -v
```

Expected: `ModuleNotFoundError: No module named 'inference'`

- [ ] **Step 3: Create backend/inference.py**

```python
import os
import uuid
from typing import Callable, Optional, Tuple

import imageio
import numpy as np
import torch
from PIL import Image

_pipeline = None


def _get_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    from diffusers import WanImageToVideoPipeline
    _pipeline = WanImageToVideoPipeline.from_pretrained(
        "Wan-AI/Wan2.1-I2V-14F-480P",
        torch_dtype=torch.bfloat16,
    )
    _pipeline.to("mps")
    return _pipeline


def generate_animation(
    image_path: str,
    prompt: str,
    on_progress: Optional[Callable[[int, int], None]] = None,
    output_dir: str = "outputs",
    num_inference_steps: int = 40,
) -> Tuple[str, str]:
    os.makedirs(output_dir, exist_ok=True)

    image = Image.open(image_path).convert("RGB").resize((480, 480))
    pipe = _get_pipeline()

    def _step_cb(pipe, step: int, timestep, callback_kwargs):
        if on_progress:
            on_progress(step + 1, num_inference_steps)
        return callback_kwargs

    output = pipe(
        image=image,
        prompt=prompt,
        num_inference_steps=num_inference_steps,
        num_frames=14,
        callback_on_step_end=_step_cb,
    )

    frames = output.frames[0]  # list of 14 PIL Images
    job_id = str(uuid.uuid4())

    gif_path = os.path.join(output_dir, f"{job_id}.gif")
    frames[0].save(
        gif_path,
        save_all=True,
        append_images=frames[1:],
        loop=0,
        duration=143,  # ~7 fps
    )

    mp4_path = os.path.join(output_dir, f"{job_id}.mp4")
    writer = imageio.get_writer(mp4_path, fps=7)
    for frame in frames:
        writer.append_data(np.array(frame))
    writer.close()

    if on_progress:
        on_progress(num_inference_steps, num_inference_steps)

    return gif_path, mp4_path
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
python -m pytest tests/test_inference.py -v
```

Expected: both tests `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/inference.py backend/tests/test_inference.py
git commit -m "feat: inference module with Wan Video I2V, GIF and MP4 export"
```

---

## Task 6: Frontend Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/vitest.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/setupTests.js`

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "animation-creator",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create frontend/vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/generate': 'http://localhost:8000',
      '/status': 'http://localhost:8000',
      '/result': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 3: Create frontend/vitest.config.js**

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
  },
})
```

- [ ] **Step 4: Create frontend/src/setupTests.js**

```js
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Animation Creator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create frontend/src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: Install and verify**

```bash
cd frontend
npm install
npm run dev
```

Expected: `Local: http://localhost:5173/` (blank page — App.jsx comes next)

- [ ] **Step 8: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: vite + react frontend scaffold"
```

---

## Task 7: api.js

**Files:**
- Create: `frontend/src/api.js`
- Create: `frontend/src/api.test.js`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/api.test.js`:

```js
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd frontend && npm test
```

Expected: `Cannot find module './api'`

- [ ] **Step 3: Create frontend/src/api.js**

```js
export async function submitGenerate(imageFile, prompt) {
  const form = new FormData()
  form.append('image', imageFile)
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: all api tests `PASSED`

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/src/api.js frontend/src/api.test.js
git commit -m "feat: api.js fetch wrappers"
```

---

## Task 8: ImageUpload Component

**Files:**
- Create: `frontend/src/components/ImageUpload.jsx`
- Create: `frontend/src/components/ImageUpload.css`
- Create: `frontend/src/components/ImageUpload.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/ImageUpload.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ImageUpload from './ImageUpload'

describe('ImageUpload', () => {
  it('renders upload prompt when no file selected', () => {
    render(<ImageUpload onFileSelect={vi.fn()} />)
    expect(screen.getByText(/drop avatar image/i)).toBeInTheDocument()
  })

  it('calls onFileSelect when a file is chosen', () => {
    const onFileSelect = vi.fn()
    render(<ImageUpload onFileSelect={onFileSelect} />)
    const input = document.querySelector('input[type="file"]')
    const fakeFile = new File(['img'], 'avatar.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [fakeFile] } })
    expect(onFileSelect).toHaveBeenCalledWith(fakeFile)
  })

  it('shows filename and remove button when file is provided', () => {
    const fakeFile = new File(['img'], 'avatar.png', { type: 'image/png' })
    render(<ImageUpload onFileSelect={vi.fn()} file={fakeFile} />)
    expect(screen.getByText('avatar.png')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })

  it('calls onFileSelect with null when remove is clicked', () => {
    const onFileSelect = vi.fn()
    const fakeFile = new File(['img'], 'avatar.png', { type: 'image/png' })
    render(<ImageUpload onFileSelect={onFileSelect} file={fakeFile} />)
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    expect(onFileSelect).toHaveBeenCalledWith(null)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd frontend && npm test
```

Expected: `Cannot find module './ImageUpload'`

- [ ] **Step 3: Create ImageUpload.jsx**

```jsx
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
```

- [ ] **Step 4: Create ImageUpload.css**

```css
.upload-zone {
  border: 2px dashed #4b5563;
  border-radius: 10px;
  padding: 1.25rem;
  text-align: center;
  background: rgba(255,255,255,0.02);
}
.upload-zone p { margin: 0.25rem 0; font-size: 0.875rem; }
.upload-hint { color: #6b7280; font-size: 0.75rem !important; }
.upload-icon { font-size: 2rem; }
.browse-btn {
  display: inline-block;
  margin-top: 0.75rem;
  padding: 0.4rem 1rem;
  border: 1px solid #4b5563;
  border-radius: 6px;
  font-size: 0.82rem;
  cursor: pointer;
}
.browse-btn:hover { background: rgba(255,255,255,0.06); }
.upload-preview {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(99,102,241,0.1);
  border: 1px solid rgba(99,102,241,0.3);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  font-size: 0.85rem;
}
.preview-name { font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-size { color: #6b7280; font-size: 0.75rem; }
.remove-btn { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.78rem; padding: 0; }
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test
```

Expected: all ImageUpload tests `PASSED`

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/components/ImageUpload.jsx frontend/src/components/ImageUpload.css frontend/src/components/ImageUpload.test.jsx
git commit -m "feat: ImageUpload component with drag-and-drop"
```

---

## Task 9: PromptInput and GenerateButton Components

**Files:**
- Create: `frontend/src/components/PromptInput.jsx`
- Create: `frontend/src/components/PromptInput.test.jsx`
- Create: `frontend/src/components/GenerateButton.jsx`
- Create: `frontend/src/components/GenerateButton.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/PromptInput.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PromptInput from './PromptInput'

describe('PromptInput', () => {
  it('renders all preset buttons', () => {
    render(<PromptInput value="" onChange={vi.fn()} />)
    ;['Squat', 'Push-up', 'Bicep curl', 'Lunge', 'Jumping jack'].forEach(p =>
      expect(screen.getByText(p)).toBeInTheDocument()
    )
  })

  it('calls onChange with preset text when preset is clicked', () => {
    const onChange = vi.fn()
    render(<PromptInput value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('Squat'))
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('squat'))
  })

  it('calls onChange when textarea is edited', () => {
    const onChange = vi.fn()
    render(<PromptInput value="hello" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello world' } })
    expect(onChange).toHaveBeenCalledWith('hello world')
  })
})
```

Create `frontend/src/components/GenerateButton.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import GenerateButton from './GenerateButton'

describe('GenerateButton', () => {
  it('calls onClick when enabled', () => {
    const onClick = vi.fn()
    render(<GenerateButton onClick={onClick} disabled={false} loading={false} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and shows loading text when loading=true', () => {
    render(<GenerateButton onClick={vi.fn()} disabled={false} loading={true} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn.textContent).toMatch(/generating/i)
  })

  it('is disabled when disabled=true', () => {
    render(<GenerateButton onClick={vi.fn()} disabled={true} loading={false} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd frontend && npm test
```

Expected: `Cannot find module './PromptInput'` and `Cannot find module './GenerateButton'`

- [ ] **Step 3: Create PromptInput.jsx**

```jsx
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
```

- [ ] **Step 4: Create GenerateButton.jsx**

```jsx
export default function GenerateButton({ onClick, disabled, loading }) {
  return (
    <button className="generate-btn" onClick={onClick} disabled={disabled || loading}>
      {loading ? '⏳ Generating…' : '✦ Generate Animation'}
    </button>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test
```

Expected: all PromptInput and GenerateButton tests `PASSED`

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/components/PromptInput.jsx frontend/src/components/PromptInput.test.jsx frontend/src/components/GenerateButton.jsx frontend/src/components/GenerateButton.test.jsx
git commit -m "feat: PromptInput and GenerateButton components"
```

---

## Task 10: ProgressPanel and ResultViewer Components

**Files:**
- Create: `frontend/src/components/ProgressPanel.jsx`
- Create: `frontend/src/components/ProgressPanel.test.jsx`
- Create: `frontend/src/components/ResultViewer.jsx`
- Create: `frontend/src/components/ResultViewer.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/ProgressPanel.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ProgressPanel from './ProgressPanel'

describe('ProgressPanel', () => {
  it('shows idle message when status is null', () => {
    render(<ProgressPanel status={null} step={0} totalSteps={40} elapsedSec={0} />)
    expect(screen.getByText(/result will appear here/i)).toBeInTheDocument()
  })

  it('shows generating state with step info', () => {
    render(<ProgressPanel status="running" step={15} totalSteps={40} elapsedSec={120} />)
    expect(screen.getByText(/generating/i)).toBeInTheDocument()
    expect(screen.getByText(/15.*40/)).toBeInTheDocument()
  })

  it('shows error message on failed status', () => {
    render(<ProgressPanel status="failed" step={0} totalSteps={40} elapsedSec={0} error="Out of memory" />)
    expect(screen.getByText(/out of memory/i)).toBeInTheDocument()
  })
})
```

Create `frontend/src/components/ResultViewer.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ResultViewer from './ResultViewer'

describe('ResultViewer', () => {
  it('renders gif and download buttons when done', () => {
    render(<ResultViewer jobId="abc-123" status="done" elapsedSec={582} />)
    const img = document.querySelector('img')
    expect(img).not.toBeNull()
    expect(img.src).toContain('/result/abc-123')
    expect(screen.getByText(/download gif/i)).toBeInTheDocument()
    expect(screen.getByText(/download mp4/i)).toBeInTheDocument()
  })

  it('renders nothing when status is not done', () => {
    const { container } = render(<ResultViewer jobId={null} status={null} elapsedSec={0} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd frontend && npm test
```

Expected: `Cannot find module './ProgressPanel'` and `Cannot find module './ResultViewer'`

- [ ] **Step 3: Create ProgressPanel.jsx**

```jsx
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
```

- [ ] **Step 4: Create ResultViewer.jsx**

```jsx
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
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test
```

Expected: all ProgressPanel and ResultViewer tests `PASSED`

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/components/ProgressPanel.jsx frontend/src/components/ProgressPanel.test.jsx frontend/src/components/ResultViewer.jsx frontend/src/components/ResultViewer.test.jsx
git commit -m "feat: ProgressPanel and ResultViewer components"
```

---

## Task 11: App.jsx — Layout, State, Polling

**Files:**
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/App.css`
- Create: `frontend/src/App.test.jsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/App.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the page title', () => {
    render(<App />)
    expect(screen.getByText(/animation creator/i)).toBeInTheDocument()
  })

  it('generate button is disabled initially (no file selected)', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd frontend && npm test
```

Expected: `Cannot find module './App'`

- [ ] **Step 3: Create App.jsx**

```jsx
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
      } catch { /* network blip — keep polling */ }
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
```

- [ ] **Step 4: Create App.css**

```css
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1117; color: #e5e7eb; font-size: 15px; }
.app { min-height: 100vh; display: flex; flex-direction: column; }
.app-header { padding: 1.25rem 2rem 1rem; border-bottom: 1px solid #1f2937; }
.app-header h1 { margin: 0; font-size: 1.4rem; font-weight: 700; }
.app-subtitle { margin: 0.2rem 0 0; color: #6b7280; font-size: 0.85rem; }
.app-main { display: grid; grid-template-columns: 380px 1fr; flex: 1; }
.controls-panel { padding: 1.25rem; border-right: 1px solid #1f2937; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; }
.result-panel { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; }

/* PromptInput */
.prompt-input { display: flex; flex-direction: column; gap: 0.5rem; }
.presets-label, .prompt-label { font-size: 0.75rem; color: #6b7280; }
.presets { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.preset-btn { padding: 0.3rem 0.65rem; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.4); border-radius: 6px; color: #a5b4fc; font-size: 0.8rem; cursor: pointer; }
.preset-btn:hover { background: rgba(99,102,241,0.25); }
.prompt-textarea { width: 100%; background: #1a1d2e; border: 1px solid #374151; border-radius: 8px; color: #e5e7eb; font-size: 0.85rem; padding: 0.6rem 0.75rem; resize: vertical; font-family: inherit; }
.prompt-textarea:focus { outline: none; border-color: #6366f1; }

/* GenerateButton */
.generate-btn { width: 100%; padding: 0.7rem; background: #4f46e5; border: none; border-radius: 8px; color: white; font-size: 0.95rem; font-weight: 700; cursor: pointer; margin-top: auto; }
.generate-btn:hover:not(:disabled) { background: #4338ca; }
.generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ProgressPanel */
.panel-idle { color: #4b5563; padding: 2rem; text-align: center; }
.panel-error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 1rem; }
.error-title { color: #f87171; font-weight: 600; margin: 0 0 0.25rem; }
.error-msg { margin: 0 0 0.25rem; font-size: 0.85rem; }
.error-hint { color: #6b7280; font-size: 0.8rem; margin: 0; }
.panel-running { background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.3); border-radius: 10px; padding: 1rem; }
.running-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; font-weight: 600; }
.pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.elapsed { margin-left: auto; color: #6b7280; font-size: 0.85rem; font-weight: 400; }
.progress-bar-bg { background: #1f2937; border-radius: 4px; height: 6px; }
.progress-bar-fill { background: #f59e0b; border-radius: 4px; height: 100%; transition: width 0.3s; }
.step-label { color: #6b7280; font-size: 0.75rem; margin: 0.4rem 0 0; }

/* ResultViewer */
.result-viewer { display: flex; flex-direction: column; align-items: flex-start; gap: 0.75rem; }
.result-gif { max-width: 100%; max-height: 400px; border-radius: 10px; border: 1px solid #1f2937; }
.done-label { color: #34d399; font-size: 0.85rem; font-weight: 600; margin: 0; }
.download-buttons { display: flex; gap: 0.5rem; }
.dl-btn { padding: 0.4rem 0.9rem; border: 1px solid #374151; border-radius: 6px; color: #e5e7eb; text-decoration: none; font-size: 0.82rem; background: #1f2937; }
.dl-btn:hover { background: #374151; }
```

- [ ] **Step 5: Run all frontend tests**

```bash
npm test
```

Expected: all tests across all components `PASSED`

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/App.jsx frontend/src/App.css frontend/src/App.test.jsx
git commit -m "feat: App.jsx two-column layout with state management and polling"
```

---

## Task 12: End-to-End Smoke Test

Manual verification of the full stack.

- [ ] **Step 1: Start backend**

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

Expected: `Application startup complete.`

- [ ] **Step 2: Verify health**

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 3: Start frontend (second terminal)**

```bash
cd frontend && npm run dev
```

Expected: `Local: http://localhost:5173/`

- [ ] **Step 4: Open app and verify layout**

Open http://localhost:5173. Verify:
- Two-column layout (controls left, result right)
- "Animation Creator" header visible
- Generate button is disabled (no file selected)

- [ ] **Step 5: Upload avatar and generate**

1. Drop or browse a PNG/JPG avatar image
2. Click "Squat" preset — textarea fills with squat prompt
3. Click "Generate Animation"

Expected:
- Button shows "⏳ Generating…" and is disabled
- ProgressPanel shows pulsing amber dot and "Step 0 / 40"
- Backend terminal shows model downloading on first run (~3 GB, one-time only)

- [ ] **Step 6: Verify result after generation**

After ~10–15 minutes:
- ProgressPanel disappears
- ResultViewer shows the looping GIF
- "✓ Done in Xm Ys" label appears
- "Download GIF" and "Download MP4" links are visible and clickable

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: animation creator v1 complete"
```
