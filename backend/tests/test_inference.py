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
