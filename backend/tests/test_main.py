from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


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
