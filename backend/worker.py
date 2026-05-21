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
