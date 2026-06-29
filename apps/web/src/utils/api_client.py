import os
from typing import Any

import httpx

API_URL = os.getenv("API_URL", "http://localhost:8000")


def _url(path: str) -> str:
    return f"{API_URL}/api{path}"


def create_project(data: dict[str, Any]) -> dict[str, Any]:
    r = httpx.post(_url("/projects"), json=data, timeout=30)
    r.raise_for_status()
    return r.json()


def list_projects() -> list[dict[str, Any]]:
    r = httpx.get(_url("/projects"), timeout=30)
    r.raise_for_status()
    return r.json()


def get_project(project_id: str) -> dict[str, Any]:
    r = httpx.get(_url(f"/projects/{project_id}"), timeout=30)
    r.raise_for_status()
    return r.json()


def update_project(project_id: str, data: dict[str, Any]) -> dict[str, Any]:
    r = httpx.patch(_url(f"/projects/{project_id}"), json=data, timeout=30)
    r.raise_for_status()
    return r.json()


def upload_file(project_id: str, file_path: str) -> dict[str, Any]:
    with open(file_path, "rb") as f:
        r = httpx.post(
            _url("/uploads"),
            data={"project_id": project_id},
            files={"file": (file_path.split("/")[-1], f)},
            timeout=120,
        )
    r.raise_for_status()
    return r.json()


def list_sources(project_id: str) -> list[dict[str, Any]]:
    r = httpx.get(_url(f"/uploads"), params={"project_id": project_id}, timeout=30)
    r.raise_for_status()
    return r.json()


def ingest_source(source_id: str) -> dict[str, Any]:
    r = httpx.post(_url(f"/ingestion/{source_id}"), timeout=30)
    r.raise_for_status()
    return r.json()


def ingest_all_sources(project_id: str) -> dict[str, Any]:
    r = httpx.post(_url(f"/ingestion/project/{project_id}"), timeout=30)
    r.raise_for_status()
    return r.json()


def get_claims(source_id: str) -> list[dict[str, Any]]:
    r = httpx.get(_url(f"/ingestion/{source_id}/claims"), timeout=30)
    r.raise_for_status()
    return r.json()


def list_evidence(project_id: str, claim_type: str | None = None, min_confidence: float = 0.0) -> list[dict[str, Any]]:
    params = {"project_id": project_id, "min_confidence": min_confidence}
    if claim_type:
        params["claim_type"] = claim_type
    r = httpx.get(_url("/retrieval/evidence/{project_id}"), params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def generate_hypotheses(project_id: str) -> list[dict[str, Any]]:
    r = httpx.post(_url(f"/hypotheses/generate/{project_id}"), timeout=120)
    r.raise_for_status()
    return r.json()


def list_hypotheses(project_id: str, status_filter: str | None = None) -> list[dict[str, Any]]:
    params = {"project_id": project_id}
    if status_filter:
        params["status_filter"] = status_filter
    r = httpx.get(_url("/hypotheses"), params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def get_hypothesis(hypothesis_id: str) -> dict[str, Any]:
    r = httpx.get(_url(f"/hypotheses/{hypothesis_id}"), timeout=30)
    r.raise_for_status()
    return r.json()


def update_hypothesis(hypothesis_id: str, data: dict[str, Any]) -> dict[str, Any]:
    r = httpx.patch(_url(f"/hypotheses/{hypothesis_id}"), json=data, timeout=30)
    r.raise_for_status()
    return r.json()


def health_check() -> bool:
    try:
        r = httpx.get(f"{API_URL}/api/health", timeout=10)
        return r.status_code == 200
    except Exception:
        return False
