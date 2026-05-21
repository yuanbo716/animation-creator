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
