# Animation Creator — Design Spec
**Date:** 2026-05-21  
**Status:** Approved

## Overview

A local web app that takes an avatar image and a text description of a motion, then generates a short looping GIF animation of that avatar performing the described action. Primary use case: exercise demonstrations (squats, push-ups, bicep curls, etc.).

Runs entirely on the user's machine — no cloud services, no data leaves the device.

**Target machine:** Apple M4 Mac mini, 16 GB unified memory.

---

## Goals

- Upload a portrait/avatar image
- Describe a motion in text (or pick a preset exercise)
- Generate a 2–4 second looping GIF of the avatar performing that motion
- Download the result as GIF or MP4

## Non-Goals

- Real-time or near-instant generation (10–15 min per clip is acceptable)
- Multi-user or server deployment
- Cloud model APIs
- Video longer than 4 seconds in v1

---

## Architecture

Three layers communicating over HTTP:

```
React Frontend (Vite, port 5173)
        ↕  REST + polling
FastAPI Backend (Uvicorn, port 8000)
        ↕  Python function call
Wan Video 2.1 (1.3B) Inference (PyTorch MPS)
```

All generated files stored locally in `backend/uploads/` and `backend/outputs/`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite |
| Backend | FastAPI, Uvicorn, Python 3.11+ |
| Inference | `diffusers` (Wan Video I2V), PyTorch with MPS backend |
| GIF export | Pillow |
| HTTP bridge | Vite proxy → no CORS issues in dev |

---

## Model

**Wan Video 2.1 — 1.3B image-to-video variant (I2V-14F-480P)**

- Downloaded once on first launch via `diffusers` (≈3 GB)
- Loaded into MPS memory and kept warm between jobs (no reload cost per generation)
- Input: reference image (avatar) + text prompt
- Output: 14 frames decoded to video (~2 seconds at ~7fps), converted to looping GIF via Pillow
- Expected generation time: 10–15 minutes on M4 / 16 GB

---

## UI Layout

Two-column layout, both panels visible simultaneously:

**Left panel (controls):**
- Drag-and-drop image upload zone (PNG, JPG, WEBP, max 10 MB)
- Thumbnail preview of uploaded avatar with remove button
- Preset exercise buttons: Squat, Push-up, Bicep curl, Lunge, Jumping jack, + Custom
- Text prompt textarea (pre-filled when a preset is selected, editable)
- Duration selector: 2 seconds (14 frames, native model output) — 4s option deferred to v2
- Generate Animation button

**Right panel (result):**
- Progress state: animated indicator, progress bar, diffusion step counter (e.g. "Step 15 / 40"), elapsed timer
- Result viewer: looping GIF preview, auto-loaded when generation completes
- Download GIF button, Download MP4 button
- Previous generations strip (thumbnail history, current session only)

---

## API Endpoints

### `POST /generate`
- Body: `multipart/form-data` — `image` (file) + `prompt` (string)
- Response: `{ "job_id": "uuid", "status": "queued" }`
- Side effects: saves image to `./uploads/{job_id}.{ext}`, enqueues job

### `GET /status/{job_id}`
- Response (running): `{ "status": "running", "step": 15, "total_steps": 40, "elapsed_sec": 120 }`
- Response (done): `{ "status": "done", "result_url": "/result/{job_id}" }`
- Response (failed): `{ "status": "failed", "error": "human-readable message" }`

### `GET /result/{job_id}`
- Streams the generated GIF file
- Also accepts `?format=mp4` to serve the MP4 variant

---

## Data Flow

1. User clicks Generate → `POST /generate` → backend saves image, creates UUID job, returns job_id
2. Frontend polls `GET /status/{job_id}` every 5 seconds → updates progress bar and elapsed timer
3. Background worker thread runs Wan Video inference on MPS → saves looping GIF to `./outputs/{job_id}.gif` and MP4 to `./outputs/{job_id}.mp4`
4. Status flips to `done` → next poll triggers frontend to auto-load the GIF
5. User downloads or adjusts prompt and re-generates (model stays warm)

---

## Project Structure

```
Animation Creator/
├── backend/
│   ├── main.py              # FastAPI app + route definitions
│   ├── worker.py            # Background inference thread + in-memory job queue
│   ├── inference.py         # Wan Video model loading + generation logic
│   ├── requirements.txt
│   ├── uploads/             # Input images (gitignored)
│   └── outputs/             # Generated GIFs + MP4s (gitignored)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ImageUpload.jsx
│   │   │   ├── PromptInput.jsx
│   │   │   ├── GenerateButton.jsx
│   │   │   ├── ProgressPanel.jsx
│   │   │   └── ResultViewer.jsx
│   │   └── api.js           # Fetch wrappers for all backend calls
│   ├── package.json
│   └── vite.config.js       # Proxy /generate, /status, /result → port 8000
├── docs/
│   └── superpowers/specs/
│       └── 2026-05-21-animation-creator-design.md
└── README.md
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| Invalid image format/size | Rejected at upload with inline validation message before queuing |
| Model not yet downloaded | First-launch setup screen shows download progress, blocks generation until ready |
| MPS out of memory | Inference catches OOM → job marked `failed` → user shown "Try shorter duration or restart the app" |
| Inference crash | Job marked `failed`, error logged to console, queue continues to next job |
| Backend unreachable | Frontend shows "Cannot connect to backend — is the server running?" |

---

## Constraints & Known Limitations

- One job runs at a time (MPS cannot parallelize diffusion jobs); subsequent requests queue behind the active one
- Text-to-motion control is probabilistic — "do a squat" produces squat-like motion, not biomechanically precise animation
- Avatar appearance may drift slightly across frames (inherent to diffusion-based I2V)
- First model download is ≈3 GB; requires internet on first run only
- Generation time: 10–15 min on M4 / 16 GB (subsequent jobs in same session are same speed — model stays loaded)
