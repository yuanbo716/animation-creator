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
