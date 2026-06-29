import os
import shutil
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from packages.core.src.config import settings
from packages.core.src.database import get_db
from packages.core.src.models import Source, Project
from packages.core.src.schemas import SourceResponse, SourceType, ExtractionStatus

router = APIRouter()

ALLOWED_EXTENSIONS = {
    ".pdf": SourceType.PDF,
    ".csv": SourceType.CSV,
    ".xlsx": SourceType.EXCEL,
    ".xls": SourceType.EXCEL,
    ".txt": SourceType.TEXT,
    ".md": SourceType.TEXT,
    ".png": SourceType.IMAGE,
    ".jpg": SourceType.IMAGE,
    ".jpeg": SourceType.IMAGE,
    ".gif": SourceType.IMAGE,
}


@router.post("", response_model=SourceResponse, status_code=201)
async def upload_file(
    project_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    ext = Path(file.filename).suffix.lower() if file.filename else ""
    source_type = ALLOWED_EXTENSIONS.get(ext)
    if not source_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS.keys())}",
        )

    upload_dir = Path(settings.upload_dir) / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / file.filename
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    source = Source(
        project_id=project_id,
        source_type=source_type,
        source_name=file.filename,
        file_path=str(file_path),
        extraction_status=ExtractionStatus.PENDING,
    )
    db.add(source)
    db.commit()
    db.refresh(source)

    return source


@router.get("", response_model=list[SourceResponse])
def list_sources(project_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(Source)
        .filter(Source.project_id == project_id)
        .order_by(Source.upload_timestamp.desc())
        .all()
    )


@router.get("/{source_id}", response_model=SourceResponse)
def get_source(source_id: UUID, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    return source


@router.delete("/{source_id}", status_code=204)
def delete_source(source_id: UUID, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

    if source.file_path and os.path.exists(source.file_path):
        os.remove(source.file_path)

    db.delete(source)
    db.commit()
