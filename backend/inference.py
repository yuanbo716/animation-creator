import os
import uuid
from typing import Callable, Optional, Tuple

import imageio
import numpy as np
import torch
from PIL import Image

_pipeline = None

# 1.3B text-to-video model — the only Wan 1.3B model that fits in 16 GB.
# The 1.3B I2V variant does not exist; the I2V line starts at 14B.
_MODEL_ID = "Wan-AI/Wan2.1-T2V-1.3B-Diffusers"

# 17 frames = 2 s @ 8 fps; must satisfy k*8+1 for Wan temporal compression.
_NUM_FRAMES = 17
_FPS = 8


def _get_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    from diffusers import WanPipeline
    _pipeline = WanPipeline.from_pretrained(
        _MODEL_ID,
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

    pipe = _get_pipeline()

    def _step_cb(pipe, step: int, timestep, callback_kwargs):
        if on_progress:
            on_progress(step + 1, num_inference_steps)
        return callback_kwargs

    output = pipe(
        prompt=prompt,
        height=480,
        width=832,
        num_frames=_NUM_FRAMES,
        num_inference_steps=num_inference_steps,
        callback_on_step_end=_step_cb,
    )

    frames = output.frames[0]
    job_id = str(uuid.uuid4())

    duration_ms = int(1000 / _FPS)
    gif_path = os.path.join(output_dir, f"{job_id}.gif")
    frames[0].save(
        gif_path,
        save_all=True,
        append_images=frames[1:],
        loop=0,
        duration=duration_ms,
    )

    mp4_path = os.path.join(output_dir, f"{job_id}.mp4")
    imageio.mimwrite(mp4_path, [np.array(f) for f in frames], fps=_FPS)

    if on_progress:
        on_progress(num_inference_steps, num_inference_steps)

    return gif_path, mp4_path
