import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session

from packages.core.src.config import settings
from packages.core.src.database import get_db
from packages.core.src.models import Source, ExtractedClaim
from packages.core.src.schemas import ExtractedClaimResponse
from packages.ingestion.src.ingestion_pipeline import IngestionPipeline

logger = logging.getLogger(__name__)

router = APIRouter()
pipeline = IngestionPipeline(upload_dir=settings.upload_dir)


@router.post("/{source_id}", status_code=202)
def ingest_source(
    source_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

    from packages.core.src.database import SessionLocal
    background_tasks.add_task(run_ingestion, source_id, SessionLocal)

    return {"message": "Ingestion started", "source_id": str(source_id)}


@router.post("/project/{project_id}", status_code=202)
def ingest_all_project_sources(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    sources = db.query(Source).filter(Source.project_id == project_id).all()
    if not sources:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No sources found for project")

    from packages.core.src.database import SessionLocal
    for source in sources:
        background_tasks.add_task(run_ingestion, source.id, SessionLocal)

    return {
        "message": f"Ingestion started for {len(sources)} sources",
        "project_id": str(project_id),
    }


@router.get("/{source_id}/claims", response_model=list[ExtractedClaimResponse])
def list_claims(source_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(ExtractedClaim)
        .filter(ExtractedClaim.source_id == source_id)
        .order_by(ExtractedClaim.created_at.desc())
        .all()
    )


def run_ingestion(source_id: UUID, session_factory):
    db = session_factory()
    try:
        source = db.query(Source).filter(Source.id == source_id).first()
    if not source or not source.file_path:
        logger.error("Source %s not found or missing file path", source_id)
        return

    try:
        from packages.core.src.models import ExtractedClaim as ClaimModel

        source.extraction_status = "processing"
        db.commit()

        result = pipeline.process_file(
            source_id=source.id,
            file_path=source.file_path,
            source_type=source.source_type.value,
        )

        source.extracted_text = result["extracted_text"]
        source.tables = result["tables"]
        source.figure_captions = result["figure_captions"]
        source.extraction_status = "completed"

        for claim_data in result["claims"]:
            claim = ClaimModel(
                source_id=source.id,
                text=claim_data["text"],
                claim_type=claim_data["claim_type"],
                confidence=claim_data["confidence"],
                variables=claim_data.get("variables", []),
                conditions=claim_data.get("conditions", []),
                methods=claim_data.get("methods", []),
                results=claim_data.get("results"),
                limitations=claim_data.get("limitations", []),
                provenance=claim_data.get("provenance", {}),
                page_number=claim_data.get("page_number"),
            )
            db.add(claim)

        db.commit()
        logger.info("Ingestion completed for source %s", source_id)

    except Exception as e:
        logger.error("Ingestion failed for source %s: %s", source_id, str(e))
        db.rollback()
        source = db.query(Source).filter(Source.id == source_id).first()
        if source:
            source.extraction_status = "failed"
            db.commit()
    finally:
        db.close()
