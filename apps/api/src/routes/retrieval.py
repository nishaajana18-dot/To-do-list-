from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from packages.core.src.database import get_db
from packages.core.src.models import ExtractedClaim, Source
from packages.core.src.schemas import EvidenceItem
from packages.retrieval.src.search import SemanticSearch
from packages.retrieval.src.ranking import rank_evidence

router = APIRouter()
searcher = SemanticSearch()


@router.post("/search/{project_id}", response_model=list[EvidenceItem])
def search_evidence(
    project_id: UUID,
    query: str = Query(..., min_length=1),
    top_k: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    results = searcher.search(
        db=db,
        query_embedding=[],
        project_id=project_id,
        top_k=top_k,
    )

    ranked = rank_evidence(results)
    return ranked


@router.get("/evidence/{project_id}", response_model=list[EvidenceItem])
def list_all_evidence(
    project_id: UUID,
    claim_type: str | None = Query(None),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
):
    query = (
        db.query(ExtractedClaim)
        .join(Source)
        .filter(Source.project_id == project_id, ExtractedClaim.confidence >= min_confidence)
    )

    if claim_type:
        query = query.filter(ExtractedClaim.claim_type == claim_type)

    claims = query.order_by(ExtractedClaim.confidence.desc()).all()

    results = []
    for c in claims:
        results.append(
            {
                "claim_id": c.id,
                "text": c.text,
                "source_name": c.source.source_name,
                "source_type": c.source.source_type,
                "confidence": c.confidence,
                "citation": None,
                "relevance_score": None,
            }
        )

    return results
