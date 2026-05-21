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
    frames_np = [np.array(frame) for frame in frames]
    imageio.mimwrite(mp4_path, frames_np, fps=7)

    if on_progress:
        on_progress(num_inference_steps, num_inference_steps)

    return gif_path, mp4_path
